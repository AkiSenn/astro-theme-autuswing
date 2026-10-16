import { initAppearance } from './appearance';
import { initResponsive } from './responsive';
import { initSearch } from './search';
import { initReading } from './reading';
import { initMedia } from './media';
import { initPwa } from './pwa';
import { isLiveSite } from './helpers';
for (const init of [initAppearance, initResponsive, initSearch, initReading, initMedia, initPwa]) {
  try {
    init();
  } catch (error) {
    console.error('AutuSwing enhancement failed', error);
  }
}
import './avatar.js';
import './animations.js';
import './runtime.js';
import './statistics.js';
import './math-renderer.js';
import './analytics.js';
import './prefetch.js';
if (isLiveSite() && document.querySelector('#comments')) import('./comments.js');
