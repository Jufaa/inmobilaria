ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "presentingAgencyId" TEXT;

CREATE INDEX "AnalyticsEvent_presentingAgencyId_createdAt_type_idx"
  ON "AnalyticsEvent"("presentingAgencyId", "createdAt", "type");

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_presentingAgencyId_fkey"
  FOREIGN KEY ("presentingAgencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
