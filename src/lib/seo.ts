import { site, theme } from '../site.config';
import { absolute } from './urls';
import type { Post } from './content';
export function seo(path: string, title = '', post?: Post) {
  const fullTitle = title ? `${title} · ${site.title}` : site.title;
  const description = post?.data.description || post?.excerpt || site.description;
  const image = absolute(
    post?.data.cover ||
      post?.html.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1] ||
      theme.seo.social_image ||
      theme.avatar,
  );
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
        image: [image],
        datePublished: post.date,
        dateModified: post.updated,
        author: { '@type': 'Person', name: post.data.author || theme.profile.author },
        publisher: {
          '@type': 'Organization',
          name: site.title,
          logo: { '@type': 'ImageObject', url: absolute(theme.avatar) },
        },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.title,
        description: site.description,
        url: absolute('/'),
      };
  return { title: fullTitle, description, image, article, url, schema };
}
export const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
