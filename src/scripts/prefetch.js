import { client } from './helpers';
const config = client();
(() => {
  try {
    if (
      !config.instantNav ||
      navigator.connection?.saveData ||
      /(^|-)2g$/.test(navigator.connection?.effectiveType || '') ||
      !HTMLScriptElement.supports?.('speculationrules')
    )
      return;
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prefetch: [
        {
          source: 'document',
          where: {
            and: [
              { href_matches: config.root + '*' },
              { not: { href_matches: '*.{xml,json,js,css,png,jpg,webp,zip,pdf}' } },
              { not: { selector_matches: '[download], [target="_blank"], [href*="#"]' } },
            ],
          },
          eagerness: 'moderate',
        },
      ],
    });
    document.head.append(rules);
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
