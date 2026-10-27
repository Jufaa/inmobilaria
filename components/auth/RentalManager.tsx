'use client';

import { useActionState, useState } from 'react';
import {
  applyRentAdjustmentAction, createPropertyExpenseAction, createRentChargeAction, createRentalContactAction,
  createRentalContractAction, createRentPaymentAction, markExpensePaidAction, type RentalActionState,
} from '@/app/inmobiliaria/[agencyId]/panel/alquileres/actions';
import styles from './rental-manager.module.css';

type Contact = { id: string; kind: 'LANDLORD' | 'TENANT'; name: string; email: string | null; phone: string | null; notes: string | null };
type Property = { id: string; title: string; neighborhood: string };
type Payment = { id: string; amount: string; paidAt: string; method: string; note: string };
type Charge = { id: string; contractId: string; amount: string; paidAmount: string; balance: string; status: string; currency: string; dueDate: string; periodStart: string; propertyTitle: string; tenantName: string };
type Adjustment = { id: string; oldMonthlyRent: string; newMonthlyRent: string; percent: string; source: string; note: string; effectiveDate: string };
type Contract = {
  id: string; status: string; startDate: string; endDate: string | null; monthlyRent: string; currency: string; rentDueDay: number; terms: string;
  property: Property; landlord: { id: string; name: string; email: string | null; phone: string | null }; tenant: { id: string; name: string; email: string | null; phone: string | null };
  adjustments: Adjustment[]; charges: Array<Charge & { payments: Payment[] }>;
};
type Expense = { id: string; description: string; category: string; amount: string; currency: string; dueDate: string | null; paidAt: string | null; status: string; note: string; property: { title: string } | null };
type Event = { id: string; action: string; entityType: string; entityId: string; createdAt: string; actorUser: { name: string | null; email: string | null } };

const initial: RentalActionState = {};
const currency = (amount: string, code: string) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: code }).format(Number(amount));
const day = (date: string | null) => date ? new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('es-AR') : 'Sin fecha';

function Feedback({ state }: { state: RentalActionState }) {
  return state.error ? <p className={styles.error} role="alert">{state.error}</p> : state.success ? <p className={styles.success} role="status">{state.success}</p> : null;
}

function ContactForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(createRentalContactAction.bind(null, slug), initial);
  return <form action={action} className={styles.form}>
    <h3>Nuevo contacto</h3>
    <label>Tipo<select name="kind"><option value="LANDLORD">Propietario</option><option value="TENANT">Inquilino</option></select></label>
    <label>Nombre<input name="name" required minLength={2} maxLength={160} /></label>
    <label>Correo<input name="email" type="email" maxLength={254} /></label>
    <label>Teléfono<input name="phone" maxLength={40} /></label>
    <label>Notas<input name="notes" maxLength={1000} /></label>
    <Feedback state={state} /><button disabled={pending}>{pending ? 'Guardando…' : 'Guardar contacto'}</button>
  </form>;
}

function ContractForm({ slug, contacts, properties }: { slug: string; contacts: Contact[]; properties: Property[] }) {
  const [state, action, pending] = useActionState(createRentalContractAction.bind(null, slug), initial);
  const landlords = contacts.filter((contact) => contact.kind === 'LANDLORD');
  const tenants = contacts.filter((contact) => contact.kind === 'TENANT');
  return <form action={action} className={styles.form}>
    <h3>Nuevo contrato</h3>
    <label>Propiedad<select name="propertyId" required defaultValue=""><option value="" disabled>Elegí una propiedad en alquiler</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title} · {property.neighborhood}</option>)}</select></label>
    <label>Propietario<select name="landlordContactId" required defaultValue=""><option value="" disabled>Elegí un propietario</option>{landlords.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
    <label>Inquilino<select name="tenantContactId" required defaultValue=""><option value="" disabled>Elegí un inquilino</option>{tenants.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
    <div className={styles.two}><label>Estado<select name="status"><option value="DRAFT">Borrador</option><option value="ACTIVE">Activo</option></select></label><label>Moneda<select name="currency"><option value="ARS">ARS</option><option value="USD">USD</option></select></label></div>
    <div className={styles.two}><label>Inicio<input type="date" name="startDate" required /></label><label>Fin (opcional)<input type="date" name="endDate" /></label></div>
    <div className={styles.two}><label>Alquiler mensual<input type="number" name="monthlyRent" min="0.01" step="0.01" required /></label><label>Día de vencimiento<input type="number" name="rentDueDay" min="1" max="28" defaultValue="10" required /></label></div>
    <label>Condiciones / cláusulas manuales<textarea name="terms" rows={4} maxLength={12000} /></label>
    {!landlords.length || !tenants.length ? <p className={styles.hint}>Primero cargá al menos un propietario y un inquilino en Contactos.</p> : null}
    <Feedback state={state} /><button disabled={pending || !landlords.length || !tenants.length || !properties.length}>{pending ? 'Guardando…' : 'Guardar contrato'}</button>
  </form>;
}

function ChargeForm({ slug, contracts }: { slug: string; contracts: Contract[] }) {
  const [state, action, pending] = useActionState(createRentChargeAction.bind(null, slug), initial);
  const active = contracts.filter((contract) => contract.status === 'ACTIVE');
  return <form action={action} className={styles.form}>
    <h3>Generar cargo mensual</h3>
    <label>Contrato activo<select name="contractId" required defaultValue=""><option value="" disabled>Elegí un contrato</option>{active.map((contract) => <option key={contract.id} value={contract.id}>{contract.property.title} · {contract.tenant.name}</option>)}</select></label>
    <div className={styles.two}><label>Período (día 1)<input type="date" name="periodStart" required /></label><label>Vencimiento<input type="date" name="dueDate" required /></label></div>
    <label>Importe (opcional; por defecto el alquiler mensual)<input type="number" name="amount" min="0.01" step="0.01" /></label>
    <Feedback state={state} /><button disabled={pending || !active.length}>{pending ? 'Guardando…' : 'Crear cargo'}</button>
  </form>;
}

function ExpenseForm({ slug, properties }: { slug: string; properties: Property[] }) {
  const [state, action, pending] = useActionState(createPropertyExpenseAction.bind(null, slug), initial);
  return <form action={action} className={styles.form}>
    <h3>Registrar gasto</h3>
    <label>Descripción<input name="description" required minLength={2} maxLength={180} /></label>
    <div className={styles.two}><label>Categoría<input name="category" required maxLength={80} placeholder="Impuesto, reparación…" /></label><label>Propiedad (opcional)<select name="propertyId" defaultValue=""><option value="">Sin asociar</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label></div>
    <div className={styles.two}><label>Importe<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Moneda<select name="currency"><option value="ARS">ARS</option><option value="USD">USD</option></select></label></div>
    <div className={styles.two}><label>Vence<input name="dueDate" type="date" /></label><label>Estado<select name="status"><option value="UNPAID">Pendiente</option><option value="PAID">Pagado</option></select></label></div>
    <label>Fecha de pago (si ya fue pagado)<input name="paidAt" type="date" /></label><label>Notas<input name="note" maxLength={1000} /></label>
    <Feedback state={state} /><button disabled={pending}>{pending ? 'Guardando…' : 'Guardar gasto'}</button>
  </form>;
}

function PaymentForm({ slug, charges }: { slug: string; charges: Charge[] }) {
  const [state, action, pending] = useActionState(createRentPaymentAction.bind(null, slug), initial);
  return <form action={action} className={styles.inlineForm}>
    <label>Registrar pago parcial o total<select name="chargeId" required defaultValue=""><option value="" disabled>Elegí un saldo</option>{charges.map((charge) => <option key={charge.id} value={charge.id}>{charge.propertyTitle} · {charge.tenantName} · vence {day(charge.dueDate)} · saldo {currency(charge.balance, charge.currency)}</option>)}</select></label>
    <div className={styles.three}><label>Importe<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Fecha<input name="paidAt" type="date" required /></label><label>Medio<input name="method" maxLength={80} placeholder="Transferencia" /></label></div>
    <label>Nota<input name="note" maxLength={500} /></label><Feedback state={state} /><button disabled={pending || !charges.length}>{pending ? 'Guardando…' : 'Registrar pago'}</button>
  </form>;
}

function chargeStatus(charge: Charge) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${charge.dueDate.slice(0, 10)}T00:00:00`);
  if (due < today) return 'Vencido';
  return charge.status === 'PARTIAL' ? 'Pago parcial' : 'Pendiente';
}

function AdjustmentForm({ slug, contract }: { slug: string; contract: Contract }) {
  const [state, action, pending] = useActionState(applyRentAdjustmentAction.bind(null, slug), initial);
  const [percent, setPercent] = useState('');
  const proposed = percent && Number.isFinite(Number(percent))
    ? (Number(contract.monthlyRent) * (1 + Number(percent) / 100)).toFixed(2)
    : null;
  return <details className={styles.details}>
    <summary>Ajustar alquiler · actual {currency(contract.monthlyRent, contract.currency)}</summary>
    <form action={action} className={styles.form}>
      <input type="hidden" name="contractId" value={contract.id} />
      <div className={styles.two}><label>Porcentaje manual (+/-)<input name="percent" type="number" step="0.0001" min="-99.9999" max="1000" required value={percent} onChange={(event) => setPercent(event.target.value)} /></label><label>Fecha efectiva<input name="effectiveDate" type="date" required /></label></div>
      <p className={styles.hint}>Vista previa: {currency(contract.monthlyRent, contract.currency)} → {proposed ? currency(proposed, contract.currency) : 'ingresá el porcentaje'}.</p>
      <label>Fuente o acuerdo<input name="source" required maxLength={160} placeholder="Según acuerdo firmado / índice indicado por el contrato" /></label>
      <label>Nota<input name="note" maxLength={1000} /></label>
      <p className={styles.hint}>El cálculo usa el porcentaje ingresado y redondea a 2 decimales. Revisá el monto antes de aplicar. No se aplica ningún índice legal automáticamente.</p>
      <Feedback state={state} /><button disabled={pending}>{pending ? 'Aplicando…' : 'Aplicar ajuste y guardar historial'}</button>
    </form>
    {contract.adjustments.length ? <ul className={styles.history}>{contract.adjustments.map((adjustment) => <li key={adjustment.id}>{day(adjustment.effectiveDate)} · {currency(adjustment.oldMonthlyRent, contract.currency)} → {currency(adjustment.newMonthlyRent, contract.currency)} ({adjustment.percent}%) · {adjustment.source}</li>)}</ul> : <p className={styles.hint}>Todavía no hay ajustes registrados.</p>}
  </details>;
}

function PrintDraft({ contract }: { contract: Contract }) {
  return <details className={styles.details}>
    <summary>Vista de borrador imprimible</summary>
    <div className={styles.draft}>
      <h3>Borrador informativo de contrato de alquiler</h3>
      <p>Este documento es un borrador generado con datos ingresados por la inmobiliaria. Debe revisarse y completarse antes de cualquier uso.</p>
      <p>Propiedad: {contract.property.title}, {contract.property.neighborhood}.</p>
      <p>Propietario: {contract.landlord.name}{contract.landlord.email ? ` (${contract.landlord.email})` : ''}. Inquilino: {contract.tenant.name}{contract.tenant.email ? ` (${contract.tenant.email})` : ''}.</p>
      <p>Vigencia: {day(contract.startDate)} a {day(contract.endDate)}. Alquiler mensual: {currency(contract.monthlyRent, contract.currency)}. Vencimiento mensual: día {contract.rentDueDay}.</p>
      <h4>Condiciones y cláusulas ingresadas</h4><p className={styles.terms}>{contract.terms || 'Sin condiciones adicionales ingresadas.'}</p>
      <p className={styles.signature}>Firma propietario: ____________________________　Firma inquilino: ____________________________</p>
      <button type="button" className={styles.printButton} onClick={() => window.print()}>Imprimir / guardar PDF</button>
    </div>
  </details>;
}

function MarkExpensePaid({ slug, expense }: { slug: string; expense: Expense }) {
  const [state, action, pending] = useActionState(markExpensePaidAction.bind(null, slug), initial);
  return <form action={action} className={styles.markPaid}><input type="hidden" name="expenseId" value={expense.id} /><label>Fecha de pago<input name="paidAt" type="date" required /></label><Feedback state={state} /><button disabled={pending}>{pending ? 'Guardando…' : 'Marcar pagado'}</button></form>;
}

export function RentalManager({ slug, contacts, properties, contracts, charges, expenses, auditEvents }: {
  slug: string; contacts: Contact[]; properties: Property[]; contracts: Contract[]; charges: Charge[]; expenses: Expense[]; auditEvents: Event[];
}) {
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>ADMINISTRACIÓN DE ALQUILERES</p><h1>Contratos, vencimientos y pagos</h1><p>Gestión financiera restringida a propietarios y administradores de esta inmobiliaria.</p></div><span className={styles.pill}>{contracts.filter((contract) => contract.status === 'ACTIVE').length} contratos activos</span></header>
    <div className={styles.notice}>Los cálculos de actualización son manuales. El sistema conserva el historial y no modifica cargos ni pagos anteriores. Los borradores imprimibles requieren revisión profesional.</div>
    <section className={styles.forms}><ContactForm slug={slug} /><ContractForm slug={slug} contacts={contacts} properties={properties} /></section>
    <section className={styles.section}><h2>Vencimientos y pagos pendientes</h2><PaymentForm slug={slug} charges={charges} />
      {charges.length ? <div className={styles.cards}>{charges.map((charge) => <article className={styles.card} key={charge.id}><div><h3>{charge.propertyTitle}</h3><p>{charge.tenantName} · período {day(charge.periodStart)} · vence {day(charge.dueDate)}</p><strong>Importe {currency(charge.amount, charge.currency)} · abonado {currency(charge.paidAmount, charge.currency)} · saldo {currency(charge.balance, charge.currency)}</strong><p>Estado: {chargeStatus(charge)}</p></div></article>)}</div> : <p>No hay cargos pendientes o parciales.</p>}
    </section>
    <section className={styles.section}><h2>Contratos</h2>{contracts.length ? <div className={styles.cards}>{contracts.map((contract) => <article className={styles.contract} key={contract.id}>
      <div className={styles.contractHead}><div><span className={styles.pill}>{contract.status === 'ACTIVE' ? 'Activo' : contract.status === 'ENDED' ? 'Finalizado' : 'Borrador'}</span><h3>{contract.property.title}</h3><p>{contract.property.neighborhood} · propietario {contract.landlord.name} · inquilino {contract.tenant.name}</p></div><strong>{currency(contract.monthlyRent, contract.currency)} / mes</strong></div>
      <p>Vigencia {day(contract.startDate)} — {day(contract.endDate)} · vence el día {contract.rentDueDay}</p>
      <PrintDraft contract={contract} />
      {contract.status === 'ACTIVE' && <AdjustmentForm slug={slug} contract={contract} />}
      {contract.charges.length > 0 && <details className={styles.details}><summary>Historial de cargos y pagos</summary><ul className={styles.history}>{contract.charges.map((charge) => <li key={charge.id}>{day(charge.periodStart)} · {charge.status} · {charge.payments.map((payment) => `${currency(payment.amount, contract.currency)} el ${day(payment.paidAt)}`).join('; ') || 'Sin pagos'}</li>)}</ul></details>}
    </article>)}</div> : <p>Todavía no hay contratos cargados.</p>}</section>
    <section className={styles.forms}><ExpenseForm slug={slug} properties={properties} /><section className={styles.section}><h2>Gastos registrados</h2>{expenses.length ? <div className={styles.cards}>{expenses.map((expense) => <article className={styles.card} key={expense.id}><div><h3>{expense.description}</h3><p>{expense.category} · {expense.property?.title ?? 'Sin propiedad asociada'} · {currency(expense.amount, expense.currency)}</p><p>{expense.status === 'PAID' ? `Pagado ${day(expense.paidAt)}` : `Pendiente${expense.dueDate ? ` · vence ${day(expense.dueDate)}` : ''}`}</p>{expense.status === 'UNPAID' && <MarkExpensePaid slug={slug} expense={expense} />}</div></article>)}</div> : <p>Sin gastos registrados.</p>}</section></section>
    <section className={styles.section}><h2>Contactos de la inmobiliaria</h2>{contacts.length ? <div className={styles.cards}>{contacts.map((contact) => <article className={styles.card} key={contact.id}><div><h3>{contact.name}</h3><p>{contact.kind === 'LANDLORD' ? 'Propietario' : 'Inquilino'} · {contact.email ?? 'Sin correo'} · {contact.phone ?? 'Sin teléfono'}</p>{contact.notes && <p>{contact.notes}</p>}</div></article>)}</div> : <p>Agregá propietarios e inquilinos para iniciar contratos.</p>}</section>
    <section className={styles.section}><h2>Actividad financiera reciente</h2>{auditEvents.length ? <ul className={styles.history}>{auditEvents.map((event) => <li key={event.id}>{day(event.createdAt)} · {event.action.replaceAll('_', ' ').toLowerCase()} · {event.entityType} · {event.actorUser.name ?? event.actorUser.email ?? 'Usuario'}</li>)}</ul> : <p>Aún no hay actividad registrada.</p>}</section>
  </main>;
}
