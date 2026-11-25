import { client, copy, toast } from './helpers';
import { openDialog, closeDialog, restoreDialogFocus } from './dialogs';

let disposeMedia: (() => void) | undefined;

export function initMedia() {
  disposeMedia?.();
  const config = client();
  const subscriptions: (() => void)[] = [];
  const listen = (
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) => {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  };
  document.querySelectorAll<HTMLElement>('.prose pre').forEach((block) => {
    if (block.closest('.code-block')) return;
    const code = block.querySelector('code');
    if (!code) return;
    const language =
      block.dataset.language ||
      [...code.classList].find((c) => c.startsWith('language-'))?.slice(9) ||
      'code';
    const badge = document.createElement('span');
    badge.className = 'code-language';
    badge.textContent = language;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    block.before(wrapper);
    toolbar.append(badge);
    if (block.dataset.filename) {
      const filename = document.createElement('span');
      filename.className = 'code-filename';
      filename.textContent = block.dataset.filename;
      filename.title = block.dataset.filename;
      toolbar.append(filename);
    }
    wrapper.append(toolbar, block);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = config.labels.copy;
    button.setAttribute('aria-label', `${config.labels.copy} (${language})`);
    listen(button, 'click', async () => {
      try {
        await copy(code.textContent || '');
        toast(config.labels.copied);
      } catch {
        toast(config.labels.shareError);
      }
    });
    toolbar.append(button);
  });
  document.querySelectorAll<HTMLElement>('.prose :is(h2,h3,h4,h5,h6)[id]').forEach((heading) => {
    if (heading.querySelector(':scope > .heading-link-slot')) return;
    const title = heading.textContent || '';
    heading.setAttribute('aria-label', title);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'heading-link';
    button.title = `${config.labels.copy_heading_link || '复制章节链接'}：${title}`;
    button.setAttribute('aria-label', button.title);
    // The visible hash is CSS generated, so TOC text and copied content stay clean.
    listen(button, 'click', async () => {
      try {
        const url = new URL(document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href);
        url.hash = heading.id;
        await copy(url.href);
        toast(config.labels.copied);
      } catch {
        toast(config.labels.shareError);
      }
    });
    const slot = document.createElement('span');
    slot.className = 'heading-link-slot';
    slot.append(button);
    heading.append(slot);
  });
  const canonical = () => document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href;
  document.querySelectorAll('.copy-link,.share-copy').forEach((button) =>
    listen(button, 'click', async () => {
      try {
        await copy(canonical());
        toast(config.labels.copied);
      } catch {
        toast(config.labels.shareError);
      }
    }),
  );
  document.querySelectorAll<HTMLElement>('.share-native').forEach((button) => {
    if (!navigator.share) {
      button.hidden = true;
      return;
    }
    listen(button, 'click', async () => {
      try {
        await navigator.share({
          title: document.querySelector('h1')?.textContent || document.title,
          url: canonical(),
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') toast(config.labels.shareError);
      }
    });
  });
  const dialog = document.querySelector<HTMLDialogElement>('.image-dialog');
  const cleanup = () => {
    subscriptions.splice(0).forEach((remove) => remove());
    if (disposeMedia === cleanup) disposeMedia = undefined;
  };
  listen(window, 'pagehide', (event) => {
    if (dialog?.open) closeDialog(dialog, true);
    if (!(event as PageTransitionEvent).persisted) cleanup();
  });
  if (!config.article.lightbox || !dialog) {
    disposeMedia = cleanup;
    return cleanup;
  }
  let trigger: HTMLElement | null = null;
  const preview = dialog.querySelector('img')!;
  document.querySelectorAll<HTMLImageElement>('.prose img').forEach((img) => {
    if (img.closest('a')) return;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute(
      'aria-label',
      `${config.labels.preview_image || '预览图片'}：${img.alt || config.labels.article_image || '文章配图'}`,
    );
    const open = () => {
      trigger = img;
      preview.src = img.dataset.fullsize || (img.srcset ? img.src : img.currentSrc || img.src);
      preview.alt = img.alt;
      openDialog(dialog);
    };
    listen(img, 'click', open);
    listen(img, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
  const closeButton = dialog.querySelector('.image-close');
  if (closeButton) listen(closeButton, 'click', () => closeDialog(dialog));
  listen(dialog, 'click', (e) => {
    if (e.target === dialog) closeDialog(dialog);
  });
  listen(dialog, 'close', () => {
    const replaced = dialog.dataset.replaced === 'true';
    if (replaced) {
      delete dialog.dataset.replaced;
      return;
    }
    restoreDialogFocus(trigger);
  });
  disposeMedia = cleanup;
  return cleanup;
}
