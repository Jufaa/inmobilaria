import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireAgencyCatalogueEditAccess } from '@/lib/agency-access';
import { isPropertyPhotoPath, propertyPhotoContentTypes, propertyPhotoMaxBytes } from '@/lib/properties/property-photo-policy';

const maxBodyBytes = 16 * 1024;

async function readBody(request: Request): Promise<HandleUploadBody> {
  if (!request.body) throw new Error('Missing upload request');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBodyBytes) { await reader.cancel(); throw new Error('Upload request too large'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  return JSON.parse(text) as HandleUploadBody;
}

export async function POST(request: Request, context: { params: Promise<{ agencyId: string }> }) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return Response.json({ error: 'La carga de fotos no está configurada.' }, { status: 503 });
  try {
    const body = await readBody(request);
    const { agencyId: slug } = await context.params;
    const result = await handleUpload({
      request,
      body,
      token,
      onBeforeGenerateToken: async pathname => {
        const { membership } = await requireAgencyCatalogueEditAccess(slug);
        if (!isPropertyPhotoPath(pathname, membership.agency.id)) throw new Error('Invalid upload path');
        return {
          allowedContentTypes: propertyPhotoContentTypes,
          maximumSizeInBytes: propertyPhotoMaxBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
      // Completion callbacks are authenticated by the Blob SDK signature, not browser cookies.
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: 'No se pudo autorizar la carga de fotos.' }, { status: 400 });
  }
}
