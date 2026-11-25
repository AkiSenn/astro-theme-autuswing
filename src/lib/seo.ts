import { site } from '../site.config';
import { absolute } from './urls';
import { getDeployment, mountReference } from './deployment.mjs';
import type { Post } from './content';
export function seo(path: string, title = '', post?: Post) {
  const fullTitle = title ? `${title} · ${site.title}` : site.title;
  const description = post?.data.description || post?.excerpt || site.description;
  const cover = post?.data.cover;
  const rendered = post?.html.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1];
  const fallback = site.seo.social_image || site.avatar;
  const atRoot = getDeployment().basePath === '/';
  const asset = (value: string) => atRoot ? absolute(value) : new URL(mountReference(value), absolute(path)).href;
  const image = cover ? asset(cover)
    : rendered ? (atRoot ? absolute(rendered) : new URL(rendered, absolute(path)).href)
    : fallback && asset(fallback);
  const author = post?.data.author || site.author;
  const authorUrl = author === site.author ? site.profile.homepage : undefined;
  const article = post?.entry.collection === 'posts',
    url = absolute(path);
  const schema = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        url,
        mainEntityOfPage: url,
        ...(image && { image: [image] }),
        datePublished: post.date,
        dateModified: post.updated,
        author: { '@type': 'Person', name: author, ...(authorUrl && { url: authorUrl }) },
        publisher: {
          '@type': 'Organization',
          name: site.title,
          ...(site.avatar && { logo: { '@type': 'ImageObject', url: asset(site.avatar) } }),
        },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.title,
        description: site.description,
        url: absolute('/'),
      };
  return { title: fullTitle, description, image, article, url, schema, author, authorUrl };
}
export const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
