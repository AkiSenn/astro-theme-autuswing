import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unmountPath } from '../src/lib/deployment.mjs';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
export async function createPreviewServer(directory, basePath = '/') {
  const root = path.resolve(directory);
  const mount = { basePath };
  const redirects = (await fs.readFile(path.join(root, '_redirects'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((x) => x.length === 3)
    .map(([from, to, status]) => ({ from: decodeURIComponent(from), to, status: Number(status) }));
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'),
        requestPath = decodeURIComponent(url.pathname);
      const redirect = redirects.find((r) => r.from === requestPath);
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache');
      const pathname = unmountPath(requestPath, mount);
      if (pathname === undefined) {
        res.writeHead(404);
        res.end('Outside the preview mount');
        return;
      }
      if (basePath !== '/' && requestPath === basePath.slice(0, -1)) {
        res.writeHead(301, { Location: basePath + url.search });
        res.end();
        return;
      }
      if (redirect) {
        res.writeHead(redirect.status, { Location: redirect.to + url.search });
        res.end();
        return;
      }
      const target = path.resolve(root, '.' + pathname),
        base = path.resolve(root) + path.sep;
      if (target !== path.resolve(root) && !target.startsWith(base)) {
        res.writeHead(400);
        res.end('Invalid path');
        return;
      }
      let file = target,
        stat;
      try {
        stat = await fs.stat(file);
      } catch {}
      if (stat?.isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(301, { Location: url.pathname + '/' + url.search });
          res.end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      let body;
      try {
        body = await fs.readFile(file);
      } catch {
        file = path.join(root, '404.html');
        body = await fs.readFile(file);
        res.statusCode = 404;
      }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(400);
      res.end('Bad request');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../dist', import.meta.url));
  const port = Number(process.env.PORT || 4322);
  let basePath = '/';
  try {
    const record = JSON.parse(await fs.readFile(new URL('../.astro/autuswing-build.json', import.meta.url), 'utf8'));
    if (path.resolve(record.outputRoot) === path.resolve(root)) basePath = record.basePath ?? '/';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const server = await createPreviewServer(root, basePath);
  server.listen(port, '127.0.0.1', () =>
    console.log(`AutuSwing Astro preview: http://127.0.0.1:${server.address().port}${basePath}`),
  );
}
