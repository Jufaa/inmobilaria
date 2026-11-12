'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { normalizeHexColor, panelBrandStyles } from '@/lib/panel-colors';

export const panelBrandPreviewEvent = 'territorio:panel-brand-preview';
type Preview = { agencySlug: string; color: string | null; baseColor: string | null };

export function previewPanelBrandColor(agencySlug: string, value: unknown): boolean {
  if (!agencySlug || typeof window === 'undefined') return false;
  const color = value === '' || value === null ? null : normalizeHexColor(value);
  if (color === null && value !== '' && value !== null) return false;
  window.dispatchEvent(new CustomEvent(panelBrandPreviewEvent, { detail: { agencySlug, color } }));
  return true;
}

export function PanelBrandTheme({ agencySlug, initialColor, className, children }: {
  agencySlug: string;
  initialColor?: string | null;
  className?: string;
  children?: ReactNode;
}) {
  const persisted = normalizeHexColor(initialColor);
  const [preview, setPreview] = useState<Preview | null>(null);
  const activeColor = preview?.agencySlug === agencySlug && preview.baseColor === persisted ? preview.color : persisted;
  useEffect(() => {
    setPreview(null);
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ agencySlug?: unknown; color?: unknown }>).detail;
      if (!detail || detail.agencySlug !== agencySlug) return;
      const color = detail.color === null ? null : normalizeHexColor(detail.color);
      if (color === null && detail.color !== null) return;
      setPreview({ agencySlug, color, baseColor: persisted });
    };
    window.addEventListener(panelBrandPreviewEvent, receive);
    return () => window.removeEventListener(panelBrandPreviewEvent, receive);
  }, [agencySlug, persisted]);

  return <div className={className} data-panel-brand={activeColor ? 'custom' : undefined} style={panelBrandStyles(activeColor) as CSSProperties}>{children}</div>;
}
