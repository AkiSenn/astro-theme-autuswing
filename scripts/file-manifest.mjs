import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadYamlFile } from '../src/lib/config-loader.mjs';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const inputDirectories = ['src', 'public', 'content', 'scripts', 'templates', 'tests'];
const inputFiles = [
  'astro.config.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'playwright.config.ts',
  'playwright.cross.config.ts',
  'playwright.pwa.config.ts',
];

export function walkFiles(root) {
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Not a regular directory: ' + root);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap(entry => {
      const file = path.join(root, entry.name);
      if (!entry.isDirectory() && !entry.isFile())
        throw new Error('Symlink or special file is not allowed: ' + file);
      return entry.isDirectory() ? walkFiles(file) : [file];
    });
}

export function fileManifest(root) {
  return walkFiles(root)
    .map(file => {
      const bytes = fs.readFileSync(file);
      return {
        file: path.relative(root, file).split(path.sep).join('/'),
        bytes: bytes.length,
        sha256: sha256(bytes),
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file, 'en'));
}

export function inputManifest(root) {
  const files = inputDirectories.flatMap(dir =>
    fs.existsSync(path.join(root, dir)) ? walkFiles(path.join(root, dir)) : [],
  );
  for (const file of inputFiles) {
    const name = path.join(root, file);
    if (!fs.existsSync(name)) continue;
    if (!fs.lstatSync(name).isFile()) throw new Error('Not a regular build input: ' + name);
    files.push(name);
  }
  return files
    .map(file => ({
      file: path.relative(root, file).split(path.sep).join('/'),
      sha256: sha256(fs.readFileSync(file)),
    }))
    .sort((a, b) => a.file.localeCompare(b.file, 'en'));
}

/** Fails when a directory no longer matches a recorded manifest. */
export function verifyFiles(root, expected) {
  const actual = new Map(fileManifest(root).map(row => [row.file, row]));
  const recorded = new Map(expected.map(row => [row.file, row]));
  const missing = [];
  const modified = [];
  for (const [file, row] of recorded) {
    const found = actual.get(file);
    if (!found) missing.push(file);
    else if (found.bytes !== row.bytes || found.sha256 !== row.sha256) modified.push(file);
  }
  const extra = [...actual.keys()].filter(file => !recorded.has(file));
  if (missing.length || modified.length || extra.length)
    throw new Error('Final artifact changed: ' + JSON.stringify({ missing, modified, extra }));
}

/** Output hygiene shared by the build record: production origin plus paths kept out of indexes. */
export function readOutputPolicy(root = fileURLToPath(new URL('../', import.meta.url))) {
  const configuredOrigin = loadYamlFile(path.join(root, 'src', 'config', 'environments.yml'))?.production?.origin;
  const productionUrl = typeof configuredOrigin === 'string' ? URL.parse(configuredOrigin)?.origin : null;
  const { noindexPaths } = JSON.parse(fs.readFileSync(path.join(root, 'src', 'config', 'output-policy.json'), 'utf8'));
  return { productionUrl, noindexPaths };
}
