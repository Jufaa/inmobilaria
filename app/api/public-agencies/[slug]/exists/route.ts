import { NextResponse } from 'next/server';
import { getPublicAgencyStorefront } from '@/lib/agencies/public-storefront';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const storefront = await getPublicAgencyStorefront(slug);
  return NextResponse.json({ exists: Boolean(storefront) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
