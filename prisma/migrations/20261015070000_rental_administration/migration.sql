CREATE TYPE "RentalContactKind" AS ENUM ('LANDLORD', 'TENANT');
CREATE TYPE "RentalContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');
CREATE TYPE "RentChargeStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID');
CREATE TYPE "ExpenseStatus" AS ENUM ('UNPAID', 'PAID');

CREATE TABLE "RentalContact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" "RentalContactKind" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RentalContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalContract" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "landlordContactId" TEXT NOT NULL,
    "tenantContactId" TEXT NOT NULL,
    "status" "RentalContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "monthlyRent" DECIMAL(14,2) NOT NULL,
    "currency" "PriceCurrency" NOT NULL DEFAULT 'ARS',
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "terms" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RentalContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentAdjustment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "oldMonthlyRent" DECIMAL(14,2) NOT NULL,
    "newMonthlyRent" DECIMAL(14,2) NOT NULL,
    "percent" DECIMAL(8,4) NOT NULL,
    "source" VARCHAR(160) NOT NULL,
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "effectiveDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentCharge" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "RentChargeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RentCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "method" VARCHAR(80) NOT NULL DEFAULT '',
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyExpense" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "propertyId" TEXT,
    "description" VARCHAR(180) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "PriceCurrency" NOT NULL DEFAULT 'ARS',
    "dueDate" DATE,
    "paidAt" DATE,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'UNPAID',
    "note" VARCHAR(1000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RentalAuditEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RentalContact_agencyId_kind_name_idx" ON "RentalContact"("agencyId", "kind", "name");
CREATE INDEX "RentalContract_agencyId_status_endDate_idx" ON "RentalContract"("agencyId", "status", "endDate");
CREATE INDEX "RentalContract_agencyId_propertyId_idx" ON "RentalContract"("agencyId", "propertyId");
CREATE INDEX "RentAdjustment_agencyId_effectiveDate_idx" ON "RentAdjustment"("agencyId", "effectiveDate");
CREATE INDEX "RentAdjustment_contractId_effectiveDate_idx" ON "RentAdjustment"("contractId", "effectiveDate");
CREATE UNIQUE INDEX "RentCharge_contractId_periodStart_key" ON "RentCharge"("contractId", "periodStart");
CREATE INDEX "RentCharge_agencyId_dueDate_status_idx" ON "RentCharge"("agencyId", "dueDate", "status");
CREATE INDEX "RentPayment_agencyId_paidAt_idx" ON "RentPayment"("agencyId", "paidAt");
CREATE INDEX "RentPayment_chargeId_paidAt_idx" ON "RentPayment"("chargeId", "paidAt");
CREATE INDEX "PropertyExpense_agencyId_status_dueDate_idx" ON "PropertyExpense"("agencyId", "status", "dueDate");
CREATE INDEX "PropertyExpense_agencyId_propertyId_idx" ON "PropertyExpense"("agencyId", "propertyId");
CREATE INDEX "RentalAuditEvent_agencyId_createdAt_idx" ON "RentalAuditEvent"("agencyId", "createdAt");
CREATE INDEX "RentalAuditEvent_agencyId_entityType_entityId_idx" ON "RentalAuditEvent"("agencyId", "entityType", "entityId");

ALTER TABLE "RentalContact" ADD CONSTRAINT "RentalContact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_landlordContactId_fkey" FOREIGN KEY ("landlordContactId") REFERENCES "RentalContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_tenantContactId_fkey" FOREIGN KEY ("tenantContactId") REFERENCES "RentalContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentAdjustment" ADD CONSTRAINT "RentAdjustment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "RentCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RentalAuditEvent" ADD CONSTRAINT "RentalAuditEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalAuditEvent" ADD CONSTRAINT "RentalAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
