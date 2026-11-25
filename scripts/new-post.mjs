import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { loadYamlFile } from '../src/lib/config-loader.mjs';

export function markdownFiles(dir) {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory()
            ? markdownFiles(path.join(dir, entry.name))
            : entry.name.endsWith('.md')
              ? [path.join(dir, entry.name)]
              : [],
        )
    : [];
}

export function createPost({ root, title, template = 'post', series, now = new Date() }) {
  if (!title?.trim()) throw new Error('A nonempty title is required');
  if (!['post', 'tutorial', 'series'].includes(template)) throw new Error('Unknown template');
  if (template === 'series' && !series?.trim())
    throw new Error('Series template requires --series "系列名称"');
  const metadata = markdownFiles(path.join(root, 'content')).map(
    (file) => frontmatter(fs.readFileSync(file, 'utf8')).data,
  );
  const ids = new Set(
    metadata
      .flatMap((data) => [data.id, data.abbrlink])
      .filter((value) => value !== undefined)
      .map((value) => String(value).toLowerCase()),
  );
  const settings = loadYamlFile(path.join(root, 'src/config/theme.yml'));
  const length = Math.max(4, Math.min(20, Number(settings.urls.length) || 6));
  const reserved = new Set(
    'post p posts archives tags categories links about page img assets _astro background 404 offline search rss atom sitemap robots manifest sw'.split(
      ' ',
    ),
  );
  for (const name of fs.readdirSync(path.join(root, 'public'))) reserved.add(name.toLowerCase());
  for (const data of metadata)
    if (data.permalink)
      reserved.add(String(data.permalink).replace(/^\//, '').split('/')[0].toLowerCase());
  let id;
  do {
    id = BigInt('0x' + crypto.randomBytes(16).toString('hex'))
      .toString(36)
      .slice(-length)
      .padStart(length, '0');
  } while (ids.has(id) || reserved.has(id));
  const body = fs.readFileSync(path.join(root, 'templates', `${template}.md`), 'utf8');
  const name =
    title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/[. ]+$/, '')
      .slice(0, 80) || 'post';
  const target = path.join(root, 'content/posts', `${id}-${name}.md`);
  const extra = series?.trim() ? `series: ${JSON.stringify(series.trim())}\nseries_order: 1\n` : '';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    `---\ntitle: ${JSON.stringify(title.trim())}\ndate: ${JSON.stringify(now.toISOString())}\nid: '${id}'\npermalink: '/${id}/'\ndraft: true\ndescription: ""\ntags: []\ncategories: []\n${extra}---\n\n${body}`,
    { flag: 'wx' },
  );
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    words = [];
  let template = 'post',
    series;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template' || args[i] === '--series') {
      const option = args[i],
        value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
      if (option === '--template') template = value;
      else series = value;
    } else if (args[i] !== '--') {
      if (args[i].startsWith('--')) throw new Error(`Unknown option: ${args[i]}`);
      words.push(args[i]);
    }
  }
  if (!words.length)
    throw new Error(
      'Usage: npm run new-post -- "标题" [--template post|tutorial|series] [--series "系列名"]',
    );
  console.log(
    createPost({
      root: fileURLToPath(new URL('../', import.meta.url)),
      title: words.join(' '),
      template,
      series,
    }),
  );
}
