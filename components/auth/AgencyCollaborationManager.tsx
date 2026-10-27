'use client';

import { useActionState } from 'react';
import {
  endConnectionAction,
  grantPropertyShareAction,
  requestConnectionAction,
  respondConnectionAction,
  revokePropertyShareAction,
  type CollaborationActionState,
} from '@/app/inmobiliaria/[agencyId]/panel/colaboracion/actions';
import styles from './agency-collaboration.module.css';

type Connection = {
  id: string;
  requestedByAgencyId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ENDED';
  lowCommissionPercent: number | null;
  highCommissionPercent: number | null;
  agencyLowId: string;
  agencyHighId: string;
  agencyLow: { id: string; name: string; slug: string };
  agencyHigh: { id: string; name: string; slug: string };
  shareCount: number;
};

type PropertyOption = { id: string; title: string; neighborhood: string };
type Share = {
  id: string;
  property: { id: string; title: string; status: string; neighborhood: string };
  partner: { id: string; name: string };
};
type ReceivedShare = Share & { owner: { id: string; name: string } };
type Event = { id: string; type: string; createdAt: string; actorAgency: { name: string }; propertyId: string | null };

function Feedback({ state }: { state: CollaborationActionState }) {
  if (state.error) return <p className={styles.error} role="alert">{state.error}</p>;
  if (state.success) return <p className={styles.success} role="status">{state.success}</p>;
  return null;
}

function ActionForm({
  action,
  hidden = {},
  submitLabel,
  children,
}: {
  action: (state: CollaborationActionState, data: FormData) => Promise<CollaborationActionState>;
  hidden?: Record<string, string>;
  submitLabel?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={styles.form}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <Feedback state={state} />
      {submitLabel && <button className={styles.primary} type="submit" disabled={pending}>{pending ? 'Procesando…' : submitLabel}</button>}
    </form>
  );
}

function agencyPercent(connection: Connection, agencyId: string) {
  if (connection.lowCommissionPercent === null || connection.highCommissionPercent === null) return null;
  return connection.agencyLowId === agencyId ? connection.lowCommissionPercent : connection.highCommissionPercent;
}

const eventLabels: Record<string, string> = {
  REQUESTED: 'Solicitud enviada',
  ACCEPTED: 'Vínculo aceptado',
  REJECTED: 'Solicitud rechazada',
  ENDED: 'Vínculo finalizado',
  PROPERTY_SHARED: 'Propiedad compartida',
  PROPERTY_SHARE_REVOKED: 'Permiso revocado',
};

export function AgencyCollaborationManager({
  agencyId,
  agencySlug,
  connections,
  ownedShares,
  receivedShares,
  publishedProperties,
  events,
}: {
  agencyId: string;
  agencySlug: string;
  connections: Connection[];
  ownedShares: Share[];
  receivedShares: ReceivedShare[];
  publishedProperties: PropertyOption[];
  events: Event[];
}) {
  const requestAction = requestConnectionAction.bind(null, agencySlug);
  const respondAction = respondConnectionAction.bind(null, agencySlug);
  const endAction = endConnectionAction.bind(null, agencySlug);
  const grantAction = grantPropertyShareAction.bind(null, agencySlug);
  const revokeAction = revokePropertyShareAction.bind(null, agencySlug);
  const incoming = connections.filter((item) => item.status === 'PENDING' && item.requestedByAgencyId !== agencyId);
  const outgoing = connections.filter((item) => item.status === 'PENDING' && item.requestedByAgencyId === agencyId);
  const active = connections.filter((item) => item.status === 'ACCEPTED');

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Red de inmobiliarias</p><h1>Colaboración</h1><p>Vinculá inmobiliarias y otorgá permisos sobre propiedades publicadas, manteniendo el registro bajo tu titularidad.</p></div>
      </header>

      <section className={styles.panel} aria-labelledby="request-title">
        <h2 id="request-title">Solicitar un vínculo</h2>
        <p>Usá el identificador de la inmobiliaria. La otra parte debe aceptar la solicitud y definir su porcentaje; el restante completa el 100%.</p>
        <ActionForm action={requestAction} submitLabel="Enviar solicitud">
          <label>Identificador de inmobiliaria<input name="targetSlug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="ejemplo-inmobiliaria" /></label>
        </ActionForm>
      </section>

      {incoming.length > 0 && <section className={styles.panel} aria-labelledby="incoming-title">
        <h2 id="incoming-title">Solicitudes recibidas</h2>
        <div className={styles.rows}>{incoming.map((connection) => {
          const requester = connection.agencyLowId === connection.requestedByAgencyId ? connection.agencyLow : connection.agencyHigh;
          return <article className={styles.row} key={connection.id}>
            <div><h3>{requester.name}</h3><p>Elegí el porcentaje que corresponde a tu inmobiliaria. La otra parte recibe automáticamente el complemento.</p></div>
            <ActionForm action={respondAction} hidden={{ connectionId: connection.id }}>
              <label>Tu comisión (%)<input type="number" name="ownCommissionPercent" min="0" max="100" step="1" /></label>
              <div className={styles.buttons}>
                <button className={styles.primary} type="submit" name="decision" value="accept">Aceptar vínculo</button>
                <button className={styles.secondary} type="submit" name="decision" value="reject">Rechazar</button>
              </div>
            </ActionForm>
          </article>;
        })}</div>
      </section>}

      {outgoing.length > 0 && <section className={styles.panel} aria-labelledby="outgoing-title">
        <h2 id="outgoing-title">Solicitudes enviadas</h2>
        {outgoing.map((connection) => {
          const recipient = connection.agencyLowId === connection.requestedByAgencyId ? connection.agencyHigh : connection.agencyLow;
          return <p className={styles.statusLine} key={connection.id}>{recipient.name} · Pendiente de respuesta</p>;
        })}
      </section>}

      <section className={styles.panel} aria-labelledby="links-title">
        <h2 id="links-title">Inmobiliarias vinculadas</h2>
        {active.length === 0 ? <p className={styles.empty}>Todavía no hay vínculos activos.</p> : <div className={styles.rows}>
          {active.map((connection) => {
            const partner = connection.agencyLowId === agencyId ? connection.agencyHigh : connection.agencyLow;
            const ownPercent = agencyPercent(connection, agencyId);
            return <article className={styles.row} key={connection.id}>
              <div><h3>{partner.name}</h3><p>Condiciones acordadas: tu inmobiliaria {ownPercent}% · {partner.name} {100 - (ownPercent ?? 0)}%.</p><p>{connection.shareCount} permisos activos</p></div>
              <ActionForm action={endAction} hidden={{ connectionId: connection.id }} submitLabel="Finalizar vínculo" />
              {publishedProperties.length > 0 && <ActionForm action={grantAction} hidden={{ connectionId: connection.id, recipientAgencyId: partner.id }} submitLabel="Compartir propiedad">
                <label>Propiedad publicada<select name="propertyId" required defaultValue=""><option value="" disabled>Elegir propiedad</option>{publishedProperties.map((property) => <option key={property.id} value={property.id}>{property.title} · {property.neighborhood}</option>)}</select></label>
              </ActionForm>}
            </article>;
          })}
        </div>}
      </section>

      <section className={styles.panel} aria-labelledby="shares-title">
        <h2 id="shares-title">Propiedades compartidas por tu inmobiliaria</h2>
        {ownedShares.length === 0 ? <p className={styles.empty}>No compartiste propiedades activas.</p> : <div className={styles.rows}>{ownedShares.map((share) => <article className={styles.row} key={share.id}>
          <div><h3>{share.property.title}</h3><p>{share.property.neighborhood} · Disponible para {share.partner.name}</p></div>
          <ActionForm action={revokeAction} hidden={{ shareGrantId: share.id }} submitLabel="Revocar permiso" />
        </article>)}</div>}
      </section>

      <section className={styles.panel} aria-labelledby="received-title">
        <h2 id="received-title">Propiedades que otras inmobiliarias comparten contigo</h2>
        {receivedShares.length === 0 ? <p className={styles.empty}>No recibiste permisos activos.</p> : <div className={styles.rows}>{receivedShares.map((share) => <article className={styles.row} key={share.id}>
          <div><h3>{share.property.title}</h3><p>{share.property.neighborhood} · Titular: {share.owner.name}</p></div>
          <span className={styles.badge}>Permiso activo</span>
        </article>)}</div>}
        <p className={styles.note}>Las propiedades compartidas aparecen en el catálogo público de tu inmobiliaria mientras el permiso y el vínculo estén activos. La ficha original sigue bajo titularidad de la inmobiliaria propietaria.</p>
      </section>

      <section className={styles.panel} aria-labelledby="audit-title">
        <h2 id="audit-title">Actividad reciente</h2>
        {events.length === 0 ? <p className={styles.empty}>Todavía no hay actividad registrada.</p> : <ul className={styles.events}>{events.map((event) => <li key={event.id}><span>{eventLabels[event.type] ?? event.type}</span><small>{event.actorAgency.name} · {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}{event.propertyId ? ' · propiedad' : ''}</small></li>)}</ul>}
      </section>
    </main>
  );
}
