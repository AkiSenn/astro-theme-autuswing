import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { load } from 'cheerio';

// Deliberately use the flat Media Queries 3 grammar. In particular, `not
// (min-width: …)` is MQ4, whereas `not all and (min-width: …)` is MQ3.
// Unknown feature names can safely evaluate false in an older browser.
const feature = String.raw`\([a-z][\w-]*(?:\s*:\s*[^():<>;{}]+)?\)`;
const condition = new RegExp(
  String.raw`^(?:(?:(?:not|only)\s+)?[a-z][\w-]*(?:\s+and\s+${feature})*|${feature}(?:\s+and\s+${feature})*)$`,
  'i',
);

export function assertLegacyMediaQuery(query, label = 'CSS') {
  if (!query.split(',').every((part) => condition.test(part.trim())))
    throw new Error(`${label}: media query requires newer syntax: ${query}`);
}

export function assertLegacyMediaCss(css, label = 'CSS') {
  const root = postcss.parse(css, { from: label });
  // Vite must bundle imports. A residual @import can hide an unchecked
  // remote sheet or an MQ4 import condition from the emitted-byte gate.
  root.walkAtRules(/^import$/i, () => {
    throw new Error(`${label}: unbundled CSS @import is not allowed`);
  });
  root.walkAtRules(/^media$/i, (rule) => {
    assertLegacyMediaQuery(rule.params, label);
  });
}

// Check the emitted bytes, including unprocessed noscript <style> blocks.
// Run before compression/sealing so incompatible output cannot be released.
export async function verifyMediaCompatibility(root) {
  let files = 0;
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.css')) {
        assertLegacyMediaCss(await fs.readFile(file, 'utf8'), file);
        files++;
      } else if (entry.name.endsWith('.html')) {
        const $ = load(await fs.readFile(file, 'utf8'), { scriptingEnabled: false });
        $('style').each((i, node) => assertLegacyMediaCss($(node).text(), `${file}:style[${i}]`));
        $('[media]').each((_, node) => assertLegacyMediaQuery($(node).attr('media'), file));
        files++;
      }
    }
  }
  await walk(root);
  return files;
}
