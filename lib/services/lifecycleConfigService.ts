import { db } from '@/lib/db';
import {
  leadLifecycleFollowups,
  leadLifecycles,
  leads,
  lifecycleConfigSettings,
} from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  getConnectedAdvanceDays,
  getDefaultLifecycleConfig,
  getTypeConfigFromBundle,
  type LeadTypeId,
  type LifecycleConfigBundle,
  type LifecycleGlobalSettings,
  type LifecycleStageConfig,
  type LifecycleTypeConfig,
} from '@/lib/lifecycleDefaults';
import {
  getStageFromTypeConfig,
  parseLifecycleConfigBundle,
} from '@/lib/schemas/lifecycleConfigSchema';

export type ActiveLifecycleConfig = {
  id: string;
  version: number;
  config: LifecycleConfigBundle;
  updatedAt: Date;
};

export type PendingUpdatesSummary = {
  followupsUpdated: number;
  activeLifecyclesVersionUpdated: number;
};

type DbExecutor = Pick<typeof db, 'select' | 'update' | 'insert' | 'delete'>;

function toMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function setRetryHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Retry gap in days between attempt index i-1 and i (1-based attempt numbers). */
export function getRetryGapDays(stage: LifecycleStageConfig, attemptIndex: number): number {
  if (attemptIndex <= 1) return 0;
  const prev = stage.attemptScheduleDaysFromAnchor[attemptIndex - 2] ?? 0;
  const curr = stage.attemptScheduleDaysFromAnchor[attemptIndex - 1] ?? prev;
  return Math.max(1, curr - prev);
}

export function computeInitialFollowupSchedule(params: {
  anchorDate: Date;
  global: LifecycleGlobalSettings;
  scheduleNextCalendarDay?: boolean;
  firstCallDelayDays?: number;
}): Date {
  const { anchorDate, global, scheduleNextCalendarDay, firstCallDelayDays } = params;
  const delayDays = firstCallDelayDays ?? (scheduleNextCalendarDay ? 1 : undefined);

  if (delayDays != null) {
    const scheduled = new Date(anchorDate);
    scheduled.setDate(scheduled.getDate() + delayDays);
    scheduled.setHours(global.nextDayRetryHour, 0, 0, 0);
    return scheduled;
  }

  const scheduled = new Date(anchorDate);
  scheduled.setDate(scheduled.getDate() + global.firstFollowupOffsetDays);
  if (scheduled.getHours() >= global.initialFollowupCutoffHour) {
    scheduled.setDate(scheduled.getDate() + 1);
    scheduled.setHours(global.nextDayRetryHour, 0, 0, 0);
  }
  return scheduled;
}

export function computeConnectedAdvanceSchedule(params: {
  referenceDate: Date;
  global: LifecycleGlobalSettings;
  brand?: string | null;
  stageDaysAfterPriorConnection?: number;
}): Date {
  const { referenceDate, global, brand, stageDaysAfterPriorConnection } = params;
  const brandAdvance = getConnectedAdvanceDays(global, brand);
  const advanceDays =
    brand === 'fitty' || brand === 'fitelo'
      ? brandAdvance
      : (stageDaysAfterPriorConnection ?? global.brandConnectedAdvanceDays.default);
  const scheduled = new Date(referenceDate);
  scheduled.setDate(scheduled.getDate() + advanceDays);
  return scheduled;
}

/**
 * Compute scheduled date for a follow-up attempt.
 * @param nextAttemptCount 1-based count for the next dial (or 1 for initial schedule)
 */
export function computeScheduledDateForAttempt(params: {
  stage: LifecycleStageConfig;
  global: LifecycleGlobalSettings;
  nextAttemptCount: number;
  anchorDate: Date;
  lastAttemptDate?: Date;
  scheduleNextCalendarDay?: boolean;
  firstCallDelayDays?: number;
}): Date {
  const {
    stage,
    global,
    nextAttemptCount,
    anchorDate,
    lastAttemptDate,
    scheduleNextCalendarDay,
    firstCallDelayDays,
  } = params;

  if (nextAttemptCount <= 1) {
    if (stage.followupNumber > 0 && stage.daysAfterPriorConnection != null) {
      const scheduled = new Date(anchorDate);
      scheduled.setDate(scheduled.getDate() + stage.daysAfterPriorConnection);
      return setRetryHour(scheduled, global.nextDayRetryHour);
    }

    if (stage.followupNumber === 0) {
      return computeInitialFollowupSchedule({
        anchorDate,
        global,
        scheduleNextCalendarDay,
        firstCallDelayDays,
      });
    }

    const scheduled = new Date(anchorDate);
    scheduled.setDate(scheduled.getDate() + stage.initialScheduleDays);
    return setRetryHour(scheduled, global.nextDayRetryHour);
  }

  const gap = getRetryGapDays(stage, nextAttemptCount);
  const base = lastAttemptDate ?? anchorDate;
  const scheduled = new Date(base);
  scheduled.setDate(scheduled.getDate() + gap);
  return setRetryHour(scheduled, global.nextDayRetryHour);
}

export function getDefaultLifecycleConfigBundle(): LifecycleConfigBundle {
  return getDefaultLifecycleConfig();
}

export async function getActiveLifecycleConfigRecord(): Promise<ActiveLifecycleConfig | null> {
  const [row] = await db
    .select()
    .from(lifecycleConfigSettings)
    .where(eq(lifecycleConfigSettings.is_active, true))
    .orderBy(desc(lifecycleConfigSettings.version))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    version: row.version,
    config: parseLifecycleConfigBundle(row.config),
    updatedAt: row.updated_at,
  };
}

export async function getActiveLifecycleConfig(): Promise<ActiveLifecycleConfig> {
  const active = await getActiveLifecycleConfigRecord();
  if (active) return active;

  return {
    id: 'defaults',
    version: 0,
    config: getDefaultLifecycleConfig(),
    updatedAt: new Date(0),
  };
}

export async function getLifecycleConfigByVersionId(
  versionId: string | null | undefined
): Promise<ActiveLifecycleConfig> {
  if (!versionId || versionId === 'defaults') {
    return getActiveLifecycleConfig();
  }

  const [row] = await db
    .select()
    .from(lifecycleConfigSettings)
    .where(eq(lifecycleConfigSettings.id, versionId))
    .limit(1);

  if (!row) return getActiveLifecycleConfig();

  return {
    id: row.id,
    version: row.version,
    config: parseLifecycleConfigBundle(row.config),
    updatedAt: row.updated_at,
  };
}

export function getStageConfig(
  bundle: LifecycleConfigBundle,
  leadType: LeadTypeId,
  followupNumber: number
): LifecycleStageConfig {
  const typeConfig = getTypeConfigFromBundle(bundle, leadType);
  const stage = getStageFromTypeConfig(typeConfig, followupNumber);
  if (!stage) {
    throw new Error(`No stage config for ${leadType} followup ${followupNumber}`);
  }
  return stage;
}

export function getMaxFollowupNumberFromConfig(
  bundle: LifecycleConfigBundle,
  leadType: LeadTypeId
): number {
  return getTypeConfigFromBundle(bundle, leadType).lastFollowupNumber;
}

export async function resolveConfigForLeadLifecycle(lifecycleId: string): Promise<{
  config: ActiveLifecycleConfig;
  typeConfig: LifecycleTypeConfig;
  leadType: LeadTypeId;
}> {
  const [row] = await db
    .select({
      versionId: leadLifecycles.lifecycle_config_version_id,
      leadType: leads.lead_type,
    })
    .from(leadLifecycles)
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .where(eq(leadLifecycles.id, lifecycleId))
    .limit(1);

  if (!row) {
    throw new Error('Lifecycle not found');
  }

  const leadType = row.leadType as LeadTypeId;
  const config = await getLifecycleConfigByVersionId(row.versionId);

  return {
    config,
    typeConfig: getTypeConfigFromBundle(config.config, leadType),
    leadType,
  };
}

function getLifecycleAnchorDate(
  lifecycle: typeof leadLifecycles.$inferSelect,
  metadata?: Record<string, unknown> | null
): Date {
  const anchorAt = metadata?.anchor_at;
  if (typeof anchorAt === 'string') {
    return new Date(anchorAt);
  }
  return new Date(lifecycle.started_at);
}

async function recalcPendingFollowupSchedule(params: {
  followup: typeof leadLifecycleFollowups.$inferSelect;
  leadType: LeadTypeId;
  config: LifecycleConfigBundle;
  lifecycle: typeof leadLifecycles.$inferSelect;
  priorConnectionByKey: Map<string, Date>;
}): Promise<Date | null> {
  const { followup, leadType, config, lifecycle, priorConnectionByKey } = params;
  if (followup.attempt_count !== 0) return null;

  const stage = getStageConfig(config, leadType, followup.followup_number);
  const startOfToday = toMidnight(new Date());
  const metadata = lifecycle.metadata as Record<string, unknown> | null;

  if (stage.followupNumber === 0) {
    const anchorDate = getLifecycleAnchorDate(lifecycle, metadata);
    const scheduled = computeScheduledDateForAttempt({
      stage,
      global: config.global,
      nextAttemptCount: 1,
      anchorDate,
      scheduleNextCalendarDay:
        metadata?.schedule_first_call_next_calendar_day === true ||
        metadata?.anchor_reason === 'next_calendar_day',
      firstCallDelayDays:
        typeof metadata?.schedule_first_call_after_days === 'number'
          ? metadata.schedule_first_call_after_days
          : undefined,
    });
    return maxDate(scheduled, startOfToday);
  }

  const priorKey = `${followup.lifecycle_id}:${stage.followupNumber - 1}`;
  const priorConnectedDate = priorConnectionByKey.get(priorKey);
  if (!priorConnectedDate) return null;

  const scheduled = computeScheduledDateForAttempt({
    stage,
    global: config.global,
    nextAttemptCount: 1,
    anchorDate: new Date(priorConnectedDate),
  });
  return maxDate(scheduled, startOfToday);
}

export async function applyConfigToPendingFollowups(
  newConfig: LifecycleConfigBundle,
  newVersionId: string,
  executor: DbExecutor
): Promise<PendingUpdatesSummary> {
  const summary: PendingUpdatesSummary = {
    followupsUpdated: 0,
    activeLifecyclesVersionUpdated: 0,
  };

  const activeLifecycles = await executor
    .select({
      lifecycle: leadLifecycles,
      leadType: leads.lead_type,
    })
    .from(leadLifecycles)
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .where(eq(leadLifecycles.status, 'active'));

  if (activeLifecycles.length === 0) {
    return summary;
  }

  const lifecycleIds = activeLifecycles.map((r) => r.lifecycle.id);

  await executor
    .update(leadLifecycles)
    .set({ lifecycle_config_version_id: newVersionId, updated_at: new Date() })
    .where(inArray(leadLifecycles.id, lifecycleIds));
  summary.activeLifecyclesVersionUpdated = lifecycleIds.length;

  const pendingFollowups = await executor
    .select()
    .from(leadLifecycleFollowups)
    .where(
      and(
        inArray(leadLifecycleFollowups.lifecycle_id, lifecycleIds),
        eq(leadLifecycleFollowups.status, 'pending')
      )
    );

  const priorConnectionRows = await executor
    .select({
      lifecycleId: leadLifecycleFollowups.lifecycle_id,
      followupNumber: leadLifecycleFollowups.followup_number,
      connectedDate: leadLifecycleFollowups.connected_date,
    })
    .from(leadLifecycleFollowups)
    .where(
      and(
        inArray(leadLifecycleFollowups.lifecycle_id, lifecycleIds),
        eq(leadLifecycleFollowups.status, 'connected')
      )
    );

  const priorConnectionByKey = new Map<string, Date>();
  for (const row of priorConnectionRows) {
    if (row.connectedDate) {
      priorConnectionByKey.set(
        `${row.lifecycleId}:${row.followupNumber}`,
        new Date(row.connectedDate)
      );
    }
  }

  const lifecycleById = new Map(activeLifecycles.map((r) => [r.lifecycle.id, r]));

  for (const followup of pendingFollowups) {
    const row = lifecycleById.get(followup.lifecycle_id);
    if (!row) continue;

    const leadType = row.leadType as LeadTypeId;
    const stage = getStageConfig(newConfig, leadType, followup.followup_number);
    const effectiveMax = Math.max(stage.maxAttempts, followup.attempt_count);

    const newScheduled = await recalcPendingFollowupSchedule({
      followup,
      leadType,
      config: newConfig,
      lifecycle: row.lifecycle,
      priorConnectionByKey,
    });

    const updates: Partial<typeof leadLifecycleFollowups.$inferInsert> = {
      max_attempts: effectiveMax,
      updated_at: new Date(),
    };
    if (newScheduled) {
      updates.scheduled_date = newScheduled;
    }

    await executor
      .update(leadLifecycleFollowups)
      .set(updates)
      .where(eq(leadLifecycleFollowups.id, followup.id));

    summary.followupsUpdated++;
  }

  return summary;
}

export async function saveLifecycleConfig(
  input: unknown,
  adminUserId: string
): Promise<{ version: number; versionId: string; pendingUpdatesSummary: PendingUpdatesSummary }> {
  const config = parseLifecycleConfigBundle(input);

  const saved = await db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: lifecycleConfigSettings.version })
      .from(lifecycleConfigSettings)
      .orderBy(desc(lifecycleConfigSettings.version))
      .limit(1);

    const nextVersion = (latest?.version ?? 0) + 1;

    await tx
      .update(lifecycleConfigSettings)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(lifecycleConfigSettings.is_active, true));

    const [inserted] = await tx
      .insert(lifecycleConfigSettings)
      .values({
        version: nextVersion,
        config,
        is_active: true,
        created_by: adminUserId,
        updated_at: new Date(),
      })
      .returning({ id: lifecycleConfigSettings.id });

    if (!inserted) {
      throw new Error('Failed to save lifecycle config');
    }

    return {
      version: nextVersion,
      versionId: inserted.id,
    };
  });

  const pendingUpdatesSummary = await db.transaction(async (tx) =>
    applyConfigToPendingFollowups(config, saved.versionId, tx)
  );

  return {
    ...saved,
    pendingUpdatesSummary,
  };
}

export async function resetLifecycleConfigToDefaults(adminUserId: string) {
  return saveLifecycleConfig(getDefaultLifecycleConfig(), adminUserId);
}
