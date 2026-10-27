// Narrow SDK boundary: Google's browser library is loaded only after entering a zone.
export type Google3DMap = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number }; range: number; tilt: number; heading: number;
};
export type Google3DLibrary = {
  Map3DElement: new (options: Record<string, unknown>) => Google3DMap;
  Marker3DInteractiveElement: new (options: Record<string, unknown>) => HTMLElement;
};
type SDKHost = {
  document: Pick<Document, 'createElement' | 'head' | 'querySelector'>;
  google?: { maps?: { importLibrary?: (name: string) => Promise<Google3DLibrary> } };
  __territorioGoogle3DReady?: () => void;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timer: unknown) => void;
};
const unavailable = () => new Error('No se pudo cargar Google 3D. Revisa la conexión, la clave de demostración o su cuota diaria.');

export function createGoogleMaps3DLoader(host: SDKHost) {
  let pending: Promise<Google3DLibrary> | null = null;
  return function load(key: string): Promise<Google3DLibrary> {
    if (!key.trim()) return Promise.reject(new Error('Falta configurar la clave de demostración de Google.'));
    if (pending) return pending;
    pending = new Promise<Google3DLibrary>((resolve, reject) => {
      let script: HTMLScriptElement | null = null;
      let settled = false;
      const cleanup = () => { host.clearTimeout(timer); delete host.__territorioGoogle3DReady; };
      const fail = () => {
        if (settled) return;
        settled = true; cleanup(); script?.remove(); reject(unavailable());
      };
      const timer = host.setTimeout(fail, 25000);
      const ready = () => {
        const maps = host.google?.maps;
        if (!maps?.importLibrary) { fail(); return; }
        maps.importLibrary('maps3d').then((library) => {
          if (settled) return;
          if (!library.Map3DElement || !library.Marker3DInteractiveElement) { fail(); return; }
          settled = true; cleanup(); resolve(library);
        }, fail);
      };
      if (host.google?.maps?.importLibrary) { ready(); return; }
      host.__territorioGoogle3DReady = ready;
      script = host.document.createElement('script');
      const params = new URLSearchParams({ key: key.trim(), v: 'weekly', loading: 'async', callback: '__territorioGoogle3DReady' });
      script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
      script.async = true;
      script.nonce = host.document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce ?? '';
      script.onerror = fail;
      host.document.head.append(script);
    }).catch((error) => { pending = null; throw error; });
    return pending;
  };
}
let browserLoader: ReturnType<typeof createGoogleMaps3DLoader> | null = null;
export function loadGoogleMaps3D(key: string): Promise<Google3DLibrary> {
  if (typeof window === 'undefined') return Promise.reject(unavailable());
  browserLoader ??= createGoogleMaps3DLoader(window as unknown as SDKHost);
  return browserLoader(key);
}
