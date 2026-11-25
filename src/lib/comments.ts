import { theme, preview } from '../site.config';
import { absolute } from './urls';
export function commentSettings(
  page: { path: string; title: string; data?: { comments?: boolean; comment_id?: unknown } },
  isPost = true,
) {
  const c = theme.comments;
  if (
    preview ||
    !c.enable ||
    page.data?.comments === false ||
    (!isPost && !c.pages && page.data?.comments !== true)
  )
    return null;
  const providers = c as unknown as Record<string, Record<string, unknown>>;
  const p = providers[c.provider] || {};
  const ready = (
    {
      giscus: !!(p.repo && p.repo_id && p.category_id),
      utterances: /^[\w.-]+\/[\w.-]+$/.test(String(p.repo || '')),
      disqus: /^[\w-]+$/.test(String(p.shortname || '')),
      waline: /^https?:\/\//.test(String(p.serverURL || '')),
      twikoo: !!p.envId,
      valine: !!(p.appid && p.appkey),
    } as Record<string, boolean>
  )[c.provider];
  if (!ready) throw new Error(`Comments enabled but ${c.provider} configuration is incomplete`);
  return {
    ...p,
    provider: c.provider,
    lazyload: c.lazyload,
    preload: c.preload,
    collapsible: c.collapsible,
    timeout: c.timeout,
    canonical: absolute(page.path),
    identifier: String(page.data?.comment_id ?? page.path),
    title: page.title,
  };
}
