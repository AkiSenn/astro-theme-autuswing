import { parseDate } from './dates';
import { isPublished } from './content-schema';

type ArticleDates = {
  date: string;
  updated?: string;
  draft?: boolean;
  published?: boolean;
  noindex?: boolean;
  password?: string;
};

export function cardUpdated(data: ArticleDates, now = Date.now()) {
  if (!isPublished(data) || data.noindex === true || data.password || !data.updated)
    return undefined;
  try {
    const published = Date.parse(parseDate(data.date));
    const datetime = parseDate(data.updated);
    const updated = Date.parse(datetime);
    if (!Number.isFinite(now) || updated > now) return undefined;
    // 固定 UTC+8，不采用 Asia/Shanghai 的历史夏令时；分组和文案使用同一偏移。
    const offset = 8 * 60 * 60 * 1000;
    const publishedDay = Math.floor((published + offset) / 86_400_000);
    const updatedDay = Math.floor((updated + offset) / 86_400_000);
    if (updatedDay <= publishedDay) return undefined;
    const label = new Date(updated + offset).toISOString().slice(0, 10);
    return { datetime, label };
  } catch {
    return undefined;
  }
}
