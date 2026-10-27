'use client';

import { useEffect } from 'react';

export type PublicAnalyticsPayload = {
  type: 'LISTING_VIEW' | 'PROPERTY_VIEW' | 'SEARCH' | 'ZONE_SELECTION';
  presentingAgencySlug?: string;
  propertyId?: string;
  propertyIds?: string[];
  zoneId?: string;
  operation?: string;
  propertyType?: string;
  currency?: string;
  bedroomsFrom?: number;
  neighborhood?: string;
};

export function trackPublicAnalytics(payload: PublicAnalyticsPayload) {
  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
    referrerPolicy: 'no-referrer',
  }).catch(() => undefined);
}

export function PublicAnalyticsEvent({ payload }: { payload: PublicAnalyticsPayload }) {
  const serializedPayload = JSON.stringify(payload);
  useEffect(() => {
    trackPublicAnalytics(JSON.parse(serializedPayload) as PublicAnalyticsPayload);
  }, [serializedPayload]);
  return null;
}
