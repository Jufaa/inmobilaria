import type { Metadata } from 'next';
import AgencyBoundary from '@/components/AgencyBoundary';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
export const metadata: Metadata = {
  title: 'Nombre de Empresa — Propiedades en Río Cuarto',
  description:
    'Explorá una selección de propiedades en una experiencia de mapa tridimensional. Prototipo inmobiliario de Río Cuarto, Córdoba, Argentina.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AgencyBoundary>{children}</AgencyBoundary>
      </body>
    </html>
  );
}
