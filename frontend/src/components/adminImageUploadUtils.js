export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(file, allowAvif = false) {
  const extension = file?.name?.toLowerCase().match(/\.(jpe?g|png|webp|avif)$/)?.[1];
  const typeByExtension = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
  const expectedType = extension && typeByExtension[extension];
  if (!file || !expectedType || (extension === 'avif' && !allowAvif) || (file.type && (file.type !== expectedType || (!ACCEPTED_IMAGE_TYPES.has(file.type) && !(allowAvif && file.type === 'image/avif'))))) return allowAvif ? 'Choose a JPG, JPEG, PNG, WEBP or AVIF image.' : 'Choose a JPG, JPEG, PNG or WEBP image.';
  if (file.size > MAX_IMAGE_SIZE) return 'Images must be 5 MB or smaller.';
  return '';
}

export function addImage(images, url, single = false) {
  return single ? [url] : [...images, url];
}

export function replaceImage(images, index, url) {
  if (index < 0 || index >= images.length) return images;
  const next = [...images];
  next[index] = url;
  return next;
}

export function removeImage(images, index) {
  return images.filter((_image, imageIndex) => imageIndex !== index);
}

export function moveImage(images, from, to) {
  if (from < 0 || from >= images.length || to < 0 || to >= images.length) return images;
  const next = [...images];
  const [image] = next.splice(from, 1);
  next.splice(to, 0, image);
  return next;
}
