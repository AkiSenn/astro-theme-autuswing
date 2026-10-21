import { client } from './helpers';

// 按已批准契约独立组织；接口依据 HTML Standard 的 Speculative loading。
// https://html.spec.whatwg.org/multipage/speculative-loading.html
/** @param {string} root */
export function createPrefetchRules(root) {
  const resources = ['xml', 'json', 'js', 'css', 'png', 'jpg', 'webp', 'zip', 'pdf'];
  return {
    prefetch: [
      {
        source: 'document',
        eagerness: 'moderate',
        where: {
          and: [
            { href_matches: root + '*' },
            { not: { selector_matches: '[download], [target="_blank"], [href*="#"]' } },
            // 使用浏览器已验证的绝对路径字符串；逐项 or，查询参数不改变扩展名匹配。
            {
              not: {
                or: resources.map((extension) => ({
                  href_matches: '/*.' + extension,
                })),
              },
            },
          ],
        },
      },
    ],
  };
}

export function initPrefetch() {
  try {
    const options = client();
    if (!options.instantNav) return;
    if (
      typeof HTMLScriptElement === 'undefined' ||
      typeof HTMLScriptElement.supports !== 'function'
    )
      return;
    if (!HTMLScriptElement.supports('speculationrules')) return;
    const network = navigator.connection;
    if (
      network?.saveData ||
      network?.effectiveType === '2g' ||
      network?.effectiveType === 'slow-2g'
    )
      return;
    // 同一文档重复初始化或重新求值模块时，复用已安装规则，不增加监听器。
    if (document.querySelector('script[data-autuswing-prefetch]')) return;
    const element = document.createElement('script');
    element.type = 'speculationrules';
    element.setAttribute('data-autuswing-prefetch', '');
    element.textContent = JSON.stringify(createPrefetchRules(options.root));
    document.head.appendChild(element);
  } catch (error) {
    console.warn('Autuswing prefetch unavailable', error);
  }
}

initPrefetch();
