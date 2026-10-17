import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharpService from 'astro/assets/services/sharp';
import { imageMetadata } from 'astro/assets/utils';
let cachedKey, cached;
const digest = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16);

// Reuse Astro's installed image service. No second image library or logo source.
/** @returns {Promise<Array<{src:string,sizes:string,type:string,purpose:string,data:Uint8Array}>>} */
export async function pwaIcons(source) {
  if (!source?.startsWith('/') || source.startsWith('//'))
    throw new Error('PWA icon must be a local public image');
  const publicRoot = path.resolve('public'),
    file = path.resolve(publicRoot, '.' + source.split(/[?#]/)[0]);
  if (!file.startsWith(publicRoot + path.sep)) throw new Error('Invalid PWA icon path');
  const input = await fs.readFile(file),
    key = source + digest(input);
  if (key === cachedKey) return cached;
  cachedKey = key;
  cached = (async () => {
    const metadata = await imageMetadata(input, file);
    if (metadata.width < 512 || metadata.height < 512)
      throw new Error('PWA source image must be at least 512×512');
    const config = { service: { config: {} }, dangerouslyProcessSVG: true };
    const assets = [];
    for (const size of [192, 512]) {
      const { data } = await sharpService.transform(
        input,
        { src: source, width: size, height: size, fit: 'cover', format: 'webp', quality: 85 },
        config,
        console,
      );
      assets.push({
        src: `/pwa/icon-${size}.${digest(data)}.webp`,
        sizes: `${size}x${size}`,
        type: 'image/webp',
        purpose: 'any',
        data,
      });
    }
    // The complete square artwork fits inside the maskable 80% safe circle.
    const inputMime =
      metadata.format === 'svg'
        ? 'image/svg+xml'
        : metadata.format === 'jpg'
          ? 'image/jpeg'
          : 'image/' + metadata.format;
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#31594a"/><image x="112" y="112" width="288" height="288" href="data:${inputMime};base64,${input.toString('base64')}"/></svg>`,
    );
    const { data } = await sharpService.transform(
      svg,
      { src: 'trusted-local-maskable.svg', width: 512, height: 512, format: 'webp', quality: 85 },
      config,
      console,
    );
    assets.push({
      src: `/pwa/maskable-512.${digest(data)}.webp`,
      sizes: '512x512',
      type: 'image/webp',
      purpose: 'maskable',
      data,
    });
    return assets;
  })();
  return cached;
}
