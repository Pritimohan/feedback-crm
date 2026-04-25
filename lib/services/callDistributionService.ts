import { and, eq, sql } from 'drizzle-orm';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { leadMatchesCrmBrand } from '@/lib/crmBrand';
import { db, type FeedbackDbTransaction } from '@/lib/db';
import { leads, users } from '@/lib/db/schema';

export type DistributionDtLoad = {
  dtId: string;
  dtName: string;
  assignedCount: number;
};

/**
 * Fitty-style least-load distribution:
 * - only active DT users are eligible
 * - fallback is deterministic by DT id for equal loads
 */
export async function selectLeastLoadedDt(
  preferredDtId?: string | null,
  tx?: FeedbackDbTransaction
): Promise<string | null> {
  const d = tx ?? db;

  if (preferredDtId) {
    const [preferred] = await d
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, preferredDtId), eq(users.role, 'dt'), eq(users.active_status, true)));
    if (preferred) return preferred.id;
  }

  const dtLoads = await d
    .select({
      dtId: users.id,
      assignedCount: sql<number>`COUNT(${leads.id})`,
    })
    .from(users)
    .leftJoin(leads, eq(leads.assigned_dt_id, users.id))
    .where(and(eq(users.role, 'dt'), eq(users.active_status, true)))
    .groupBy(users.id);

  if (!dtLoads.length) return null;

  dtLoads.sort((a, b) => {
    const countDiff = Number(a.assignedCount) - Number(b.assignedCount);
    if (countDiff !== 0) return countDiff;
    return (a.dtId ?? '').localeCompare(b.dtId ?? '');
  });

  return dtLoads[0]?.dtId ?? null;
}

export async function getDtLoadDistribution(
  tx?: FeedbackDbTransaction,
  brand?: CrmBrand
): Promise<DistributionDtLoad[]> {
  const d = tx ?? db;
  const joinOn = brand
    ? and(eq(leads.assigned_dt_id, users.id), leadMatchesCrmBrand(brand))
    : eq(leads.assigned_dt_id, users.id);
  const rows = await d
    .select({
      dtId: users.id,
      dtName: users.name,
      assignedCount: sql<number>`COUNT(${leads.id})`,
    })
    .from(users)
    .leftJoin(leads, joinOn)
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
