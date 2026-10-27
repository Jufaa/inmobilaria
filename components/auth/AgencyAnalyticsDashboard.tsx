import styles from './agency-analytics-dashboard.module.css';

type AnalyticsData = Awaited<ReturnType<typeof import('@/lib/analytics/public-analytics-service').getAgencyAnalytics>>;

const number = new Intl.NumberFormat('es-AR');
const date = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });

export function AgencyAnalyticsDashboard({ data }: { data: AnalyticsData }) {
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Actividad comercial · últimos {data.periodDays} días</p>
        <h1>Estadísticas</h1>
        <p>Conteos de eventos registrados; no representan personas únicas.</p>
      </header>

      <section className={styles.metrics} aria-label="Eventos del período">
        <article><span>Visitas al catálogo</span><strong>{number.format(data.counts.listingViews)}</strong></article>
        <article><span>Fichas de propiedades vistas</span><strong>{number.format(data.counts.propertyViews)}</strong></article>
        <article><span>Búsquedas</span><strong>{number.format(data.counts.searches)}</strong></article>
        <article><span>Selecciones de barrios</span><strong>{number.format(data.counts.zoneSelections)}</strong></article>
        <article><span>Consultas enviadas</span><strong>{number.format(data.counts.inquiries)}</strong></article>
      </section>

      <section className={styles.panel}>
        <h2>Actividad por día</h2>
        {data.daily.some((day) => day.listingViews + day.propertyViews + day.searches + day.inquiries > 0) ? (
          <div className={styles.tableScroll}>
            <table>
              <thead><tr><th>Fecha</th><th>Visitas al catálogo</th><th>Fichas vistas</th><th>Búsquedas</th><th>Consultas</th></tr></thead>
              <tbody>{data.daily.map((day) => (
                <tr key={day.day}>
                  <th scope="row">{date.format(new Date(`${day.day}T12:00:00`))}</th>
                  <td>{number.format(day.listingViews)}</td>
                  <td>{number.format(day.propertyViews)}</td>
                  <td>{number.format(day.searches)}</td>
                  <td>{number.format(day.inquiries)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className={styles.empty}>Todavía no hay eventos para este período.</p>}
      </section>

      <div className={styles.columns}>
        <section className={styles.panel}>
          <h2>Propiedades con más interacción</h2>
          {data.properties.length ? <ol className={styles.ranking}>{data.properties.map((property) => (
            <li key={property.id}><span>{property.title}</span><strong>{number.format(property.events)} vistas y consultas</strong></li>
          ))}</ol> : <p className={styles.empty}>Aún no hay vistas de fichas ni consultas.</p>}
        </section>
        <section className={styles.panel}>
          <h2>Barrios con más interés</h2>
          {data.zones.length ? <ol className={styles.ranking}>{data.zones.map((zone) => (
            <li key={zone.id}><span>{zone.name}</span><strong>{number.format(zone.events)} búsquedas y selecciones</strong></li>
          ))}</ol> : <p className={styles.empty}>Aún no hay búsquedas o selecciones de barrios.</p>}
        </section>
      </div>
      <p className={styles.note}>Las búsquedas y las consultas son señales distintas. Una búsqueda no equivale a una intención de compra.</p>
    </main>
  );
}
