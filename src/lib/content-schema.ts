import { z } from 'astro/zod';
import { parseDate } from './dates';

const date = z.string().refine((value) => {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}, 'Use a valid calendar date, preferably ISO 8601 with a timezone');

// Unknown legacy/custom fields remain available to the author and renderer.
export const contentSchema = z.looseObject({
  title: z.string().refine((value) => !!value.trim(), 'Title must not be empty'),
  date,
  updated: date.optional(),
  id: z.union([z.string(), z.number()]).optional(),
  abbrlink: z.union([z.string(), z.number()]).optional(),
  permalink: z.string().optional(),
  description: z.string().optional(),
  excerpt: z.string().optional(),
  author: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  categories: z.union([z.string(), z.array(z.union([z.string(), z.array(z.string())]))]).optional(),
  draft: z.boolean().optional(),
  published: z.boolean().optional(),
  noindex: z.boolean().optional(),
  search: z.boolean().optional(),
  feed: z.boolean().optional(),
  // 只兼容旧空字段；历史非空值也须停下确认公开意图，不能自动转为可索引。
  password: z.string().refine(
    (value) => value.length === 0,
    'password 不提供加密或访问保护，禁止使用非空值。历史文章请先确认公开意图；仅禁止收录请显式使用 noindex: true，保密内容请设为草稿或 published: false，并在确认后迁移此字段。',
  ).optional(),
  comments: z.boolean().optional(),
  comment_id: z.union([z.string(), z.number()]).optional(),
  toc: z.boolean().optional(),
  math: z.union([z.boolean(), z.string()]).optional(),
  mathjax: z.boolean().optional(),
  katex: z.boolean().optional(),
  cover: z.string().optional(),
  wallpaper: z.union([z.string(), z.boolean()]).optional(),
  type: z.string().optional(),
  lang: z.string().optional(),
  language: z.string().optional(),
  series: z.string().optional(),
  series_order: z.number().int().positive().optional(),
});

export function isPublished(data: { draft?: boolean; published?: boolean }) {
  return data.draft !== true && data.published !== false;
}
