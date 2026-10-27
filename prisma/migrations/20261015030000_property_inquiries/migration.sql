CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED');

CREATE TABLE "PropertyInquiry" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ownerAgencyId" TEXT NOT NULL,
    "presentingAgencyId" TEXT NOT NULL,
    "contactName" VARCHAR(100) NOT NULL,
    "contactEmail" VARCHAR(254) NOT NULL,
    "contactPhone" VARCHAR(40),
    "message" VARCHAR(2000) NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyInquiry_ownerAgencyId_createdAt_idx" ON "PropertyInquiry"("ownerAgencyId", "createdAt");
CREATE INDEX "PropertyInquiry_presentingAgencyId_createdAt_idx" ON "PropertyInquiry"("presentingAgencyId", "createdAt");
CREATE INDEX "PropertyInquiry_propertyId_createdAt_idx" ON "PropertyInquiry"("propertyId", "createdAt");
CREATE INDEX "PropertyInquiry_status_createdAt_idx" ON "PropertyInquiry"("status", "createdAt");

ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_ownerAgencyId_fkey" FOREIGN KEY ("ownerAgencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_presentingAgencyId_fkey" FOREIGN KEY ("presentingAgencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
