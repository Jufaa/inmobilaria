/** Local safety limits, not a substitute for validation by a future upload service. */
export const TOUR360_MAX_BYTES = 20 * 1024 * 1024;
export const TOUR360_MAX_DIMENSION = 8192;
export const TOUR360_MAX_PIXELS = 8192 * 4096;
export const TOUR360_ACCEPT = 'image/jpeg,image/png,image/webp';

export type Tour360UploadAdapter = (request: {
  propertyId: string;
  file: File;
  signal: AbortSignal;
}) => Promise<{ url: string }>;

export function validateTour360File(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Selecciona una imagen JPEG, PNG o WebP.';
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > TOUR360_MAX_BYTES) {
    return 'La imagen debe pesar entre 1 byte y 20 MiB.';
  }
  return null;
}

export function validateTour360Dimensions(width: number, height: number): string | null {
  if (![width, height].every(value => Number.isInteger(value) && value > 0)
    || width > TOUR360_MAX_DIMENSION || height > TOUR360_MAX_DIMENSION
    || width * height > TOUR360_MAX_PIXELS) {
    return 'La imagen supera el límite de 8192 píxeles por lado o 33,6 megapíxeles.';
  }
  const ratio = width / height;
  if (ratio < 1.9 || ratio > 2.1) {
    return 'Usa un panorama equirectangular 360° con proporción aproximada 2:1.';
  }
  return null;
}

export function isSafeTour360Url(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}
