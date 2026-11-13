export const propertyPhotoMaxBytes = 5 * 1024 * 1024;
export const propertyPhotoMaxCount = 6;
export const propertyPhotoContentTypes = ['image/jpeg', 'image/png', 'image/webp'];

export function isPropertyPhotoPath(pathname: string, agencyId: string): boolean {
  if (!/^[a-zA-Z0-9_-]+$/.test(agencyId)) return false;
  const prefix = `agencies/${agencyId}/`;
  return pathname.startsWith(prefix)
    && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/.test(pathname.slice(prefix.length));
}

function photoPath(raw: string, agencyId: string): string {
  const url = new URL(raw);
  if (raw.length > 2048 || url.href !== raw || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)
    || !isPropertyPhotoPath(url.pathname.slice(1), agencyId)) throw new Error('Invalid property photo');
  return url.pathname.slice(1);
}

export function parsePropertyPhotoUrls(raw: string, agencyId: string): string[] {
  if (!raw) return [];
  if (raw.length > 13000) throw new Error('Invalid property photos');
  const urls: unknown = JSON.parse(raw);
  if (!Array.isArray(urls) || urls.length > propertyPhotoMaxCount || urls.some(url => typeof url !== 'string') || new Set(urls).size !== urls.length) throw new Error('Invalid property photos');
  for (const url of urls) photoPath(url, agencyId);
  return urls;
}

type PhotoMetadata = { url: string; pathname: string; contentType: string; size: number };

export async function verifyPropertyPhotos(urls: string[], agencyId: string, lookup: (pathname: string) => Promise<PhotoMetadata>): Promise<void> {
  if (urls.length > propertyPhotoMaxCount) throw new Error('Too many property photos');
  for (const url of urls) {
    const pathname = photoPath(url, agencyId);
    // Resolve by pathname with this deployment's store token, never fetch a caller's URL.
    const blob = await lookup(pathname);
    const contentType = pathname.endsWith('.jpg') ? 'image/jpeg' : pathname.endsWith('.png') ? 'image/png' : 'image/webp';
    if (blob.url !== url || blob.pathname !== pathname || blob.contentType !== contentType
      || !Number.isFinite(blob.size) || blob.size <= 0 || blob.size > propertyPhotoMaxBytes) throw new Error('Unverified property photo');
  }
}
