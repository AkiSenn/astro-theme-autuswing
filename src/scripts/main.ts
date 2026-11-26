import { initAppearance } from './appearance';
import { initResponsive } from './responsive';
import { initSearch } from './search';
import { initReading } from './reading';
import { initMedia } from './media';
import { initPwa } from './pwa';
import { initDialogs } from './dialogs';
import { initBrand } from './brand';
import { initPageExit } from './page-exit';
import { isLiveSite } from './helpers';
for (const init of [
  initAppearance,
  initDialogs,
  initResponsive,
  initSearch,
  initReading,
  initMedia,
  initBrand,
  initPageExit,
  initPwa,
]) {
  try {
    init();
  } catch (error) {
    console.error('AutuSwing enhancement failed', error);
  }
}
import './runtime.js';
import './statistics.js';
import './analytics.js';
import './prefetch.js';
if (isLiveSite() && document.querySelector('#comments')) import('./comments.js');
