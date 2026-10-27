CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'PH', 'LAND', 'COMMERCIAL', 'OTHER');
CREATE TYPE "PropertyOperation" AS ENUM ('SALE', 'RENT');
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD', 'UNAVAILABLE');
CREATE TYPE "PriceCurrency" AS ENUM ('ARS', 'USD');
CREATE TYPE "PropertyMediaKind" AS ENUM ('PHOTO', 'VIDEO', 'TOUR_360');

CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "operation" "PropertyOperation" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(14,2) NOT NULL,
    "currency" "PriceCurrency" NOT NULL DEFAULT 'USD',
    "neighborhood" VARCHAR(120) NOT NULL,
    "address" VARCHAR(240) NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "bedrooms" INTEGER NOT NULL DEFAULT 0,
    "bathrooms" INTEGER NOT NULL DEFAULT 0,
    "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyMedia" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "PropertyMediaKind" NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "caption" VARCHAR(240),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Property_agencyId_status_updatedAt_idx" ON "Property"("agencyId", "status", "updatedAt");
CREATE INDEX "Property_agencyId_neighborhood_idx" ON "Property"("agencyId", "neighborhood");
CREATE INDEX "PropertyMedia_propertyId_sortOrder_idx" ON "PropertyMedia"("propertyId", "sortOrder");

ALTER TABLE "Property" ADD CONSTRAINT "Property_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
