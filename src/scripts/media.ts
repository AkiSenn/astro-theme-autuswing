import { client, copy, toast } from './helpers';
import { openDialog, restoreDialogFocus } from './dialogs';
export function initMedia() {
  const config = client();
  document.querySelectorAll<HTMLElement>('.prose pre').forEach((block) => {
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
    wrapper.append(toolbar, block);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = config.labels.copy;
    button.setAttribute('aria-label', `${config.labels.copy} (${language})`);
    button.addEventListener('click', async () => {
      try {
        await copy(code.textContent || '');
        toast(config.labels.copied);
      } catch {
        toast(config.labels.shareError);
      }
    });
    toolbar.append(button);
  });
  const canonical = () => document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href;
  document.querySelectorAll('.copy-link,.share-copy').forEach((button) =>
    button.addEventListener('click', async () => {
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
    button.addEventListener('click', async () => {
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
  if (!config.article.lightbox || !dialog) return;
  let trigger: HTMLElement | null = null;
  const preview = dialog.querySelector('img')!;
  document.querySelectorAll<HTMLImageElement>('.prose img').forEach((img) => {
    if (img.closest('a')) return;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `预览图片：${img.alt || '文章配图'}`);
    const open = () => {
      trigger = img;
      preview.src = img.currentSrc || img.src;
      preview.alt = img.alt;
      openDialog(dialog);
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
  dialog.querySelector('.image-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => restoreDialogFocus(trigger));
}
