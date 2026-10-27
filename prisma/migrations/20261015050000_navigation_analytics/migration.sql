CREATE TYPE "AnalyticsEventType" AS ENUM (
  'LISTING_VIEW',
  'PROPERTY_VIEW',
  'SEARCH',
  'ZONE_SELECTION',
  'INQUIRY_SUBMISSION'
);

CREATE TABLE "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "type" "AnalyticsEventType" NOT NULL,
  "propertyId" TEXT,
  "zoneId" TEXT,
  "operation" "PropertyOperation",
  "propertyType" "PropertyType",
  "currency" "PriceCurrency",
  "bedroomsFrom" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_agencyId_createdAt_type_idx"
  ON "AnalyticsEvent"("agencyId", "createdAt", "type");
CREATE INDEX "AnalyticsEvent_agencyId_propertyId_createdAt_idx"
  ON "AnalyticsEvent"("agencyId", "propertyId", "createdAt");
CREATE INDEX "AnalyticsEvent_agencyId_zoneId_createdAt_idx"
  ON "AnalyticsEvent"("agencyId", "zoneId", "createdAt");

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
