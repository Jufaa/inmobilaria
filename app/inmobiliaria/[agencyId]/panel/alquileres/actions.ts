'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyFinanceAccess } from '@/lib/agency-access';
import {
  applyRentAdjustment, createPropertyExpense, createRentCharge, createRentalContact, createRentalContract,
  createRentPayment, markExpensePaid, rentalContactKinds, rentalContractStatuses, rentalCurrencies,
} from '@/lib/rentals/rental-service';

export type RentalActionState = { error?: string; success?: string };
const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const validId = (id: string) => id.length > 0 && id.length <= 64;
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
  && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const validMoney = (amount: string) => /^\d{1,12}(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0;

async function context(slug: string) {
  return requireAgencyFinanceAccess(slug);
}

function refresh(slug: string) {
  revalidatePath(`/inmobiliaria/${encodeURIComponent(slug)}/panel/alquileres`);
}

export async function createRentalContactAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const kind = value(data, 'kind');
  const name = value(data, 'name');
  const email = value(data, 'email').toLowerCase();
  const phone = value(data, 'phone');
  const notes = value(data, 'notes');
  if (!rentalContactKinds.includes(kind as (typeof rentalContactKinds)[number]) || name.length < 2 || name.length > 160) return { error: 'Revisá el tipo y nombre del contacto.' };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Ingresá un correo válido.' };
  if (phone.length > 40 || notes.length > 1000) return { error: 'El teléfono o las notas exceden el límite.' };
  try {
    await createRentalContact(membership.agency.id, user.id, { kind: kind as 'LANDLORD' | 'TENANT', name, email: email || null, phone: phone || null, notes: notes || null });
    refresh(slug);
    return { success: 'Contacto guardado.' };
  } catch { return { error: 'No se pudo guardar el contacto.' }; }
}

export async function createRentalContractAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const propertyId = value(data, 'propertyId');
  const landlordContactId = value(data, 'landlordContactId');
  const tenantContactId = value(data, 'tenantContactId');
  const status = value(data, 'status') || 'DRAFT';
  const startDate = value(data, 'startDate');
  const endDate = value(data, 'endDate');
  const monthlyRent = value(data, 'monthlyRent');
  const currency = value(data, 'currency');
  const rentDueDay = Number(value(data, 'rentDueDay'));
  const terms = value(data, 'terms');
  if (![propertyId, landlordContactId, tenantContactId].every(validId) || !rentalContractStatuses.includes(status as (typeof rentalContractStatuses)[number])) return { error: 'Elegí propiedad, propietario, inquilino y estado válidos.' };
  if (!validDate(startDate) || (endDate && !validDate(endDate)) || (endDate && endDate < startDate)) return { error: 'Revisá las fechas del contrato.' };
  if (!validMoney(monthlyRent) || !rentalCurrencies.includes(currency as (typeof rentalCurrencies)[number]) || !Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 28 || terms.length > 12000) return { error: 'Revisá monto, moneda, vencimiento y condiciones.' };
  try {
    const contract = await createRentalContract(membership.agency.id, user.id, {
      propertyId, landlordContactId, tenantContactId, status: status as (typeof rentalContractStatuses)[number], startDate, endDate: endDate || null,
      monthlyRent, currency: currency as (typeof rentalCurrencies)[number], rentDueDay, terms,
    });
    if (!contract) return { error: 'La propiedad, el propietario o el inquilino no pertenecen a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Contrato guardado. Podés generar cargos para sus períodos activos.' };
  } catch { return { error: 'No se pudo guardar el contrato. Verificá que la propiedad no tenga datos de otra inmobiliaria.' }; }
}

export async function createRentChargeAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const contractId = value(data, 'contractId');
  const periodStart = value(data, 'periodStart');
  const dueDate = value(data, 'dueDate');
  const amount = value(data, 'amount');
  if (!validId(contractId) || !validDate(periodStart) || !validDate(dueDate) || (amount && !validMoney(amount))) return { error: 'Revisá período, vencimiento e importe.' };
  try {
    const charge = await createRentCharge(membership.agency.id, user.id, { contractId, periodStart, dueDate, amount: amount || undefined });
    if (!charge) return { error: 'Elegí un contrato activo de esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Cargo mensual registrado.' };
  } catch { return { error: 'No se pudo registrar el cargo. Ese contrato quizá ya tiene un cargo para el período.' }; }
}

export async function createRentPaymentAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const chargeId = value(data, 'chargeId');
  const amount = value(data, 'amount');
  const paidAt = value(data, 'paidAt');
  const method = value(data, 'method');
  const note = value(data, 'note');
  if (!validId(chargeId) || !validMoney(amount) || !validDate(paidAt) || method.length > 80 || note.length > 500) return { error: 'Revisá importe, fecha y medio de pago.' };
  try {
    const result = await createRentPayment(membership.agency.id, user.id, { chargeId, amount, paidAt, method, note });
    if (!result) return { error: 'El cargo no pertenece a esta inmobiliaria.' };
    if ('overpayment' in result) return { error: 'El pago supera el saldo pendiente del cargo.' };
    refresh(slug);
    return { success: 'Pago registrado.' };
  } catch { return { error: 'No se pudo registrar el pago.' }; }
}

export async function createPropertyExpenseAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const propertyId = value(data, 'propertyId');
  const description = value(data, 'description');
  const category = value(data, 'category');
  const amount = value(data, 'amount');
  const currency = value(data, 'currency');
  const dueDate = value(data, 'dueDate');
  const status = value(data, 'status') || 'UNPAID';
  const paidAt = value(data, 'paidAt');
  const note = value(data, 'note');
  if ((propertyId && !validId(propertyId)) || description.length < 2 || description.length > 180 || category.length < 2 || category.length > 80 || !validMoney(amount) || !rentalCurrencies.includes(currency as (typeof rentalCurrencies)[number]) || !['PAID', 'UNPAID'].includes(status)) return { error: 'Revisá descripción, categoría, importe, moneda y estado.' };
  if ((dueDate && !validDate(dueDate)) || (paidAt && !validDate(paidAt)) || note.length > 1000) return { error: 'Revisá las fechas y notas del gasto.' };
  try {
    const expense = await createPropertyExpense(membership.agency.id, user.id, {
      propertyId: propertyId || null, description, category, amount, currency: currency as (typeof rentalCurrencies)[number],
      dueDate: dueDate || null, status: status as 'PAID' | 'UNPAID', paidAt: paidAt || null, note,
    });
    if (!expense) return { error: 'La propiedad elegida no pertenece a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Gasto registrado.' };
  } catch { return { error: 'No se pudo registrar el gasto.' }; }
}

export async function markExpensePaidAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const expenseId = value(data, 'expenseId');
  const paidAt = value(data, 'paidAt');
  if (!validId(expenseId) || !validDate(paidAt)) return { error: 'Elegí un gasto y una fecha válidos.' };
  try {
    if (!await markExpensePaid(membership.agency.id, user.id, expenseId, paidAt)) return { error: 'El gasto no pertenece a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Gasto marcado como pagado.' };
  } catch { return { error: 'No se pudo actualizar el gasto.' }; }
}

export async function applyRentAdjustmentAction(slug: string, _state: RentalActionState, data: FormData): Promise<RentalActionState> {
  const { membership, user } = await context(slug);
  const contractId = value(data, 'contractId');
  const percent = value(data, 'percent');
  const source = value(data, 'source');
  const note = value(data, 'note');
  const effectiveDate = value(data, 'effectiveDate');
  if (!validId(contractId) || !/^-?\d{1,3}(?:\.\d{1,4})?$/.test(percent) || Number(percent) <= -100 || Number(percent) > 1000 || source.length < 2 || source.length > 160 || note.length > 1000 || !validDate(effectiveDate)) return { error: 'Revisá porcentaje, fuente, fecha y nota.' };
  try {
    const result = await applyRentAdjustment(membership.agency.id, user.id, { contractId, percent, source, note, effectiveDate });
    if (!result) return { error: 'El contrato no está activo en esta inmobiliaria.' };
    if ('invalid' in result) return { error: 'El ajuste daría un importe no válido.' };
    refresh(slug);
    return { success: 'Ajuste aplicado y guardado en el historial. Los cargos anteriores siguen intactos.' };
  } catch { return { error: 'No se pudo aplicar el ajuste.' }; }
}
