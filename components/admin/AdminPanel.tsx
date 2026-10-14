'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  LayoutDashboard,
  Mail,
  Palette,
  Plus,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';
import { useDemo } from '@/components/DemoProvider';
import { formatPrice, type Property } from '@/lib/properties';
import type { Brand, Lead } from '@/lib/demo-repository';
import PropertyEditor from './PropertyEditor';
const statusLabels = {
  draft: 'Borrador',
  published: 'Publicada',
  reserved: 'Reservada',
  sold: 'Vendida',
};
const leadLabels = {
  new: 'Nueva',
  contacted: 'Contactada',
  visit: 'Visita',
  closed: 'Cerrada',
};
type View =
  | 'overview'
  | 'properties'
  | 'new'
  | 'inquiries'
  | 'visits'
  | 'brand';
export default function AdminPanel() {
  const demo = useDemo();
  const [view, setView] = useState<View>('overview');
  const [editing, setEditing] = useState<Property | undefined>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [operation, setOperation] = useState('all');
  const [notice, setNotice] = useState('');
  const [leadId, setLeadId] = useState<number | null>(null);
  const [visitDate, setVisitDate] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [brandDraft, setBrandDraft] = useState<Brand | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [resetOpen, setResetOpen] = useState(false);
  const selectedLead = demo.leads.find((lead) => lead.id === leadId);
  const selectedProperty = demo.catalog.find(
    (property) => property.id === selectedLead?.propertyId,
  );
  const rows = demo.catalog.filter(
    (property) =>
      (status === 'all' || (property.status ?? 'published') === status) &&
      (operation === 'all' || property.operation === operation) &&
      `${property.title} ${property.address} ${property.neighborhood}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const navigate = (next: View) => {
    setView(next);
    setNotice('');
    setErrors([]);
    if (next === 'new') setEditing(undefined);
    if (next === 'brand') setBrandDraft({ ...demo.brand });
  };
  const edit = (property: Property) => {
    setEditing(property);
    setView('new');
    setNotice('');
  };
  const updateStatus = (property: Property, next: Property['status']) => {
    const result = demo.saveProperty({
      ...property,
      status: next,
      tag: next === 'reserved' ? 'RESERVADA' : 'EJEMPLO',
    });
    setErrors(result);
    if (!result.length) setNotice('Estado actualizado en la demo.');
  };
  const copyResponse = async (lead: Lead) => {
    const property = demo.catalog.find((value) => value.id === lead.propertyId);
    const text = `Hola ${lead.name}, gracias por consultar por ${property?.title ?? 'la propiedad'}. Podemos coordinar una visita. Saludos, ${demo.brand.name}.`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        'Mensaje copiado. Podés pegarlo en WhatsApp; la demo no lo envía.',
      );
    } catch {
      setNotice('No se pudo copiar. Seleccioná y copiá el mensaje de abajo.');
    }
  };
  const schedule = () => {
    if (
      !selectedLead ||
      !visitDate ||
      !Number.isFinite(Date.parse(visitDate)) ||
      Date.parse(visitDate) < Date.now()
    ) {
      setErrors(['Elegí una fecha y hora futura.']);
      return;
    }
    demo.addVisit({
      leadId: selectedLead.id,
      propertyId: selectedLead.propertyId,
      date: new Date(visitDate).toISOString(),
      note: visitNote,
    });
    setErrors([]);
    setVisitDate('');
    setVisitNote('');
    setNotice('Visita agregada a la agenda local.');
  };
  const brand = brandDraft ?? demo.brand;
  const titles = {
    overview: 'Todo tu trabajo, en un lugar',
    properties: 'Tus propiedades',
    new: editing ? 'Editar propiedad' : 'Nueva propiedad',
    inquiries: 'Consultas y seguimiento',
    visits: 'Agenda de visitas',
    brand: 'La identidad de tu inmobiliaria',
  };
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link href={demo.publicPath} className="admin-brand">
          {demo.brand.name}
          <span>Panel inmobiliaria</span>
        </Link>
        <nav aria-label="Panel inmobiliaria">
          {(
            [
              { id: 'overview', label: 'Resumen', Icon: LayoutDashboard },
              { id: 'properties', label: 'Propiedades', Icon: Building2 },
              { id: 'new', label: 'Nueva propiedad', Icon: Plus },
              { id: 'inquiries', label: 'Consultas', Icon: Mail },
              { id: 'visits', label: 'Visitas', Icon: CalendarDays },
              { id: 'brand', label: 'Mi marca', Icon: Palette },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => navigate(id)}
              aria-current={view === id ? 'page' : undefined}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span>Demo local · Sin backend</span>
          <Link href="/vendedor">Volver al vendedor</Link>
          <Link href={`${demo.publicPath}/prueba`}>Probar recorrido guiado</Link>
          <Link href={demo.publicPath}>
            Ver sitio público <ArrowUpRight size={18} />
          </Link>
          <button onClick={() => setResetOpen(true)}>
            <RotateCcw size={17} />
            Restablecer ejemplos
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">Río Cuarto · Gestión inmobiliaria</p>
            <h1>{titles[view]}</h1>
          </div>
          <span className="admin-demo-badge">{demo.agency.status === 'paused' ? 'Pausada · Vista previa local' : 'Solo en este navegador'}</span>
        </header>
        {!demo.ready && <p role="status">Cargando datos locales…</p>}
        {demo.storageMessage && (
          <div className="admin-notice">{demo.storageMessage}</div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            <Check size={18} />
            {notice}
          </div>
        )}
        {errors.length > 0 && (
          <div className="admin-errors" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        {view === 'overview' && (
          <>
            <div className="admin-kpis">
              {[
                {
                  label: 'Propiedades visibles',
                  value: demo.publicProperties.length,
                },
                {
                  label: 'Borradores',
                  value: demo.catalog.filter(
                    (property) => property.status === 'draft',
                  ).length,
                },
                {
                  label: 'Consultas nuevas',
                  value: demo.leads.filter((lead) => lead.stage === 'new')
                    .length,
                },
                { label: 'Visitas agendadas', value: demo.visits.length },
              ].map((kpi) => (
                <div key={kpi.label}>
                  <span>{kpi.label}</span>
                  <strong>{kpi.value}</strong>
                  <small>Datos de esta demo</small>
                </div>
              ))}
            </div>
            <div className="admin-overview-grid">
              <section className="admin-box">
                <div className="admin-box-heading">
                  <h2>Próximos pasos</h2>
                </div>
                <button
                  className="admin-shortcut"
                  onClick={() => navigate('new')}
                >
                  <Plus size={25} />
                  <span>
                    Publicá tu próxima propiedad
                    <small>Cargá fotos, ubicación y características.</small>
                  </span>
                  <ArrowUpRight />
                </button>
                <button
                  className="admin-shortcut"
                  onClick={() => navigate('inquiries')}
                >
                  <Mail size={25} />
                  <span>
                    Respondé tus consultas
                    <small>
                      {demo.leads.filter((lead) => lead.stage === 'new').length}{' '}
                      consultas esperan seguimiento.
                    </small>
                  </span>
                  <ArrowUpRight />
                </button>
                <button
                  className="admin-shortcut"
                  onClick={() => navigate('brand')}
                >
                  <Palette size={25} />
                  <span>
                    Personalizá tu sitio
                    <small>Nombre, logo y color de acción.</small>
                  </span>
                  <ArrowUpRight />
                </button>
              </section>
              <section className="admin-box">
                <h2>Actividad del catálogo</h2>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <div className="admin-chart-row" key={key}>
                    <span>{label}</span>
                    <div>
                      <i
                        style={{
                          width: `${(demo.catalog.filter((property) => (property.status ?? 'published') === key).length / Math.max(demo.catalog.length, 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <b>
                      {
                        demo.catalog.filter(
                          (property) =>
                            (property.status ?? 'published') === key,
                        ).length
                      }
                    </b>
                  </div>
                ))}
                <p className="admin-local-note">
                  Distribución del catálogo local. No son visitas web, ventas ni
                  métricas en vivo.
                </p>
              </section>
            </div>
            <section className="admin-box">
              <div className="admin-box-heading">
                <h2>Últimas consultas</h2>
                <button onClick={() => navigate('inquiries')}>Ver todas</button>
              </div>
              {demo.leads.slice(0, 3).map((lead) => (
                <button
                  className="admin-lead-row"
                  key={lead.id}
                  onClick={() => {
                    navigate('inquiries');
                    setLeadId(lead.id);
                  }}
                >
                  <span>
                    <strong>{lead.name}</strong>
                    <small>
                      {
                        demo.catalog.find(
                          (property) => property.id === lead.propertyId,
                        )?.title
                      }
                    </small>
                  </span>
                  <span className="status-pill">{leadLabels[lead.stage]}</span>
                  <ArrowUpRight size={19} />
                </button>
              ))}
            </section>
          </>
        )}
        {view === 'properties' && (
          <>
            <div className="admin-controls">
              <label>
                Buscar
                <input
                  placeholder="Título, dirección o barrio"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                Estado
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="all">Todos</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operación
                <select
                  value={operation}
                  onChange={(event) => setOperation(event.target.value)}
                >
                  <option value="all">Todas</option>
                  <option>Comprar</option>
                  <option>Alquilar</option>
                </select>
              </label>
              <button
                className="primary-button"
                onClick={() => navigate('new')}
              >
                <Plus size={19} />
                Nueva propiedad
              </button>
            </div>
            <div className="admin-property-list">
              {rows.map((property) => (
                <article key={property.id}>
                  <img src={property.image} alt="Portada de ejemplo" />
                  <div>
                    <span className="status-pill">
                      {statusLabels[property.status ?? 'published']}
                    </span>
                    <h2>{property.title}</h2>
                    <p>
                      {property.neighborhood} · {property.type} ·{' '}
                      {formatPrice(property.price, property.currency ?? 'USD')}
                    </p>
                  </div>
                  <div className="admin-property-actions">
                    <label
                      className="sr-only"
                      htmlFor={`status-${property.id}`}
                    >
                      Estado de {property.title}
                    </label>
                    <select
                      id={`status-${property.id}`}
                      value={property.status ?? 'published'}
                      onChange={(event) =>
                        updateStatus(
                          property,
                          event.target.value as Property['status'],
                        )
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => edit(property)}>Editar</button>
                    {(!property.status ||
                      ['published', 'reserved'].includes(property.status)) && (
                      <Link href={`${demo.publicPath}#propiedad=${property.id}`}>
                        Ver publicación
                      </Link>
                    )}
                  </div>
                </article>
              ))}
              {!rows.length && (
                <p className="admin-empty">
                  No hay propiedades con esos filtros.
                </p>
              )}
            </div>
          </>
        )}
        {view === 'new' && (
          <PropertyEditor
            key={editing?.id ?? 'new'}
            property={editing}
            onCancel={() => navigate('properties')}
            onSaved={() => {
              navigate('properties');
              setNotice(
                'Propiedad guardada. Las publicadas aparecen en el sitio público de este navegador.',
              );
            }}
          />
        )}
        {view === 'inquiries' && (
          <div className="admin-inbox">
            <section className="admin-box">
              <h2>Consultas ({demo.leads.length})</h2>
              {demo.leads.map((lead) => (
                <button
                  key={lead.id}
                  className={`admin-inbox-item ${leadId === lead.id ? 'active' : ''}`}
                  onClick={() => {
                    setLeadId(lead.id);
                    setNotice('');
                    setErrors([]);
                  }}
                >
                  <span>
                    <strong>{lead.name}</strong>
                    <small>
                      {
                        demo.catalog.find(
                          (property) => property.id === lead.propertyId,
                        )?.title
                      }
                    </small>
                  </span>
                  <span className="status-pill">{leadLabels[lead.stage]}</span>
                </button>
              ))}
            </section>
            <section className="admin-box">
              {selectedLead ? (
                <>
                  <span className="admin-eyebrow">
                    Consulta #{selectedLead.id}
                  </span>
                  <h2>{selectedLead.name}</h2>
                  <p>{selectedProperty?.title}</p>
                  <p>
                    {selectedLead.email}{' '}
                    {selectedLead.phone && `· ${selectedLead.phone}`}
                  </p>
                  <blockquote>{selectedLead.message}</blockquote>
                  <label className="admin-field">
                    Seguimiento
                    <select
                      value={selectedLead.stage}
                      onChange={(event) =>
                        demo.updateLead(selectedLead.id, {
                          stage: event.target.value as Lead['stage'],
                        })
                      }
                    >
                      {Object.entries(leadLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field">
                    Notas internas
                    <textarea
                      rows={3}
                      value={selectedLead.note}
                      onChange={(event) =>
                        demo.updateLead(selectedLead.id, {
                          note: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="primary-button"
                    onClick={() => copyResponse(selectedLead)}
                  >
                    Copiar respuesta para WhatsApp
                  </button>
                  <p className="admin-local-note">
                    Hola {selectedLead.name}, gracias por consultar por{' '}
                    {selectedProperty?.title}. Podemos coordinar una visita.
                    Saludos, {demo.brand.name}.
                  </p>
                  <div className="admin-visit-form">
                    <h3>Agendar visita</h3>
                    <label>
                      Fecha y hora
                      <input
                        type="datetime-local"
                        value={visitDate}
                        onChange={(event) => setVisitDate(event.target.value)}
                      />
                    </label>
                    <label>
                      Nota
                      <input
                        value={visitNote}
                        onChange={(event) => setVisitNote(event.target.value)}
                      />
                    </label>
                    <button onClick={schedule}>Guardar visita local</button>
                  </div>
                </>
              ) : (
                <div className="admin-empty">
                  <Mail size={32} />
                  <h2>Elegí una consulta</h2>
                  <p>
                    Podés seguir su estado, escribir notas y agendar una visita.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
        {view === 'visits' && (
          <section className="admin-box">
            <h2>Agenda local</h2>
            {demo.visits.length ? (
              demo.visits
                .slice()
                .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
                .map((visit) => (
                  <article className="admin-visit" key={visit.id}>
                    <CalendarDays size={26} />
                    <div>
                      <strong>
                        {new Intl.DateTimeFormat('es-AR', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(visit.date))}
                      </strong>
                      <h3>
                        {
                          demo.catalog.find(
                            (property) => property.id === visit.propertyId,
                          )?.title
                        }
                      </h3>
                      <p>
                        {
                          demo.leads.find((lead) => lead.id === visit.leadId)
                            ?.name
                        }{' '}
                        · {visit.note || 'Sin notas'}
                      </p>
                    </div>
                  </article>
                ))
            ) : (
              <div className="admin-empty">
                <CalendarDays size={32} />
                <h2>Todavía no hay visitas</h2>
                <p>Agendá una desde la ficha de una consulta.</p>
                <button onClick={() => navigate('inquiries')}>
                  Ir a consultas
                </button>
              </div>
            )}
          </section>
        )}
        {view === 'brand' && (
          <div className="admin-overview-grid">
            <section className="admin-box">
              <h2>Personalización</h2>
              <label className="admin-field">
                Nombre de la inmobiliaria
                <input
                  maxLength={60}
                  value={brand.name}
                  onChange={(event) =>
                    setBrandDraft({ ...brand, name: event.target.value })
                  }
                />
              </label>
              <label className="admin-field">
                Color de acciones
                <input
                  type="color"
                  value={brand.color}
                  onChange={(event) =>
                    setBrandDraft({ ...brand, color: event.target.value })
                  }
                />
                <small>El color debe permitir leer texto blanco.</small>
              </label>
              <label className="admin-field">
                URL HTTPS del logo (opcional)
                <input
                  type="url"
                  value={brand.logo}
                  onChange={(event) =>
                    setBrandDraft({ ...brand, logo: event.target.value })
                  }
                />
              </label>
              <button
                className="primary-button"
                onClick={() => {
                  const result = demo.saveBrand(brand);
                  setErrors(result);
                  if (!result.length)
                    setNotice(
                      'Marca guardada. El sitio público usa esta identidad.',
                    );
                }}
              >
                Guardar mi marca
              </button>
            </section>
            <section className="admin-box">
              <h2>Vista previa</h2>
              <div className="brand-preview">
                {brand.logo && (
                  <img src={brand.logo} alt="Vista previa del logo" />
                )}
                <strong>{brand.name || 'Tu inmobiliaria'}</strong>
                <p>Propiedades en Río Cuarto</p>
                <span style={{ background: brand.color }}>
                  Buscar mi próximo lugar
                </span>
              </div>
              <p className="admin-local-note">
                La configuración se aplica a este navegador. No crea dominios ni
                una cuenta externa.
              </p>
            </section>
          </div>
        )}
        {resetOpen && (
          <section
            className="admin-reset"
            role="region"
            aria-label="Restablecer demostración"
          >
            <h2>¿Restablecer los ejemplos?</h2>
            <p>
              Se reemplazarán las propiedades, consultas, visitas, marca y
              favoritos de esta demo local.
            </p>
            <div>
              <button onClick={() => setResetOpen(false)}>
                Conservar mis cambios
              </button>
              <button
                onClick={() => {
                  demo.reset();
                  setResetOpen(false);
                  navigate('overview');
                  setNotice('Ejemplos restablecidos.');
                }}
              >
                Restablecer demo
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
