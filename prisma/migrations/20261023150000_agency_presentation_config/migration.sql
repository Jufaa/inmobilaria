CREATE TABLE "AgencyPresentationConfig" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "presentationSettings" JSONB,
    "demoTourConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyPresentationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyPresentationConfig_agencyId_key" ON "AgencyPresentationConfig"("agencyId");

ALTER TABLE "AgencyPresentationConfig"
ADD CONSTRAINT "AgencyPresentationConfig_agencyId_fkey"
FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
