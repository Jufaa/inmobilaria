CREATE TYPE "AgencyConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ENDED');
CREATE TYPE "CollaborationEventType" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED', 'ENDED', 'PROPERTY_SHARED', 'PROPERTY_SHARE_REVOKED');

CREATE TABLE "AgencyConnection" (
    "id" TEXT NOT NULL,
    "agencyLowId" TEXT NOT NULL,
    "agencyHighId" TEXT NOT NULL,
    "requestedByAgencyId" TEXT NOT NULL,
    "status" "AgencyConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lowCommissionPercent" INTEGER,
    "highCommissionPercent" INTEGER,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgencyConnection_distinct_agencies_check" CHECK ("agencyLowId" < "agencyHighId"),
    CONSTRAINT "AgencyConnection_requester_in_pair_check" CHECK ("requestedByAgencyId" IN ("agencyLowId", "agencyHighId")),
    CONSTRAINT "AgencyConnection_commission_bounds_check" CHECK (
      ("lowCommissionPercent" IS NULL AND "highCommissionPercent" IS NULL) OR
      ("lowCommissionPercent" BETWEEN 0 AND 100 AND "highCommissionPercent" BETWEEN 0 AND 100 AND "lowCommissionPercent" + "highCommissionPercent" = 100)
    ),
    CONSTRAINT "AgencyConnection_accepted_terms_check" CHECK ("status" <> 'ACCEPTED' OR "lowCommissionPercent" IS NOT NULL)
);

CREATE TABLE "PropertyShareGrant" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ownerAgencyId" TEXT NOT NULL,
    "recipientAgencyId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "PropertyShareGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PropertyShareGrant_distinct_agencies_check" CHECK ("ownerAgencyId" <> "recipientAgencyId"),
    CONSTRAINT "PropertyShareGrant_revocation_check" CHECK (("active" AND "revokedAt" IS NULL) OR (NOT "active" AND "revokedAt" IS NOT NULL))
);

CREATE TABLE "CollaborationEvent" (
    "id" TEXT NOT NULL,
    "type" "CollaborationEventType" NOT NULL,
    "connectionId" TEXT,
    "shareGrantId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorAgencyId" TEXT NOT NULL,
    "targetAgencyId" TEXT,
    "propertyId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaborationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyConnection_agencyLowId_agencyHighId_key" ON "AgencyConnection"("agencyLowId", "agencyHighId");
CREATE INDEX "AgencyConnection_agencyLowId_status_idx" ON "AgencyConnection"("agencyLowId", "status");
CREATE INDEX "AgencyConnection_agencyHighId_status_idx" ON "AgencyConnection"("agencyHighId", "status");
CREATE UNIQUE INDEX "PropertyShareGrant_propertyId_recipientAgencyId_key" ON "PropertyShareGrant"("propertyId", "recipientAgencyId");
CREATE INDEX "PropertyShareGrant_ownerAgencyId_active_grantedAt_idx" ON "PropertyShareGrant"("ownerAgencyId", "active", "grantedAt");
CREATE INDEX "PropertyShareGrant_recipientAgencyId_active_grantedAt_idx" ON "PropertyShareGrant"("recipientAgencyId", "active", "grantedAt");
CREATE INDEX "CollaborationEvent_actorAgencyId_createdAt_idx" ON "CollaborationEvent"("actorAgencyId", "createdAt");
CREATE INDEX "CollaborationEvent_targetAgencyId_createdAt_idx" ON "CollaborationEvent"("targetAgencyId", "createdAt");
CREATE INDEX "CollaborationEvent_propertyId_createdAt_idx" ON "CollaborationEvent"("propertyId", "createdAt");

ALTER TABLE "AgencyConnection" ADD CONSTRAINT "AgencyConnection_agencyLowId_fkey" FOREIGN KEY ("agencyLowId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyConnection" ADD CONSTRAINT "AgencyConnection_agencyHighId_fkey" FOREIGN KEY ("agencyHighId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyConnection" ADD CONSTRAINT "AgencyConnection_requestedByAgencyId_fkey" FOREIGN KEY ("requestedByAgencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyShareGrant" ADD CONSTRAINT "PropertyShareGrant_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgencyConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyShareGrant" ADD CONSTRAINT "PropertyShareGrant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyShareGrant" ADD CONSTRAINT "PropertyShareGrant_ownerAgencyId_fkey" FOREIGN KEY ("ownerAgencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyShareGrant" ADD CONSTRAINT "PropertyShareGrant_recipientAgencyId_fkey" FOREIGN KEY ("recipientAgencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyShareGrant" ADD CONSTRAINT "PropertyShareGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgencyConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_shareGrantId_fkey" FOREIGN KEY ("shareGrantId") REFERENCES "PropertyShareGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_actorAgencyId_fkey" FOREIGN KEY ("actorAgencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
