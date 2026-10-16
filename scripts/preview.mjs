import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist/', import.meta.url)),
  port = Number(process.env.PORT || 4322);
const redirects = (await fs.readFile(path.join(root, '_redirects'), 'utf8'))
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/))
  .filter((x) => x.length === 3)
  .map(([from, to, status]) => ({ from: decodeURIComponent(from), to, status: Number(status) }));
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
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'),
        pathname = decodeURIComponent(url.pathname);
      const redirect = redirects.find((r) => r.from === pathname);
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache');
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
  })
  .listen(port, '127.0.0.1', () =>
    console.log(
      `AutuSwing Astro preview: http://127.0.0.1:${port}/ (local _redirects adapter; no deployment)`,
    ),
  );
