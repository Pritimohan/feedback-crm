import { and, eq, sql } from 'drizzle-orm';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import type { LeadType } from '@/lib/lifecycle/leadLifecycleValidation';
import { db, type FeedbackDb } from '@/lib/db';
import { userBrandProfiles, users } from '@/lib/db/schema';

export const ALL_LEAD_TYPES: LeadType[] = ['review', 'nps', 'feedback'];
export const CRM_BRANDS: CrmBrand[] = ['fitty', 'fitelo'];
export const DEFAULT_ELIGIBLE_LEAD_TYPES: LeadType[] = ['review'];

export type BrandProfilePatch = {
  is_active?: boolean;
  eligible_lead_types?: LeadType[];
};

export type BrandProfileView = {
  brand: CrmBrand;
  is_active: boolean;
  eligible_lead_types: LeadType[];
};

export function validateEligibleLeadTypes(types: unknown): LeadType[] {
  if (!Array.isArray(types) || types.length === 0) {
    throw new Error('At least one lead type is required');
  }
  const normalized = [...new Set(types.map(String))] as LeadType[];
  for (const t of normalized) {
    if (!ALL_LEAD_TYPES.includes(t)) {
      throw new Error(`Invalid lead type: ${t}`);
    }
  }
  return normalized;
}

export async function ensureDefaultProfilesForDt(userId: string, tx?: FeedbackDb) {
  const d = tx ?? db;
  const now = new Date();
  for (const brand of CRM_BRANDS) {
    await d
      .insert(userBrandProfiles)
      .values({
        user_id: userId,
        brand,
        is_active: true,
        eligible_lead_types: DEFAULT_ELIGIBLE_LEAD_TYPES,
        updated_at: now,
      })
      .onConflictDoNothing();
  }
}

export async function getBrandProfile(
  userId: string,
  brand: CrmBrand,
  tx?: FeedbackDb
): Promise<BrandProfileView | null> {
  const d = tx ?? db;
  const [row] = await d
    .select({
      brand: userBrandProfiles.brand,
      is_active: userBrandProfiles.is_active,
      eligible_lead_types: userBrandProfiles.eligible_lead_types,
    })
    .from(userBrandProfiles)
    .where(and(eq(userBrandProfiles.user_id, userId), eq(userBrandProfiles.brand, brand)));

  if (!row) return null;
  return {
    brand: row.brand as CrmBrand,
    is_active: row.is_active,
    eligible_lead_types: row.eligible_lead_types as LeadType[],
  };
}

export async function listBrandProfilesForUser(userId: string, tx?: FeedbackDb): Promise<BrandProfileView[]> {
  const d = tx ?? db;
  const rows = await d
    .select({
      brand: userBrandProfiles.brand,
      is_active: userBrandProfiles.is_active,
      eligible_lead_types: userBrandProfiles.eligible_lead_types,
    })
    .from(userBrandProfiles)
    .where(eq(userBrandProfiles.user_id, userId));

  return rows.map((row) => ({
    brand: row.brand as CrmBrand,
    is_active: row.is_active,
    eligible_lead_types: row.eligible_lead_types as LeadType[],
  }));
}

export async function upsertBrandProfile(
  userId: string,
  brand: CrmBrand,
  patch: BrandProfilePatch,
  tx?: FeedbackDb
): Promise<BrandProfileView> {
  const d = tx ?? db;

  const [user] = await d.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');
  if (user.role !== 'dt') throw new Error('Brand profiles apply only to agents');

  const existing = await getBrandProfile(userId, brand, d);
  const now = new Date();

  const nextIsActive = patch.is_active ?? existing?.is_active ?? true;
  const nextLeadTypes =
    patch.eligible_lead_types != null
      ? validateEligibleLeadTypes(patch.eligible_lead_types)
      : (existing?.eligible_lead_types ?? DEFAULT_ELIGIBLE_LEAD_TYPES);

  if (existing) {
    await d
      .update(userBrandProfiles)
      .set({
        is_active: nextIsActive,
        eligible_lead_types: nextLeadTypes,
        updated_at: now,
      })
      .where(and(eq(userBrandProfiles.user_id, userId), eq(userBrandProfiles.brand, brand)));
  } else {
    await d.insert(userBrandProfiles).values({
      user_id: userId,
      brand,
      is_active: nextIsActive,
      eligible_lead_types: nextLeadTypes,
      updated_at: now,
    });
  }

  return {
    brand,
    is_active: nextIsActive,
    eligible_lead_types: nextLeadTypes,
  };
}

/** SQL fragment: lead_type is contained in profile eligible_lead_types array. */
export function leadTypeInProfileEligibleTypes(leadType: LeadType) {
  return sql`${leadType} = ANY(${userBrandProfiles.eligible_lead_types})`;
}

export async function isDtEligible(
  userId: string,
  brand: CrmBrand,
  leadType: LeadType,
  tx?: FeedbackDb
): Promise<boolean> {
  const d = tx ?? db;
  const [row] = await d
    .select({ id: users.id })
    .from(users)
    .innerJoin(
      userBrandProfiles,
      and(eq(userBrandProfiles.user_id, users.id), eq(userBrandProfiles.brand, brand))
    )
    .where(
      and(
        eq(users.id, userId),
        eq(users.role, 'dt'),
        eq(users.active_status, true),
        eq(userBrandProfiles.is_active, true),
        leadTypeInProfileEligibleTypes(leadType)
      )
    );
  return Boolean(row);
}

export type EligibleDtRow = {
  id: string;
  name: string;
  email: string;
};

export async function getEligibleDts(params: {
  brand: CrmBrand;
  leadType: LeadType;
  tx?: FeedbackDb;
}): Promise<EligibleDtRow[]> {
  const d = params.tx ?? db;
  return d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .innerJoin(
      userBrandProfiles,
      and(eq(userBrandProfiles.user_id, users.id), eq(userBrandProfiles.brand, params.brand))
    )
    .where(
      and(
        eq(users.role, 'dt'),
        eq(users.active_status, true),
        eq(userBrandProfiles.is_active, true),
        leadTypeInProfileEligibleTypes(params.leadType)
      )
    )
    .orderBy(users.id);
}

/** Brand-active agents regardless of lead type (for rebalance pool listing). */
export async function getBrandActiveDietitians(
  brand: CrmBrand,
  tx?: FeedbackDb
): Promise<EligibleDtRow[]> {
  const d = tx ?? db;
  return d
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .innerJoin(
      userBrandProfiles,
      and(eq(userBrandProfiles.user_id, users.id), eq(userBrandProfiles.brand, brand))
    )
    .where(and(eq(users.role, 'dt'), eq(users.active_status, true), eq(userBrandProfiles.is_active, true)))
    .orderBy(users.id);
}

export async function getEligibleDtIdSet(params: {
  brand: CrmBrand;
  leadType: LeadType;
  tx?: FeedbackDb;
}): Promise<Set<string>> {
  const rows = await getEligibleDts(params);
  return new Set(rows.map((r) => r.id));
}

export async function getEligibleDtIdsByLeadTypeMap(
  brand: CrmBrand,
  tx?: FeedbackDb
): Promise<Map<LeadType, Set<string>>> {
  const map = new Map<LeadType, Set<string>>();
  await Promise.all(
    ALL_LEAD_TYPES.map(async (leadType) => {
      map.set(leadType, await getEligibleDtIdSet({ brand, leadType, tx }));
    })
  );
  return map;
}

function pickEligibleTargetDt(
  preferredDtId: string | undefined,
  leadType: LeadType,
  activeDtIds: string[],
  eligibleDtIdsByLeadType: Map<LeadType, Set<string>>
): string | null {
  const eligibleForType = activeDtIds.filter((id) => eligibleDtIdsByLeadType.get(leadType)?.has(id));
  if (!eligibleForType.length) return null;
  if (preferredDtId && eligibleForType.includes(preferredDtId)) return preferredDtId;
  return [...eligibleForType].sort((a, b) => a.localeCompare(b))[0] ?? null;
}

export { pickEligibleTargetDt };
