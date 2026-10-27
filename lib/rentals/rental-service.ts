import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export const rentalContactKinds = ['LANDLORD', 'TENANT'] as const;
export const rentalContractStatuses = ['DRAFT', 'ACTIVE', 'ENDED'] as const;
export const rentalCurrencies = ['ARS', 'USD'] as const;

const money = (value: string | number) => new Prisma.Decimal(value);
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function audit(tx: Prisma.TransactionClient, input: {
  agencyId: string; actorUserId: string; action: string; entityType: string; entityId: string; details?: Prisma.InputJsonValue;
}) {
  await tx.rentalAuditEvent.create({ data: input });
}

export async function listRentalDashboard(agencyId: string) {
  const [contacts, properties, contracts, charges, expenses, auditEvents] = await Promise.all([
    prisma.rentalContact.findMany({ where: { agencyId }, orderBy: [{ kind: 'asc' }, { name: 'asc' }] }),
    prisma.property.findMany({ where: { agencyId, operation: 'RENT' }, select: { id: true, title: true, neighborhood: true }, orderBy: { title: 'asc' } }),
    prisma.rentalContract.findMany({
      where: { agencyId },
      include: {
        property: { select: { id: true, title: true, neighborhood: true } },
        landlord: { select: { id: true, name: true, email: true, phone: true } },
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        adjustments: { orderBy: { effectiveDate: 'desc' }, take: 10 },
        charges: { orderBy: [{ dueDate: 'desc' }], take: 24, include: { payments: { orderBy: { paidAt: 'desc' } } } },
      }, orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.rentCharge.findMany({
      where: { agencyId, status: { in: ['OPEN', 'PARTIAL'] } },
      include: { contract: { select: { id: true, currency: true, property: { select: { title: true } }, tenant: { select: { name: true } } }, }, payments: true },
      orderBy: [{ dueDate: 'asc' }], take: 100,
    }),
    prisma.propertyExpense.findMany({ where: { agencyId }, include: { property: { select: { title: true } } }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }], take: 100 }),
    prisma.rentalAuditEvent.findMany({ where: { agencyId }, include: { actorUser: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);

  return { contacts, properties, contracts, charges, expenses, auditEvents };
}

export async function createRentalContact(agencyId: string, actorUserId: string, data: {
  kind: 'LANDLORD' | 'TENANT'; name: string; email: string | null; phone: string | null; notes: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const contact = await tx.rentalContact.create({ data: { agencyId, ...data } });
    await audit(tx, { agencyId, actorUserId, action: 'CONTACT_CREATED', entityType: 'RentalContact', entityId: contact.id, details: { kind: data.kind } });
    return contact;
  });
}

export async function createRentalContract(agencyId: string, actorUserId: string, data: {
  propertyId: string; landlordContactId: string; tenantContactId: string; status: 'DRAFT' | 'ACTIVE' | 'ENDED';
  startDate: string; endDate: string | null; monthlyRent: string; currency: 'ARS' | 'USD'; rentDueDay: number; terms: string;
}) {
  const [property, landlord, tenant] = await Promise.all([
    prisma.property.findFirst({ where: { id: data.propertyId, agencyId, operation: 'RENT' }, select: { id: true } }),
    prisma.rentalContact.findFirst({ where: { id: data.landlordContactId, agencyId, kind: 'LANDLORD' }, select: { id: true } }),
    prisma.rentalContact.findFirst({ where: { id: data.tenantContactId, agencyId, kind: 'TENANT' }, select: { id: true } }),
  ]);
  if (!property || !landlord || !tenant) return null;
  return prisma.$transaction(async (tx) => {
    const contract = await tx.rentalContract.create({ data: {
      agencyId, propertyId: data.propertyId, landlordContactId: data.landlordContactId, tenantContactId: data.tenantContactId,
      status: data.status, startDate: dateOnly(data.startDate), endDate: data.endDate ? dateOnly(data.endDate) : null,
      monthlyRent: money(data.monthlyRent), currency: data.currency, rentDueDay: data.rentDueDay, terms: data.terms,
    } });
    await audit(tx, { agencyId, actorUserId, action: 'CONTRACT_CREATED', entityType: 'RentalContract', entityId: contract.id, details: { status: contract.status } });
    return contract;
  });
}

export async function createRentCharge(agencyId: string, actorUserId: string, data: { contractId: string; periodStart: string; dueDate: string; amount?: string }) {
  const contract = await prisma.rentalContract.findFirst({ where: { id: data.contractId, agencyId, status: 'ACTIVE' }, select: { id: true, monthlyRent: true } });
  if (!contract) return null;
  return prisma.$transaction(async (tx) => {
    const charge = await tx.rentCharge.create({ data: {
      agencyId, contractId: contract.id, periodStart: dateOnly(data.periodStart), dueDate: dateOnly(data.dueDate),
      amount: money(data.amount ?? contract.monthlyRent.toString()),
    } });
    await audit(tx, { agencyId, actorUserId, action: 'RENT_CHARGE_CREATED', entityType: 'RentCharge', entityId: charge.id, details: { amount: charge.amount.toString() } });
    return charge;
  });
}

export async function createRentPayment(agencyId: string, actorUserId: string, data: { chargeId: string; amount: string; paidAt: string; method: string; note: string }) {
  return prisma.$transaction(async (tx) => {
    const charge = await tx.rentCharge.findFirst({ where: { id: data.chargeId, agencyId }, include: { payments: true } });
    if (!charge) return null;
    const paid = charge.payments.reduce((total, payment) => total.add(payment.amount), money(0));
    const amount = money(data.amount);
    const remaining = charge.amount.sub(paid);
    if (amount.lte(0) || amount.gt(remaining)) return { overpayment: true as const };
    const payment = await tx.rentPayment.create({ data: { agencyId, actorUserId, chargeId: charge.id, amount, paidAt: dateOnly(data.paidAt), method: data.method, note: data.note } });
    const newPaid = paid.add(amount);
    const status = newPaid.eq(charge.amount) ? 'PAID' : 'PARTIAL';
    await tx.rentCharge.update({ where: { id: charge.id }, data: { status } });
    await audit(tx, { agencyId, actorUserId, action: 'RENT_PAYMENT_RECORDED', entityType: 'RentPayment', entityId: payment.id, details: { chargeId: charge.id, amount: amount.toString(), status } });
    return { payment };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createPropertyExpense(agencyId: string, actorUserId: string, data: {
  propertyId: string | null; description: string; category: string; amount: string; currency: 'ARS' | 'USD';
  dueDate: string | null; status: 'PAID' | 'UNPAID'; paidAt: string | null; note: string;
}) {
  if (data.propertyId && !await prisma.property.findFirst({ where: { id: data.propertyId, agencyId }, select: { id: true } })) return null;
  return prisma.$transaction(async (tx) => {
    const expense = await tx.propertyExpense.create({ data: {
      agencyId, propertyId: data.propertyId, description: data.description, category: data.category, amount: money(data.amount), currency: data.currency,
      dueDate: data.dueDate ? dateOnly(data.dueDate) : null, status: data.status, paidAt: data.status === 'PAID' ? dateOnly(data.paidAt ?? new Date().toISOString().slice(0, 10)) : null, note: data.note,
    } });
    await audit(tx, { agencyId, actorUserId, action: 'EXPENSE_CREATED', entityType: 'PropertyExpense', entityId: expense.id, details: { amount: expense.amount.toString(), status: expense.status } });
    return expense;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markExpensePaid(agencyId: string, actorUserId: string, expenseId: string, paidAt: string) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.propertyExpense.findFirst({ where: { id: expenseId, agencyId }, select: { id: true, status: true } });
    if (!expense) return false;
    await tx.propertyExpense.update({ where: { id: expense.id }, data: { status: 'PAID', paidAt: dateOnly(paidAt) } });
    await audit(tx, { agencyId, actorUserId, action: 'EXPENSE_MARKED_PAID', entityType: 'PropertyExpense', entityId: expense.id });
    return true;
  });
}

export async function applyRentAdjustment(agencyId: string, actorUserId: string, data: {
  contractId: string; percent: string; source: string; note: string; effectiveDate: string;
}) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.rentalContract.findFirst({ where: { id: data.contractId, agencyId, status: 'ACTIVE' }, select: { id: true, monthlyRent: true } });
    if (!contract) return null;
    const oldAmount = contract.monthlyRent;
    const percent = money(data.percent);
    const newAmount = oldAmount.mul(money(1).add(percent.div(100))).toDecimalPlaces(2);
    if (newAmount.lte(0)) return { invalid: true as const };
    const adjustment = await tx.rentAdjustment.create({ data: {
      agencyId, contractId: contract.id, actorUserId, oldMonthlyRent: oldAmount, newMonthlyRent: newAmount, percent,
      source: data.source, note: data.note, effectiveDate: dateOnly(data.effectiveDate),
    } });
    await tx.rentalContract.update({ where: { id: contract.id }, data: { monthlyRent: newAmount } });
    await audit(tx, { agencyId, actorUserId, action: 'RENT_ADJUSTMENT_APPLIED', entityType: 'RentAdjustment', entityId: adjustment.id, details: { oldAmount: oldAmount.toString(), newAmount: newAmount.toString(), percent: percent.toString() } });
    return adjustment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
