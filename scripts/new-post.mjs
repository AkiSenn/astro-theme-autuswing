import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { frontmatter } from '../src/lib/frontmatter.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const title = process.argv.slice(2).join(' ').trim();
if (!title) throw new Error('Usage: npm run new-post -- "文章标题"');
function files(dir) {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? files(path.join(dir, e.name))
            : e.name.endsWith('.md')
              ? [path.join(dir, e.name)]
              : [],
        )
    : [];
}
const ids = new Set(
  files(path.join(root, 'content')).map((f) => {
    const { data } = frontmatter(fs.readFileSync(f, 'utf8'));
    return String(
      data.id !== undefined && data.id !== '' ? data.id : (data.abbrlink ?? ''),
    ).toLowerCase();
  }),
);
const settings = JSON.parse(fs.readFileSync(path.join(root, 'src/config/theme.json'), 'utf8'));
const length = Math.max(4, Math.min(20, Number(settings.urls.length) || 6));
const reserved = new Set(
  'post p posts archives tags categories links about page img assets _astro background 404 offline search rss atom sitemap robots manifest sw'.split(
    ' ',
  ),
);
for (const name of fs.readdirSync(path.join(root, 'public'))) reserved.add(name.toLowerCase());
for (const file of files(path.join(root, 'content'))) {
  const { data } = frontmatter(fs.readFileSync(file, 'utf8'));
  if (data.permalink)
    reserved.add(String(data.permalink).replace(/^\//, '').split('/')[0].toLowerCase());
}
let id;
do {
  id = BigInt('0x' + crypto.randomBytes(16).toString('hex'))
    .toString(36)
    .slice(-length)
    .padStart(length, '0');
} while (ids.has(id) || reserved.has(id));
const dir = path.join(root, 'content/posts');
fs.mkdirSync(dir, { recursive: true });
const name =
  title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/, '')
    .slice(0, 80) || 'post';
const target = path.join(dir, `${id}-${name}.md`);
fs.writeFileSync(
  target,
  `---\ntitle: ${JSON.stringify(title)}\ndate: ${JSON.stringify(new Date().toISOString())}\nid: '${id}'\npermalink: '/${id}/'\ntags: []\ncategories: []\n---\n\n`,
  { flag: 'wx' },
);
console.log(target);
