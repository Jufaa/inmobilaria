CREATE TYPE "PointOfInterestCategory" AS ENUM (
  'PARK',
  'AVENUE',
  'SCHOOL',
  'SHOPPING',
  'HOSPITAL',
  'LANDMARK',
  'OTHER'
);

CREATE TABLE "Zone" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "city" VARCHAR(120) NOT NULL DEFAULT 'Río Cuarto',
  "geometry" JSONB,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointOfInterest" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "zoneId" TEXT,
  "name" VARCHAR(120) NOT NULL,
  "category" "PointOfInterestCategory" NOT NULL DEFAULT 'OTHER',
  "description" VARCHAR(500),
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointOfInterest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Property" ADD COLUMN "zoneId" TEXT;

CREATE UNIQUE INDEX "Zone_agencyId_city_name_key" ON "Zone"("agencyId", "city", "name");
CREATE INDEX "Zone_agencyId_city_idx" ON "Zone"("agencyId", "city");
CREATE INDEX "PointOfInterest_agencyId_zoneId_idx" ON "PointOfInterest"("agencyId", "zoneId");
CREATE INDEX "PointOfInterest_agencyId_category_idx" ON "PointOfInterest"("agencyId", "category");
CREATE INDEX "Property_zoneId_status_idx" ON "Property"("zoneId", "status");

ALTER TABLE "Zone" ADD CONSTRAINT "Zone_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointOfInterest" ADD CONSTRAINT "PointOfInterest_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointOfInterest" ADD CONSTRAINT "PointOfInterest_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_zoneId_fkey"
  FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
