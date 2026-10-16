import zh from '../config/zh-CN.json';
import en from '../config/default.json';
import site from '../config/site.json';
export function translate(language = site.language) {
  const labels = (language.toLowerCase().startsWith('en') ? en : zh) as Record<string, string>;
  return (key: string) => labels[key] || key;
}
