const municipalWmsUrl = 'https://mapas.riocuarto.gob.ar/cgi-bin/mapserv?map=/var/www/html/webriocuarto/V1/rioiv/htdocs/servicios_wms.map';

export const runtime = 'nodejs';
export const revalidate = 86_400;

export async function GET() {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: 'Vecinales',
    STYLES: '',
    SRS: 'EPSG:22174',
    BBOX: '4367952,6329105,4377733,6340060',
    WIDTH: '1200',
    HEIGHT: '1100',
    FORMAT: 'application/vnd.google-earth.kml+xml',
  });

  try {
    const response = await fetch(`${municipalWmsUrl}&${params}`, {
      headers: { Accept: 'application/vnd.google-earth.kml+xml, application/xml' },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate },
    });
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (!response.ok || !contentType?.includes('xml')) {
      return new Response('No se pudo cargar la capa municipal.', {
        status: 502,
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
      });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('No se pudo cargar la capa municipal.', {
      status: 502,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  }
}
