import { NextResponse, type NextRequest } from 'next/server';
import { publicAnalyticsTypes, recordPublicNavigationEvent, type PublicAnalyticsInput } from '@/lib/analytics/public-analytics-service';

const maxBodyBytes = 4_096;
const maxEventsPerMinute = 600;
let windowStartedAt = Date.now();
let acceptedInWindow = 0;

function consumeProcessBudget() {
  const now = Date.now();
  if (now - windowStartedAt >= 60_000) {
    windowStartedAt = now;
    acceptedInWindow = 0;
  }
  if (acceptedInWindow >= maxEventsPerMinute) return false;
  acceptedInWindow += 1;
  return true;
}

async function readSmallBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

const validEnums = {
  operation: ['SALE', 'RENT'],
  propertyType: ['APARTMENT', 'HOUSE', 'PH', 'LAND', 'COMMERCIAL', 'OTHER'],
  currency: ['ARS', 'USD'],
} as const;

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && allowed.includes(value);
}

export async function POST(request: NextRequest) {
  if (!consumeProcessBudget()) {
    return NextResponse.json({ error: 'Límite temporal alcanzado.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }
  const statedLength = Number(request.headers.get('content-length') ?? 0);
  if (statedLength > maxBodyBytes) {
    return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }
  const raw = await readSmallBody(request);
  if (raw === null) {
    return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['type', 'presentingAgencySlug', 'propertyId', 'propertyIds', 'zoneId', 'operation', 'propertyType', 'currency', 'bedroomsFrom', 'neighborhood']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key)) || !isOneOf(body.type, publicAnalyticsTypes)) {
    return NextResponse.json({ error: 'Evento inválido.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (
    (body.propertyId !== undefined && (typeof body.propertyId !== 'string' || body.propertyId.length > 64)) ||
    (body.presentingAgencySlug !== undefined && (typeof body.presentingAgencySlug !== 'string' || body.presentingAgencySlug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.presentingAgencySlug))) ||
    (body.zoneId !== undefined && (typeof body.zoneId !== 'string' || body.zoneId.length > 64)) ||
    (body.operation !== undefined && !isOneOf(body.operation, validEnums.operation)) ||
    (body.propertyType !== undefined && !isOneOf(body.propertyType, validEnums.propertyType)) ||
    (body.currency !== undefined && !isOneOf(body.currency, validEnums.currency)) ||
    (body.bedroomsFrom !== undefined && (!Number.isInteger(body.bedroomsFrom) || Number(body.bedroomsFrom) < 0 || Number(body.bedroomsFrom) > 50)) ||
    (body.neighborhood !== undefined && (typeof body.neighborhood !== 'string' || body.neighborhood.length > 120)) ||
    (body.propertyIds !== undefined && (!Array.isArray(body.propertyIds) || body.propertyIds.length > 48 || body.propertyIds.some((id) => typeof id !== 'string' || id.length > 64)))
  ) {
    return NextResponse.json({ error: 'Dimensiones inválidas.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const input = {
    type: body.type,
    ...(typeof body.presentingAgencySlug === 'string' ? { presentingAgencySlug: body.presentingAgencySlug } : {}),
    ...(typeof body.propertyId === 'string' ? { propertyId: body.propertyId } : {}),
    ...(Array.isArray(body.propertyIds) ? { propertyIds: body.propertyIds as string[] } : {}),
    ...(typeof body.zoneId === 'string' ? { zoneId: body.zoneId } : {}),
    ...(isOneOf(body.operation, validEnums.operation) ? { operation: body.operation } : {}),
    ...(isOneOf(body.propertyType, validEnums.propertyType) ? { propertyType: body.propertyType } : {}),
    ...(isOneOf(body.currency, validEnums.currency) ? { currency: body.currency } : {}),
    ...(typeof body.bedroomsFrom === 'number' ? { bedroomsFrom: body.bedroomsFrom } : {}),
    ...(typeof body.neighborhood === 'string' ? { neighborhood: body.neighborhood } : {}),
  } as PublicAnalyticsInput;

  try {
    await recordPublicNavigationEvent(input);
    return new NextResponse(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo registrar el evento.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
