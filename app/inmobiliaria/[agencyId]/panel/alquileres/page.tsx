import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { RentalManager } from '@/components/auth/RentalManager';
import { requireAgencyFinanceAccess } from '@/lib/agency-access';
import { listRentalDashboard } from '@/lib/rentals/rental-service';
import { Prisma } from '@/generated/prisma/client';

export default async function RentalsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership } = await requireAgencyFinanceAccess(agencyId);
  const data = await listRentalDashboard(membership.agency.id);
  const charges = data.charges.map((charge) => {
    const paidAmount = charge.payments.reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0));
    const balance = charge.amount.sub(paidAmount);
    return {
      id: charge.id,
      contractId: charge.contractId,
      amount: charge.amount.toString(),
      paidAmount: paidAmount.toString(),
      balance: balance.toString(),
      status: charge.status,
      currency: charge.contract.currency,
      dueDate: charge.dueDate.toISOString(),
      periodStart: charge.periodStart.toISOString(),
      propertyTitle: charge.contract.property.title,
      tenantName: charge.contract.tenant.name,
    };
  }).filter((charge) => Number(charge.balance) > 0);

  return <WorkspaceShell
    agencyName={membership.agency.name}
    agencySlug={agencyId}
    email={user.email}
    activeSection="rentals"
    canManageCollaboration
    canManageRentals
  >
    <RentalManager
      slug={agencyId}
      contacts={data.contacts}
      properties={data.properties}
      contracts={data.contracts.map((contract) => ({
        ...contract,
        startDate: contract.startDate.toISOString(),
        endDate: contract.endDate?.toISOString() ?? null,
        monthlyRent: contract.monthlyRent.toString(),
        adjustments: contract.adjustments.map((adjustment) => ({
          ...adjustment,
          oldMonthlyRent: adjustment.oldMonthlyRent.toString(),
          newMonthlyRent: adjustment.newMonthlyRent.toString(),
          percent: adjustment.percent.toString(),
          effectiveDate: adjustment.effectiveDate.toISOString(),
        })),
        charges: contract.charges.map((charge) => ({
          id: charge.id,
          contractId: charge.contractId,
          amount: charge.amount.toString(),
          paidAmount: charge.payments.reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0)).toString(),
          balance: charge.amount.sub(charge.payments.reduce((total, payment) => total.add(payment.amount), new Prisma.Decimal(0))).toString(),
          status: charge.status,
          currency: contract.currency,
          dueDate: charge.dueDate.toISOString(),
          periodStart: charge.periodStart.toISOString(),
          propertyTitle: contract.property.title,
          tenantName: contract.tenant.name,
          payments: charge.payments.map((payment) => ({ ...payment, amount: payment.amount.toString(), paidAt: payment.paidAt.toISOString() })),
        })),
      }))}
      charges={charges}
      expenses={data.expenses.map((expense) => ({ ...expense, amount: expense.amount.toString(), dueDate: expense.dueDate?.toISOString() ?? null, paidAt: expense.paidAt?.toISOString() ?? null }))}
      auditEvents={data.auditEvents.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() }))}
    />
  </WorkspaceShell>;
}
