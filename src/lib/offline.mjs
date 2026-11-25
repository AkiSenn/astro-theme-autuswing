import { siteIdentity as site } from './site-identity.mjs';
import { escapeAttribute, escapeText } from 'entities';
import { getDeployment } from './deployment.mjs';
import zh from '../config/zh-CN.json' with { type: 'json' };
import en from '../config/default.json' with { type: 'json' };

// 离线端点与 SW 共用同一文档，避免版本校验出现字节差异。
export function offlineDocument(
  author = site.author,
  home = getDeployment().basePath,
  language = site.language,
) {
  const labels = language.toLowerCase().startsWith('en') ? en : zh;
  return `<!doctype html><html lang="${escapeAttribute(language)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${escapeText(labels.offline_title)} · ${escapeText(author)}</title><style>body{font:18px/1.8 system-ui;max-width:40em;margin:15vh auto;padding:24px;background:#f5f4f0;color:#244638}a{color:inherit}</style><h1>${escapeText(labels.offline_title)}</h1><p>${escapeText(labels.offline_description)}</p><a href="${escapeAttribute(home)}">${escapeText(labels.back_home)}</a></html>`;
}
export const offlineHtml = offlineDocument();
