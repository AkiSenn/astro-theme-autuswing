import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import katex from 'katex';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { scanMath } from '../src/lib/markdown.mjs';

const source = path.resolve(process.argv[2] || 'E:/hexo-akisenn/source');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const file = path.join(directory, item.name);
    return item.isDirectory() ? files(file) : /\.(md|markdown)$/i.test(item.name) ? [file] : [];
  });
}
const documents = files(source)
  .sort()
  .map((file) => {
    const raw = fs.readFileSync(file, 'utf8');
    const { data, body } = frontmatter(raw);
    const frontmatterLines = raw.slice(0, raw.length - body.length).split('\n').length - 1;
    const macros = {};
    const formulas = scanMath(body).map(({ tex, display, line }) => {
      try {
        katex.renderToString(tex, {
          displayMode: display,
          throwOnError: true,
          trust: false,
          macros,
        });
        return {
          tex,
          display,
          line: line + frontmatterLines,
          commands: [...new Set(tex.match(/\\[A-Za-z]+/g) || [])],
          supported: true,
        };
      } catch (error) {
        return {
          tex,
          display,
          line: line + frontmatterLines,
          supported: false,
          error: error.message,
        };
      }
    });
    return {
      file: path.relative(source, file).replaceAll('\\', '/'),
      title: data.title,
      sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      flags: Object.fromEntries(
        ['math', 'mathjax', 'katex'].filter((key) => key in data).map((key) => [key, data[key]]),
      ),
      formulas,
    };
  });
const posts = documents.filter(
  (item) => item.file.startsWith('_posts/') || item.file.startsWith('posts/'),
);
const report = {
  checkedAt: new Date().toISOString(),
  source,
  katex: katex.version,
  markdownFiles: documents.length,
  posts: posts.length,
  postsWithMath: posts.filter((item) => item.formulas.length).length,
  formulas: documents.reduce((sum, item) => sum + item.formulas.length, 0),
  unsupported: documents.flatMap((item) =>
    item.formulas.filter((f) => !f.supported).map((f) => ({ file: item.file, ...f })),
  ),
  documents,
};
fs.mkdirSync('docs/evidence/math', { recursive: true });
fs.writeFileSync('docs/evidence/math/audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
