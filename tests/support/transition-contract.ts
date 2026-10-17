import assert from 'node:assert/strict';
import { expect, test, type Page } from '@playwright/test';

export type TransitionCapabilities = {
  sameDocument: boolean;
  pageReveal: boolean;
  pageSwap: boolean;
  cssRule: boolean;
  navigationAuto: boolean;
};
export function transitionMode(capabilities: TransitionCapabilities) {
  const crossDocument = [
    capabilities.pageReveal,
    capabilities.pageSwap,
    capabilities.cssRule,
    capabilities.navigationAuto,
  ];
  assert.ok(
    crossDocument.every(Boolean) || crossDocument.every((value) => !value),
    'Partial/new cross-document support needs an explicit contract review',
  );
  return crossDocument.every(Boolean) ? 'native' : 'fallback';
}
export async function inspectTransitionMode(page: Page, browserName: string) {
  const capabilities = await page.evaluate(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@view-transition { navigation: auto; }');
    return {
      sameDocument: typeof document.startViewTransition === 'function',
      pageReveal: 'PageRevealEvent' in window,
      pageSwap: 'PageSwapEvent' in window,
      cssRule: 'CSSViewTransitionRule' in window,
      navigationAuto: [...sheet.cssRules].some((rule) => (rule as any).navigation === 'auto'),
    };
  });
  const mode = transitionMode(capabilities);
  // Pinned capabilities of the tested runtimes, not a silent feature-based skip.
  // If an engine gains/loses support, fail and require a contract review.
  expect(mode, `Cross-document capability changed: ${JSON.stringify(capabilities)}`).toBe(
    browserName === 'firefox' ? 'fallback' : 'native',
  );
  test.info().annotations.push({
    type: 'transition-contract',
    description: JSON.stringify({ mode, capabilities }),
  });
  return mode;
}
export async function assertUnanimatedNavigation(page: Page) {
  const state = await page.evaluate(() => ({
    animations: document
      .getAnimations()
      .filter((a: any) => ['autuswing-page-in', 'autuswing-page-out'].includes(a.animationName))
      .length,
    opacity: getComputedStyle(document.querySelector('#main')!).opacity,
    transform: getComputedStyle(document.querySelector('#main')!).transform,
    modal: !!document.querySelector(':modal'),
  }));
  expect(state).toEqual({ animations: 0, opacity: '1', transform: 'none', modal: false });
  await expect(page.locator('main h1').first()).toBeVisible();
}
