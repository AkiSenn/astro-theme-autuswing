export const client = () =>
  JSON.parse(document.querySelector('#autuswing-config')?.textContent || '{}');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export function isLiveSite() {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel=canonical]');
  return (
    document.body.dataset.preview !== 'true' &&
    !!canonical &&
    location.hostname === new URL(canonical.href).hostname
  );
}
let toastTimer: ReturnType<typeof setTimeout>;
export function toast(message: string) {
  const node = document.querySelector<HTMLElement>('.toast');
  if (!node) return;
  clearTimeout(toastTimer);
  node.textContent = message;
  node.classList.add('visible');
  toastTimer = setTimeout(() => node.classList.remove('visible'), 2400);
}
export async function copy(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const ok = document.execCommand('copy');
  input.remove();
  if (!ok) throw new Error('Clipboard unavailable');
}
const scripts = new Map<string, Promise<void>>();
export function script(src: string, attrs: Record<string, string> = {}) {
  const existing = scripts.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const timer = setTimeout(() => {
      el.remove();
      scripts.delete(src);
      reject(new Error('Resource timed out'));
    }, 20000);
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      el.remove();
      scripts.delete(src);
      reject(new Error('Resource unavailable'));
    };
    document.head.append(el);
  });
  scripts.set(src, promise);
  return promise;
}
export function css(src: string) {
  if (
    [...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')].some(
      (x) => x.href === new URL(src, location.href).href,
    )
  )
    return;
  const el = document.createElement('link');
  el.rel = 'stylesheet';
  el.href = src;
  document.head.append(el);
}
export const idle = (callback: () => void) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(callback, { timeout: 2000 })
    : setTimeout(callback, 150);
declare global {
  interface Window {
    Autuswing: { copy: typeof copy; toast: typeof toast; openMenu?: () => void };
  }
}
window.Autuswing = { copy, toast };
