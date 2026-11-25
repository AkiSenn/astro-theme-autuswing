import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { escapeAttribute } from 'entities';
import { mountPath, mountReference, unmountPath } from '../src/lib/deployment.mjs';
import { authoredAssetReference, publicAssetFile } from '../src/lib/image-url.mjs';
import { attachmentPath, pendingAttachmentScheme } from '../src/lib/attachment-links.mjs';

const collisionPrefix = '/_autuswing/static';
const directoryKey = pathname => pathname.replace(/\/$/, '');

export async function finalizeRoutePrecedence(root, deployment, routes, historical) {
  if (deployment.basePath === '/') return [];
  const routePaths = new Set(routes.map(route => route.path));
  const historicalPaths = new Set(historical.map(route => decodeURIComponent(route.from)));
  const mountedHistory = new Set([...historicalPaths].map(from => mountPath(from, deployment)));
  const ownsLogicalPath = pathname => routePaths.has(pathname) || routePaths.has(pathname + '/') ||
    historicalPaths.has(pathname) || historicalPaths.has(pathname + '/');
  const output = pathname => path.join(root, pathname.slice(1));
  const relocated = new Map();
  const collisions = [];

  for (const route of routes) {
    if (!route.path.endsWith('/')) continue;
    const alias = directoryKey(route.path);
    const logicalFile = unmountPath(alias, deployment);
    if (!logicalFile || logicalFile === '/' || !publicAssetFile(logicalFile)) continue;
    if (mountedHistory.has(alias) || mountedHistory.has(route.path)) continue;
    const relocatedPath = collisionPrefix + logicalFile;
    relocated.set(logicalFile, relocatedPath);
    collisions.push({
      route: mountPath(route.path, deployment),
      alias: route.path,
      source: 'public' + logicalFile,
      asset: mountPath(relocatedPath, deployment),
      logicalFile,
      routePath: route.path,
      relocatedPath,
    });
  }

  const marker = new RegExp(`(\\shref=)("|&quot;)${pendingAttachmentScheme}([A-Za-z0-9_-]+)\\2`, 'g');
  function resolve(payload) {
    const original = Buffer.from(payload, 'base64url').toString('utf8');
    const pathname = attachmentPath(original);
    if (!pathname || pathname.endsWith('/')) throw new Error('Invalid pending attachment URL');
    const key = decodeURIComponent(pathname);
    if (ownsLogicalPath(key)) return mountReference(original, deployment);
    if (relocated.has(key))
      return mountPath(collisionPrefix + original, deployment);
    return mountReference(authoredAssetReference(original, deployment), deployment);
  }
  async function finalize(file, feed = false) {
    const html = await fs.readFile(file, 'utf8').catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (!html?.includes(pendingAttachmentScheme)) return;
    const resolved = html.replace(marker, (_, attribute, quote, payload) => {
      const href = resolve(payload);
      const escaped = escapeAttribute(feed ? new URL(href, deployment.origin).href : href);
      return attribute + quote + (quote === '&quot;' ? escapeAttribute(escaped) : escaped) + quote;
    });
    if (resolved !== html) await fs.writeFile(file, resolved);
  }
  await Promise.all([
    ...routes.map(({ path: route }) => finalize(output(route.endsWith('/') ? route + 'index.html' : route))),
    ...['rss.xml', 'atom.xml'].map(feed => finalize(path.join(root, feed), true)),
  ]);

  for (const { logicalFile, routePath, relocatedPath } of collisions) {
    const file = output(logicalFile);
    const destination = output(relocatedPath);
    const routeFile = output(routePath + 'index.html');
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(file, destination, constants.COPYFILE_EXCL);
    await fs.unlink(file);
    await fs.mkdir(file);
    await fs.copyFile(routeFile, path.join(file, 'index.html'), constants.COPYFILE_EXCL);
  }
  return collisions.map(({ route, alias, source, asset }) => ({ route, alias, source, asset }));
}
