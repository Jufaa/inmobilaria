'use client';
import { useState } from 'react';
import { useDemo } from './DemoProvider';
import { Share2 } from 'lucide-react';
import type { Property } from '@/lib/properties';
import { formatPrice } from '@/lib/properties';
import { propertyCosts } from '@/lib/costs';
export default function PropertyExtras({
  property,
  onPhotoSelect,
}: {
  property: Property;
  onPhotoSelect: (url: string) => void;
}) {
  const { publicPath } = useDemo();
  const [shareMessage, setShareMessage] = useState('');
  const costs = propertyCosts(property);
  const { monthly, entry } = costs;
  const gallery = property.gallery?.length
    ? property.gallery
    : [property.image];
  const share = async () => {
    const url = `${window.location.origin}${publicPath}#propiedad=${property.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(
        'Enlace copiado. Este catálogo se guarda solo en tu navegador.',
      );
    } catch {
      setShareMessage(url);
    }
  };
  return (
    <section className="property-extras">
      <div className="extra-heading">
        <h3>Conocé los detalles</h3>
        <button onClick={share}>
          <Share2 size={18} />
          Compartir
        </button>
      </div>
      {shareMessage && (
        <p className="share-message" role="status">
          {shareMessage}
        </p>
      )}
      {gallery.length > 1 && (
        <div className="detail-gallery" aria-label="Galería de fotos">
          {gallery.map((url, index) => (
            <button
              key={`${url}-${index}`}
              onClick={() => onPhotoSelect(url)}
              aria-label={`Ver foto ${index + 1}`}
            >
              <img
                src={url}
                alt={`Foto de ejemplo ${index + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      <div className="detail-amenities">
        {property.amenities.length ? (
          property.amenities.map((value) => <span key={value}>✓ {value}</span>)
        ) : (
          <span>Características en la descripción</span>
        )}
        {property.status === 'reserved' && <strong>Reservada</strong>}
      </div>
      <div className="property-plan">
        <h4>Distribución de ejemplo</h4>
        <svg
          viewBox="0 0 500 220"
          role="img"
          aria-label="Plano esquemático ilustrativo, no a escala"
        >
          <rect
            x="20"
            y="20"
            width="460"
            height="180"
            fill="#f0f7f2"
            stroke="#38634a"
            strokeWidth="3"
          />
          <path
            d="M310 20V200M20 140H310M395 20V140M310 140H480"
            fill="none"
            stroke="#38634a"
            strokeWidth="3"
          />
          <text x="150" y="87" textAnchor="middle">
            Living / comedor
          </text>
          <text x="150" y="175" textAnchor="middle">
            Cocina
          </text>
          <text x="350" y="78" textAnchor="middle">
            Dorm.
          </text>
          <text x="438" y="78" textAnchor="middle">
            Dorm.
          </text>
          <text x="395" y="175" textAnchor="middle">
            Baño
          </text>
        </svg>
        <p>
          Plano ilustrativo, no a escala. No representa la distribución real de
          esta propiedad.
        </p>
      </div>
      <div className="detail-costs">
        <h4>
          {property.operation === 'Alquilar'
            ? 'Costos del alquiler de ejemplo'
            : 'Precio y gastos separados'}
        </h4>
        <div>
          <span>
            {property.operation === 'Alquilar'
              ? 'Alquiler por mes'
              : 'Precio de venta (pago único)'}
          </span>
          <strong>{formatPrice(property.price, costs.currency)}</strong>
        </div>
        <div>
          <span>Expensas por mes</span>
          <strong>
            {property.expenses === undefined
              ? 'No informadas'
              : formatPrice(property.expenses, costs.expensesCurrency)}
          </strong>
        </div>
        {property.operation === 'Alquilar' && (
          <>
            <div>
              <span>Alquiler + expensas por mes</span>
              <strong>
                {monthly === null
                  ? 'Sin total calculable'
                  : formatPrice(monthly!, costs.currency)}
              </strong>
            </div>
            <div>
              <span>Depósito de ejemplo</span>
              <strong>
                {property.deposit === undefined
                  ? 'No informado'
                  : formatPrice(property.deposit, costs.depositCurrency)}
              </strong>
            </div>
            {entry !== null && (
              <div>
                <span>
                  Subtotal de ingreso (primer mes + expensas + depósito)
                </span>
                <strong>{formatPrice(entry!, costs.currency)}</strong>
              </div>
            )}
          </>
        )}
        <p>
          Importes originales: {formatPrice(property.price, costs.currency)}{property.expenses !== undefined ? ` · expensas ${formatPrice(property.expenses, costs.expensesCurrency)}` : ''}{property.deposit !== undefined ? ` · depósito ${formatPrice(property.deposit, costs.depositCurrency)}` : ''}.
        </p>
        <p>
          No se convierten ni suman monedas diferentes. El subtotal incluye solo los componentes informados. Valores ficticios, no contrato ni cotización.
        </p>
      </div>
      <div className="rental-requirements">
        <h4>Requisitos informados en la demo</h4>
        {property.requirements?.length ? (
          <ul>
            {property.requirements.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        ) : (
          <p>No informados. Consultá a la inmobiliaria.</p>
        )}
        <p>
          Condiciones de ejemplo para esta propiedad ficticia. Confirmar todos
          los requisitos y costos antes de una operación real.
        </p>
      </div>
    </section>
  );
}
