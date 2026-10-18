import type { BrowserContext } from '@playwright/test';
import postcss from 'postcss';

// Targeted missing-capability model, not an iOS emulator. Preserve UA and
// viewport. The first rule models the UA defaults of an unknown <dialog>;
// the product's explicit closed-state/fallback styles must override it.
export async function legacySafariComponents(context: BrowserContext) {
  await context.addInitScript(() => {
    for (const key of ['showModal', 'show', 'close', 'open'])
      delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[key];
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).inert;
    delete (Array.prototype as unknown as Record<string, unknown>).at;
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function () {
      focus.call(this);
    };
  });
  await context.route('**/*.css', async (route) => {
    const response = await route.fetch();
    const root = postcss.parse(await response.text());
    root.walkAtRules(/^(container|starting-style)$/i, (rule) => rule.remove());
    root.walkRules((rule) => {
      if (rule.selector.includes(':has(')) rule.remove();
    });
    root.walkDecls((decl) => {
      if (/\b\d*(?:d|s|l)vh\b/.test(decl.value)) decl.remove();
    });
    await route.fulfill({
      response,
      body: 'dialog{display:inline;position:static;margin:0;max-width:none}\n' + root.toString(),
    });
  });
}
