import zh from '../config/zh-CN.json';
import en from '../config/default.json';
import { siteIdentity as site } from './site-identity.mjs';
export function translate(language = site.language) {
  const labels = (language.toLowerCase().startsWith('en') ? en : zh) as Record<string, string>;
  return (key: string) => labels[key] || key;
}
