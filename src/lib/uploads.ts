import { mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { uploadsDir } from './db';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from './validation';

export const MEDIA_PREFIX = '/media/uploads/';
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export class UploadError extends Error {}

export function isUploadedImage(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(MEDIA_PREFIX);
}

/** Resolves a stored media URL to an absolute path inside the uploads folder. */
export function resolveMediaPath(fileName: string): string | null {
  const uploads = uploadsDir();
  const target = path.resolve(uploads, fileName);
  if (target !== uploads && !target.startsWith(uploads + path.sep)) return null;
  return target;
}

export function mediaUrlFor(fileName: string): string {
  return `${MEDIA_PREFIX}${fileName}`;
}

/** Stores an uploaded image on disk and returns the public URL to store in the database. */
export async function saveUploadedImage(file: File): Promise<string> {
  const type = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    throw new UploadError('Upload a JPG, PNG, WEBP, GIF or AVIF image.');
  }
  if (file.size === 0) throw new UploadError('The selected image is empty.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UploadError('Images must be 5MB or smaller.');
  }

  const extension = EXTENSIONS[type];
  const fileName = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  mkdirSync(uploadsDir(), { recursive: true });
  writeFileSync(resolveMediaPath(fileName)!, buffer);

  return mediaUrlFor(fileName);
}

/** Deletes a previously uploaded image (only files inside the uploads folder). */
export function removeUploadedImage(url: string | null | undefined) {
  if (!isUploadedImage(url)) return;
  const fileName = url!.slice(MEDIA_PREFIX.length);
  const target = resolveMediaPath(fileName);
  if (target && existsSync(target)) {
    try {
      unlinkSync(target);
    } catch (error) {
      console.warn('[uploads] could not delete image', fileName, error);
    }
  }
}

export function contentTypeFor(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const found = Object.entries(EXTENSIONS).find(([, ext]) => ext === extension.slice(1));
  return found ? found[0] : 'application/octet-stream';
}
