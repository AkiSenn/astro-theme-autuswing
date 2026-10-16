import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redirects } from '../src/lib/legacy-redirects.mjs';
export { redirects };
import theme from '../src/config/theme.json' with { type: 'json' };
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
export function staticArtifacts() {
  return {
    name: 'autuswing-static-artifacts',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir),
          write = (file, text) => fs.writeFile(path.join(root, file), text);
        const manifest = JSON.parse(
          await fs.readFile(new URL('../.astro/autuswing-routes.json', import.meta.url), 'utf8'),
        );
        for (const route of manifest.filter((r) => r.path.endsWith('.html'))) {
          const file = path.resolve(root, '.' + route.path),
            base = path.resolve(root) + path.sep;
          if (!file.startsWith(base)) throw new Error('Unsafe file permalink output');
          const stat = await fs.stat(file).catch(() => null);
          if (stat?.isDirectory()) {
            const contents = await fs.readdir(file);
            if (contents.length !== 1 || contents[0] !== 'index.html')
              throw new Error('Ambiguous file permalink ' + route.path);
            const html = await fs.readFile(path.join(file, 'index.html'));
            await fs.unlink(path.join(file, 'index.html'));
            await fs.rmdir(file);
            await fs.writeFile(file, html);
          }
        }
        const rules = redirects();
        await write(
          '_redirects',
          rules.map((r) => `${encodeURI(r.from)} ${r.to} ${r.status}`).join('\n') + '\n',
        );
        if (theme.performance.generate_headers)
          await write(
            '_headers',
            `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n${process.env.SITE_ENV !== 'production' ? '  X-Robots-Tag: noindex, nofollow\n' : ''}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/assets/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n\n/img/*\n  Cache-Control: public, max-age=86400\n\n/sw.js\n  Cache-Control: no-cache\n`,
          );
        // Retain the original sitemap URL while the official integration owns XML
        // serialization and splitting. No redirect or duplicate sitemap algorithm.
        if (theme.seo.sitemap) {
          const map = await fs.readFile(path.join(root, 'sitemap-index.xml'), 'utf8');
          await write('sitemap.xml', map);
          const generated = await fs.readdir(root);
          const xmls = await Promise.all(
            generated
              .filter((f) => /^sitemap-\d+\.xml$/.test(f))
              .map((f) => fs.readFile(path.join(root, f), 'utf8')),
          );
          await write('baidusitemap.xml', xmls.length === 1 ? xmls[0] : map);
          const locations = xmls.join('').matchAll(/<loc>([^<]+)<\/loc>/g);
          await write(
            'sitemap.txt',
            [...locations].map((m) => m[1].replaceAll('&amp;', '&')).join('\n') + '\n',
          );
        }
        // Build outputs only: persistent migration inputs remain immutable.
        await write('redirects.json', JSON.stringify(rules, null, 2) + '\n');
        if (theme.performance.precompress) {
          async function compress(dir) {
            for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
              const file = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                await compress(file);
                continue;
              }
              if (!/\.(html|css|js|json|xml|txt|svg|webmanifest)$/.test(file)) continue;
              const content = await fs.readFile(file);
              if (content.length < theme.performance.compression_min_bytes) continue;
              await fs.writeFile(file + '.gz', gzipSync(content));
              await fs.writeFile(
                file + '.br',
                brotliCompressSync(content, {
                  params: {
                    [constants.BROTLI_PARAM_QUALITY]: Math.max(
                      0,
                      Math.min(11, theme.performance.precompress_quality),
                    ),
                  },
                }),
              );
            }
          }
          await compress(root);
        }
      },
    },
  };
}
