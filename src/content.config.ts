import { defineCollection } from 'astro:content';
import { contentSchema as schema } from './lib/content-schema';
import { glob } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { frontmatter } from './lib/frontmatter.mjs';
import { themeConfig as theme } from './lib/config-loader.mjs';
import { katexVersion } from './lib/math.mjs';
import { getDeployment } from './lib/deployment.mjs';

// Delegate discovery, watching, Markdown and caching to Astro. Re-read only the
// YAML data before validation, preserving original date/ID scalar semantics.
function contentLoader(pattern: string[], base: string): Loader {
  const loader = glob({ pattern, base, generateId: ({ entry }) => entry.replace(/\.md$/, '') });
  return {
    ...loader,
    async load(context) {
      // Astro owns the cache. Extend its digest with inputs used by the thin
      // compatibility renderer so configuration changes cannot reuse stale HTML.
      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ theme, katexVersion, deployment: getDeployment() }));
      for (const file of [
        'lib/markdown.mjs',
        'lib/markdown-features.mjs',
        'lib/math.mjs',
        'lib/frontmatter.mjs',
        'lib/image-url.mjs',
      ])
        hash.update(await fs.readFile(new URL(file, import.meta.url)));
      async function images(directory: URL) {
        for (const item of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) =>
          a.name.localeCompare(b.name, 'en'),
        )) {
          const url = new URL(
            encodeURIComponent(item.name) + (item.isDirectory() ? '/' : ''),
            directory,
          );
          if (item.isDirectory()) await images(url);
          else hash.update(url.pathname).update(await fs.readFile(url));
        }
      }
      await images(new URL('../public/img/', import.meta.url));
      const rendererDigest = hash.digest('hex');
      const parseData: LoaderContext['parseData'] = async <
        TData extends Record<string, unknown>,
      >(args: {
        id: string;
        data: TData;
        filePath?: string;
      }) => {
        const { data } = frontmatter(await fs.readFile(args.filePath!, 'utf8'));
        for (const key of Object.keys(data))
          if (!(key in schema.shape))
            context.logger.warn(
              `Preserving unrecognized front matter "${key}" in ${args.filePath}; no display behavior is implied`,
            );
        return context.parseData<TData>({ ...args, data: data as TData });
      };
      await loader.load({
        ...context,
        parseData,
        generateDigest: (data) =>
          context.generateDigest(
            typeof data === 'string' ? data + rendererDigest : { ...data, rendererDigest },
          ),
      });
    },
  };
}
export const collections = {
  posts: defineCollection({
    loader: contentLoader(['**/*.md'], './content/posts'),
    schema,
  }),
  pages: defineCollection({ loader: contentLoader(['**/*.md'], './content/pages'), schema }),
};
