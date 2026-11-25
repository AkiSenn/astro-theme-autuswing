import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redirects } from '../src/lib/redirects.mjs';
export { redirects };
import { themeConfig as theme } from '../src/lib/config-loader.mjs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { deploymentFor, mountPath, unmountPath } from '../src/lib/deployment.mjs';
import { fileManifest, inputManifest, readOutputPolicy, sha256 } from './file-manifest.mjs';
import { pwaReleaseId, serviceWorker } from '../src/lib/service-worker.mjs';
import { verifyMediaCompatibility } from './css-media-compat.mjs';
import { finalizeRoutePrecedence } from './route-precedence.mjs';
export function staticArtifacts({ markdownProcessor }) {
  let inputs, projectRoot, deployment;
  const configuration = {
    name: 'autuswing-deployment-config',
    hooks: {
      'astro:config:setup': ({ command, config, updateConfig }) => {
        projectRoot = fileURLToPath(config.root);
        deployment = deploymentFor(command);
        if (config.site && config.site !== deployment.origin && config.site !== deployment.origin + '/')
          throw new Error('Configure the origin in src/config/environments.yml instead of overriding Astro site');
        if (config.base !== '/' && config.base !== deployment.basePath && config.base + '/' !== deployment.basePath)
          throw new Error('Configure basePath in src/config/environments.yml instead of overriding Astro base');
        updateConfig({
          site: deployment.origin,
          base: deployment.basePath,
          markdown: { processor: markdownProcessor(deployment, { deferAttachmentHrefs: command === 'build' }) },
          vite: { define: { __AUTUSWING_DEPLOYMENT__: JSON.stringify(deployment) } },
        });
        if (command === 'build') inputs = inputManifest(projectRoot);
      },
    },
  };
  return {
    name: 'autuswing-static-artifacts',
    configuration,
    deployment: () => deployment,
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
        const historical = redirects();
        const routeCollisions = await finalizeRoutePrecedence(root, deployment, manifest, historical);
        const rules = historical.map(({ from, to, status }) => ({
          from: mountPath(from, deployment),
          to: mountPath(to, deployment),
          status,
        }));
        // Version the actual emitted offline bytes, after Astro has completed.
        await write(
          'sw.js',
          serviceWorker(await fs.readFile(path.join(root, 'offline.html')), theme.pwa.enable, {
            deployment,
            release: pwaReleaseId(inputs),
            routes: [
              ...manifest.map(route => route.path),
              ...historical.map(route => route.from),
              ...routeCollisions.map(({ alias }) => unmountPath(alias, deployment)),
            ],
          }),
        );
        await write(
          '_redirects',
          rules.map((r) => `${encodeURI(r.from)} ${r.to} ${r.status}`).join('\n') + '\n',
        );
        if (theme.performance.generate_headers)
          await write(
            '_headers',
            `${mountPath('/*', deployment)}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n${deployment.mode !== 'production' ? '  X-Robots-Tag: noindex, nofollow\n' : ''}\n${mountPath('/_astro/*', deployment)}\n  Cache-Control: public, max-age=31536000, immutable\n\n${mountPath('/assets/vendor/*', deployment)}\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n\n${mountPath('/img/*', deployment)}\n  Cache-Control: public, max-age=86400\n\n${mountPath('/sw.js', deployment)}\n  Cache-Control: no-cache\n`,
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
        await verifyMediaCompatibility(root);
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
        const finalInputs = inputManifest(projectRoot);
        if (JSON.stringify(finalInputs) !== JSON.stringify(inputs))
          throw new Error(
            'Build inputs changed while generating the artifact; rebuild before release',
          );
        const contract = JSON.parse(
          await fs.readFile(path.join(projectRoot, '.astro/autuswing-content.json'), 'utf8'),
        );
        const { mode, origin, basePath } = deployment;
        if (contract.mode !== mode)
          throw new Error('Content manifest belongs to a different build mode');
        await fs.writeFile(
          path.join(projectRoot, '.astro/autuswing-build.json'),
          JSON.stringify(
            {
              version: 1,
              mode,
              siteUrl: origin,
              basePath,
              outputRoot: path.resolve(root),
              policyHash: sha256(JSON.stringify(readOutputPolicy(projectRoot))),
              inputs,
              contract,
              ...(routeCollisions.length && { routeCollisions }),
              files: fileManifest(root),
            },
            null,
            2,
          ) + '\n',
        );
      },
    },
  };
}
