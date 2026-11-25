import { mountReference } from './deployment.mjs';
import { getImage } from 'astro:assets';
import avatar from 'virtual:autuswing-avatar';
import { site } from '../site.config';

export async function avatarSource() {
  if (!avatar) return site.avatar && mountReference(site.avatar);
  return (
    await getImage({
      src: avatar,
      width: 144,
      height: 144,
      format: 'webp',
      quality: 85,
      fit: 'cover',
    })
  ).src;
}
