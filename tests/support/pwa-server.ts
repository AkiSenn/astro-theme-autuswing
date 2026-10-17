import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { serviceWorker } from '../../src/lib/service-worker.mjs';

// Test-owned loopback origin. Socket failures affect Worker fetches as well as
// page fetches, unlike context.setOffline in some Playwright browser backends.
export async function pwaServer(root = path.resolve(process.env.PWA_ARTIFACT_ROOT || 'dist')) {
  root = path.resolve(root);
  const initial = fs.readFileSync(path.join(root, 'offline.html'), 'utf8');
  const state = { html: initial, workerHtml: initial, disconnected: false };
  const requests: { path: string; disconnected: boolean; sequence: number }[] = [];
  const mime: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
  };
  const instance = http.createServer((req, res) => {
    const pathname = new URL(req.url!, 'http://localhost').pathname;
    requests.push({ path: pathname, disconnected: state.disconnected, sequence: requests.length });
    if (state.disconnected) {
      req.socket.destroy();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(serviceWorker(state.workerHtml));
      return;
    }
    if (pathname === '/offline.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(state.html);
      return;
    }
    const file = path.resolve(root, '.' + decodeURI(pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(400).end();
      return;
    }
    try {
      const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
      res.setHeader('Content-Type', mime[path.extname(target)] || 'text/html; charset=utf-8');
      res.end(fs.readFileSync(target));
    } catch {
      res
        .writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
        .end('<h1>Network is reachable</h1>');
    }
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(instance.address() as { port: number }).port}`;
  return {
    state,
    initial,
    origin,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        instance.close(() => resolve());
        instance.closeAllConnections();
      }),
  };
}
