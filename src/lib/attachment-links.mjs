import { mountReference } from './deployment.mjs';
import { authoredAssetReference, publicAssetFile } from './image-url.mjs';

export const pendingAttachmentScheme = 'autuswing-attachment:';

export function attachmentPath(value) {
  if (!value.startsWith('/') || value.startsWith('//')) return;
  return value.split(/[?#]/, 1)[0];
}

export function markdownAttachmentHref(value, deployment, defer) {
  const legacy = authoredAssetReference(value, deployment);
  const pathname = attachmentPath(value);
  // Collections render before getStaticPaths knows which logical routes exist.
  if (defer && pathname && !pathname.endsWith('/') &&
      (legacy !== value || publicAssetFile(pathname))) {
    return pendingAttachmentScheme + Buffer.from(value).toString('base64url');
  }
  return mountReference(legacy, deployment);
}
