import { and, eq, inArray, sql } from 'drizzle-orm';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { leadMatchesCrmBrand } from '@/lib/crmBrand';
import type { LeadType } from '@/lib/lifecycle/leadLifecycleValidation';
import { db, type FeedbackDb, type FeedbackDbTransaction } from '@/lib/db';
import { leads, users } from '@/lib/db/schema';
import { getEligibleDts, isDtEligible } from '@/lib/services/dtBrandProfileService';

export type DistributionDtLoad = {
  dtId: string;
  dtName: string;
  assignedCount: number;
};

export type SelectLeastLoadedDtOptions = {
  brand: CrmBrand;
  leadType: LeadType;
};

/**
 * Fitty-style least-load distribution:
 * - only brand-active DT users eligible for the lead type
 * - fallback is deterministic by DT id for equal loads
 * - load counts scoped to the given brand
 */
export async function selectLeastLoadedDt(
  preferredDtId: string | null | undefined,
  tx: FeedbackDbTransaction | FeedbackDb | undefined,
  options: SelectLeastLoadedDtOptions
): Promise<string | null> {
  const d = tx ?? db;
  const { brand, leadType } = options;

  if (preferredDtId) {
    const eligible = await isDtEligible(preferredDtId, brand, leadType, d);
    if (eligible) return preferredDtId;
  }

  const eligibleDts = await getEligibleDts({ brand, leadType, tx: d });
  if (!eligibleDts.length) {
    console.warn('[callDistribution] No eligible DT for assignment', { brand, leadType });
    return null;
  }

  const eligibleIds = eligibleDts.map((dt) => dt.id);
  const brandLeadMatch = leadMatchesCrmBrand(brand);

  const dtLoads = await d
    .select({
      dtId: users.id,
      assignedCount: sql<number>`COUNT(${leads.id})`,
    })
    .from(users)
    .leftJoin(
      leads,
      and(eq(leads.assigned_dt_id, users.id), brandLeadMatch)
    )
    .where(and(eq(users.role, 'dt'), inArray(users.id, eligibleIds)))
    .groupBy(users.id);

  const loadById = new Map(dtLoads.map((row) => [row.dtId, Number(row.assignedCount)]));

  const sorted = [...eligibleDts].sort((a, b) => {
    const countDiff = (loadById.get(a.id) ?? 0) - (loadById.get(b.id) ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.id.localeCompare(b.id);
  });

  return sorted[0]?.id ?? null;
}

export async function getDtLoadDistribution(
  tx?: FeedbackDbTransaction | FeedbackDb,
  brand?: CrmBrand
): Promise<DistributionDtLoad[]> {
  const d = tx ?? db;
  if (!brand) {
    const rows = await d
      .select({
        dtId: users.id,
        dtName: users.name,
        assignedCount: sql<number>`COUNT(${leads.id})`,
      })
      .from(users)
      .leftJoin(leads, eq(leads.assigned_dt_id, users.id))
      .where(and(eq(users.role, 'dt'), eq(users.active_status, true)))
      .groupBy(users.id, users.name);

    return rows
      .map((row) => ({
        dtId: row.dtId,
        dtName: row.dtName,
        assignedCount: Number(row.assignedCount),
      }))
      .sort((a, b) => a.assignedCount - b.assignedCount || a.dtName.localeCompare(b.dtName));
  }

  const { getBrandActiveDietitians } = await import('@/lib/services/dtBrandProfileService');
  const activeDts = await getBrandActiveDietitians(brand, d);
  if (!activeDts.length) return [];

  const activeIds = activeDts.map((dt) => dt.id);
  const brandLeadMatch = leadMatchesCrmBrand(brand);

  const rows = await d
    .select({
      dtId: users.id,
      dtName: users.name,
      assignedCount: sql<number>`COUNT(${leads.id})`,
    })
    .from(users)
    .leftJoin(leads, and(eq(leads.assigned_dt_id, users.id), brandLeadMatch))
    .where(and(eq(users.role, 'dt'), inArray(users.id, activeIds)))
    .groupBy(users.id, users.name);

  const countById = new Map(rows.map((r) => [r.dtId, Number(r.assignedCount)]));

  return activeDts
    .map((dt) => ({
      dtId: dt.id,
      dtName: dt.name,
      assignedCount: countById.get(dt.id) ?? 0,
    }))
    .sort((a, b) => a.assignedCount - b.assignedCount || a.dtName.localeCompare(b.dtName));
}
