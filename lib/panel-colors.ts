export const panelColorPresets = [
  { name: 'Rojo', value: '#dc2626' },
  { name: 'Naranja', value: '#ea580c' },
  { name: 'Ámbar', value: '#d97706' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Lima', value: '#84cc16' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Turquesa', value: '#0f766e' },
  { name: 'Celeste', value: '#0284c7' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Índigo', value: '#4f46e5' },
  { name: 'Violeta', value: '#9333ea' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Marrón', value: '#925f3d' },
  { name: 'Gris', value: '#64748b' },
  { name: 'Blanco', value: '#ffffff' },
] as const;

export function normalizeHexColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

export function hexToRgb(value: unknown): { r: number; g: number; b: number } | null {
  const hex = normalizeHexColor(value);
  if (!hex) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export function formatRgbColor(value: unknown): string {
  const color = hexToRgb(value);
  return color ? `RGB(${color.r}, ${color.g}, ${color.b})` : '';
}

function colorLuminance(value: string): number {
  const { r, g, b } = hexToRgb(value)!;
  return [r, g, b].map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0);
}

function colorContrast(a: string, b: string): number {
  const values = [colorLuminance(a), colorLuminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

function blendColor(value: string, target: number, amount: number): string {
  const { r, g, b } = hexToRgb(value)!;
  return `#${[r, g, b].map(channel => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function readableBrandLink(value: string, backgrounds: string[], target: number): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = blendColor(value, target, step / 20);
    if (backgrounds.every(background => colorContrast(candidate, background) >= 4.5)) return candidate;
  }
  return target === 0 ? '#000000' : '#ffffff';
}

// Only brand accents change; page surfaces and user-configured map colors remain independent.
export function panelBrandStyles(value: unknown): Record<string, string> {
  const color = normalizeHexColor(value);
  if (!color) return {};
  const foreground = colorContrast(color, '#ffffff') >= colorContrast(color, '#000000') ? '#ffffff' : '#000000';
  return {
    '--panel-accent': color,
    '--panel-accent-hover': blendColor(color, foreground === '#ffffff' ? 0 : 255, .12),
    '--panel-button-text': foreground,
    '--panel-brand-link-light': readableBrandLink(color, ['#ffffff', '#f5f7f5', '#e8f0eb'], 0),
    '--panel-brand-link-dark': readableBrandLink(color, ['#101a16', '#1a2d23', '#213c2e'], 255),
  };
}
