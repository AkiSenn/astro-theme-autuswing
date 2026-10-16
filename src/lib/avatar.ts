import { getImage } from 'astro:assets';
import { theme } from '../site.config';
import defaultAvatar from '../../public/img/avatar.png';

// Astro owns resizing, hashing and caching. Keep the original public URL/file
// available and preserve remote/custom formats without fetching new hosts.
export async function avatarSource() {
  const pathname = theme.avatar.split(/[?#]/, 1)[0];
  if (pathname === '/img/avatar.png') {
    return (
      await getImage({
        src: defaultAvatar,
        width: 144,
        height: 144,
        format: 'webp',
        quality: 85,
        fit: 'cover',
      })
    ).src;
  }
  return theme.avatar;
}
