'use client';
import { useState } from 'react';
import { formatPrice, type Property } from '@/lib/properties';
import { useDemo } from '@/components/DemoProvider';
const freshProperty = (): Property => ({
  id: Date.now(),
  title: '',
  address: '',
  neighborhood: 'Centro',
  region: 'Centro',
  price: 0,
  currency: 'USD',
  expensesCurrency: 'USD',
  operation: 'Comprar',
  type: 'Departamento',
  beds: 1,
  baths: 1,
  area: 0,
  image: '',
  gallery: [],
  expenses: undefined,
  tourUrl: '',
  latitude: -33.1231,
  longitude: -64.3488,
  amenities: [],
  tag: 'EJEMPLO',
  description: '',
  status: 'draft',
});
export default function PropertyEditor({
  property,
  onSaved,
  onCancel,
}: {
  property?: Property;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { saveProperty } = useDemo();
  const [draft, setDraft] = useState<Property>(() =>
    property
      ? { ...property, gallery: property.gallery ?? [property.image] }
      : freshProperty(),
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [photos, setPhotos] = useState(
    (property?.gallery ?? (property ? [property.image] : [])).join('\n'),
  );
  const update = (name: keyof Property, value: unknown) =>
    setDraft((previous) => ({ ...previous, [name]: value }));
  const save = (status: Property['status']) => {
    const gallery = photos
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    const next = {
      ...draft,
      status,
      title:
        draft.title.trim() ||
        (status === 'draft' ? 'Nueva propiedad (borrador)' : ''),
      gallery,
      image: gallery[0] ?? '',
      tag: status === 'reserved' ? 'RESERVADA' : 'EJEMPLO',
    };
    const result = saveProperty(next);
    setErrors(result);
    if (!result.length) onSaved();
  };
  return (
    <div className="admin-editor">
      <div className="wizard-steps" aria-label="Pasos de publicación">
        {['Datos', 'Fotos y ubicación', 'Revisar'].map((label, index) => (
          <button
            key={label}
            className={step === index ? 'active' : ''}
            onClick={() => setStep(index)}
            aria-current={step === index ? 'step' : undefined}
          >
            <b>{index + 1}</b>
            {label}
          </button>
        ))}
      </div>
      <p className="admin-local-note">
        Los cambios se guardan solo en este navegador. Las publicaciones son una
        demostración.
      </p>
      {errors.length > 0 && (
        <div className="admin-errors" role="alert">
          <strong>Revisá estos datos:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {step === 0 && (
        <div className="admin-form-grid">
          <label className="full">
            Título
            <input
              value={draft.title}
              maxLength={150}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Ej.: Departamento luminoso de dos dormitorios"
            />
          </label>
          <label>
            Operación
            <select
              value={draft.operation}
              onChange={(event) => update('operation', event.target.value)}
            >
              <option>Comprar</option>
              <option>Alquilar</option>
            </select>
          </label>
          <label>
            Tipo
            <select
              value={draft.type}
              onChange={(event) => update('type', event.target.value)}
            >
              <option>Departamento</option>
              <option>Casa</option>
              <option>PH</option>
            </select>
          </label>
          <label>
            Moneda del precio
            <select
              value={draft.currency ?? 'USD'}
              onChange={(event) => update('currency', event.target.value)}
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </label>
          <label>
            Moneda de expensas
            <select
              value={draft.expensesCurrency ?? draft.currency ?? 'USD'}
              onChange={(event) =>
                update('expensesCurrency', event.target.value)
              }
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </label>
          <label>
            Precio ({draft.currency ?? 'USD'})
            <input
              type="number"
              min="0"
              value={draft.price || ''}
              onChange={(event) => update('price', Number(event.target.value))}
            />
          </label>
          <label>
            Expensas mensuales (
            {draft.expensesCurrency ?? draft.currency ?? 'USD'})
            <input
              type="number"
              min="0"
              value={draft.expenses ?? ''}
              onChange={(event) =>
                update(
                  'expenses',
                  event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            Zona
            <select
              value={draft.region}
              onChange={(event) => update('region', event.target.value)}
            >
              {['Centro', 'Norte', 'Sur', 'Este', 'Oeste'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Barrio
            <input
              value={draft.neighborhood}
              onChange={(event) => update('neighborhood', event.target.value)}
            />
          </label>
          <label className="full">
            Dirección o ubicación de ejemplo
            <input
              value={draft.address}
              onChange={(event) => update('address', event.target.value)}
            />
          </label>
          <label>
            Dormitorios
            <input
              type="number"
              min="0"
              max="30"
              value={draft.beds}
              onChange={(event) => update('beds', Number(event.target.value))}
            />
          </label>
          <label>
            Baños
            <input
              type="number"
              min="0"
              max="30"
              value={draft.baths}
              onChange={(event) => update('baths', Number(event.target.value))}
            />
          </label>
          <label>
            Superficie total (m²)
            <input
              type="number"
              min="0"
              value={draft.area || ''}
              onChange={(event) => update('area', Number(event.target.value))}
            />
          </label>
          <fieldset className="admin-amenities">
            <legend>Espacios</legend>
            {(['Balcón', 'Patio', 'Cochera'] as const).map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={draft.amenities.includes(value)}
                  onChange={() =>
                    update(
                      'amenities',
                      draft.amenities.includes(value)
                        ? draft.amenities.filter((item) => item !== value)
                        : [...draft.amenities, value],
                    )
                  }
                />
                {value}
              </label>
            ))}
          </fieldset>
          <label>
            Depósito (opcional)
            <input
              type="number"
              min="0"
              value={draft.deposit ?? ''}
              onChange={(event) =>
                update(
                  'deposit',
                  event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                )
              }
            />
          </label>
          <label>
            Moneda del depósito
            <select
              value={draft.depositCurrency ?? draft.currency ?? 'USD'}
              onChange={(event) =>
                update('depositCurrency', event.target.value)
              }
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </label>
          <label className="full">
            Requisitos de ejemplo (uno por línea)
            <textarea
              rows={3}
              value={(draft.requirements ?? []).join('\n')}
              onChange={(event) =>
                update(
                  'requirements',
                  event.target.value.split('\n').filter(Boolean),
                )
              }
            />
          </label>
          <label className="full">
            Descripción
            <textarea
              rows={4}
              maxLength={5000}
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="admin-form-grid">
          <label className="full">
            Fotos: una URL HTTPS por línea
            <textarea
              rows={5}
              value={photos}
              onChange={(event) => setPhotos(event.target.value)}
              placeholder="https://images.unsplash.com/..."
            />
            <small>
              La primera foto es la portada. Las imágenes externas deben
              permitir su carga.
            </small>
          </label>
          <label className="full">
            Panorama 360° (opcional)
            <input
              type="url"
              value={draft.tourUrl ?? ''}
              onChange={(event) => update('tourUrl', event.target.value)}
              placeholder="https://.../panorama-equirectangular.jpg"
            />
            <small>
              Usá una imagen panorámica equirectangular con permiso de carga.
              Sin URL se muestra el panorama de demostración.
            </small>
          </label>
          <label>
            Latitud
            <input
              type="number"
              step="any"
              value={draft.latitude}
              onChange={(event) =>
                update('latitude', Number(event.target.value))
              }
            />
          </label>
          <label>
            Longitud
            <input
              type="number"
              step="any"
              value={draft.longitude}
              onChange={(event) =>
                update('longitude', Number(event.target.value))
              }
            />
          </label>
          <p className="admin-local-note full">
            Coordenadas iniciales del centro de Río Cuarto. Revisá la ubicación
            antes de publicar; esta demo no geocodifica direcciones.
          </p>
        </div>
      )}
      {step === 2 && (
        <div className="publish-preview">
          {photos.split('\n')[0] && (
            <img src={photos.split('\n')[0]} alt="Vista previa de portada" />
          )}
          <div>
            <span>
              {draft.type} · {draft.neighborhood}
            </span>
            <h2>{draft.title || 'Título pendiente'}</h2>
            <p>{draft.address || 'Ubicación pendiente'}</p>
            <strong>{formatPrice(draft.price, draft.currency ?? 'USD')}</strong>
            <p>
              {draft.beds} dormitorios · {draft.baths} baños · {draft.area} m²
            </p>
            <p>{draft.description || 'Descripción pendiente'}</p>
            <p>
              Expensas:{' '}
              {draft.expenses === undefined
                ? 'No informadas'
                : formatPrice(
                    draft.expenses,
                    draft.expensesCurrency ?? draft.currency ?? 'USD',
                  )}{' '}
              / mes
            </p>
          </div>
        </div>
      )}
      <div className="wizard-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button onClick={() => save('draft')}>Guardar borrador</button>
        {step > 0 && <button onClick={() => setStep(step - 1)}>Atrás</button>}
        {step < 2 ? (
          <button className="primary-button" onClick={() => setStep(step + 1)}>
            Continuar
          </button>
        ) : (
          <button className="primary-button" onClick={() => save('published')}>
            Publicar en la demo
          </button>
        )}
      </div>
    </div>
  );
}
