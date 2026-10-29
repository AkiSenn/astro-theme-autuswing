import { parseDate, formatDate } from './dates';
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
    const published = parseDate(data.date);
    const datetime = parseDate(data.updated);
    if (
      !Number.isFinite(now) ||
      Date.parse(datetime) <= Date.parse(published) ||
      Date.parse(datetime) > now
    )
      return undefined;
    const label = formatDate(datetime, '-');
    // 首页只展示日期，同一 UTC+8 日历日不重复提示更新。
    if (label === formatDate(published, '-')) return undefined;
    return { datetime, label };
  } catch {
    return undefined;
  }
}
