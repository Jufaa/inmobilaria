export const demoCopyTables = [
  'User', 'Agency', 'Membership', 'AgencyPresentationConfig', 'Zone', 'RentalContact',
  'AgencyConnection', 'Property', 'PointOfInterest', 'PropertyMedia', 'PropertyShareGrant',
  'PropertyInquiry', 'AnalyticsEvent', 'RentalContract', 'PropertyExpense', 'RentalAuditEvent',
  'CollaborationEvent', 'RentAdjustment', 'RentCharge', 'RentPayment',
] as const;
export const excludedDemoTables = ['Account', 'Session', 'VerificationToken'] as const;
export function validateDemoCopyTargets(source: string, target: string, confirmed: boolean) {
  if (!confirmed) throw new Error('Explicit fictitious-data confirmation is required.');
  const from = new URL(source), to = new URL(target);
  const postgres = (url: URL) => ['postgres:', 'postgresql:'].includes(url.protocol);
  if (!postgres(from) || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(from.hostname)) throw new Error('Source must be a local PostgreSQL database.');
  if (!postgres(to) || !to.hostname.endsWith('.neon.tech') || to.hostname.includes('-pooler')) throw new Error('Target must be the direct Neon PostgreSQL connection.');
}
