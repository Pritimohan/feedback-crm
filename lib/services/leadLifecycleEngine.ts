import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db, type FeedbackDbTransaction } from '@/lib/db';
import {
  customers,
  leadLifecycleFollowupAttempts,
  leadLifecycleFollowups,
  leadLifecycles,
  leads,
} from '@/lib/db/schema';
import {
  canChooseInterested,
  computeConnectedTransition,
  computeNonConnectedTransition,
  getConnectedChoicesForStage,
  type ConnectedChoice,
  type ConnectedChoicePayload,
  type NonConnectedOutcome,
  validateConnectedChoicePayload,
} from '@/lib/lifecycle/leadLifecycleValidation';
import type { CrmBrand } from '@/lib/crmBrand.shared';
import { leadMatchesCrmBrand } from '@/lib/crmBrand';
import {
  computeScheduledDateForAttempt,
  getActiveLifecycleConfig,
  getStageConfig,
  resolveConfigForLeadLifecycle,
} from '@/lib/services/lifecycleConfigService';
import {
  scheduleInitialFollowup,
  scheduleInitialFollowupAfterDays,
  scheduleNextFollowupFromConnected,
} from '@/lib/lifecycle/leadLifecycleSchedule';
import { sanitizeFeedbackFormPayload } from '@/lib/feedback/feedbackFormSchema';
import { upsertCallLogForAttempt } from '@/lib/services/callLogService';
import { getCallObjective } from '@/lib/lifecycle/callObjectives';
import { getMaxFollowupNumber } from '@/lib/lifecycle/followupStageBounds';
import type { LeadType } from '@/lib/lifecycle/leadLifecycleValidation';
import {
  filterVisibleActiveFollowups,
  getTodayBoundsForFeedbackFollowups,
  splitFeedbackFollowupsByIstDay,
} from '@/lib/dt/activeFollowupsCallPriority';
import { ensureBusinessDayScheduledDate } from '@/lib/utils/schedulingDates';
import { getAnalyticsDayBoundsForInstant } from '@/lib/utils/analyticsDates';
import { logOutcomeSaveEvent, type OutcomeSaveEvent } from '@/lib/utils/outcomeSaveLog';
import type { LeadLifecycleFollowup } from '@/lib/db/schema/leadLifecycleFollowups';

function isFollowupOverdue(scheduledDate: Date, now: Date = new Date()): boolean {
  const { startDate: istDayStart } = getAnalyticsDayBoundsForInstant(now);
  return scheduledDate < istDayStart;
}

export function shouldAdvanceIssueWithProduct(params: {
  hasIssueAdvancedOnce: boolean;
  followupNumber: number;
  leadType?: LeadType;
}): boolean {
  const { hasIssueAdvancedOnce, followupNumber, leadType = 'review' } = params;
  return !hasIssueAdvancedOnce && followupNumber < getMaxFollowupNumber(leadType);
}

async function lockPendingFollowup(
  tx: FeedbackDbTransaction,
  followupId: string,
  logAction: OutcomeSaveEvent['action']
): Promise<LeadLifecycleFollowup> {
  const [locked] = await tx
    .select()
    .from(leadLifecycleFollowups)
    .where(eq(leadLifecycleFollowups.id, followupId))
    .for('update');

  if (!locked) {
    throw new Error('Followup not found');
  }
  if (locked.status !== 'pending') {
    logOutcomeSaveEvent({
      action: logAction,
      followupId,
      status: 'conflict',
      reason: 'not_pending',
      error: `Followup status is ${locked.status}`,
    });
    throw new Error('Followup is not pending');
  }

  return locked;
}

async function updatePendingFollowupOrThrow(
  tx: FeedbackDbTransaction,
  followupId: string,
  updates: Partial<typeof leadLifecycleFollowups.$inferInsert>,
  logAction: OutcomeSaveEvent['action']
): Promise<void> {
  const [updated] = await tx
    .update(leadLifecycleFollowups)
    .set(updates)
    .where(
      and(eq(leadLifecycleFollowups.id, followupId), eq(leadLifecycleFollowups.status, 'pending'))
    )
    .returning({ id: leadLifecycleFollowups.id });

  if (!updated) {
    logOutcomeSaveEvent({
      action: logAction,
      followupId,
      status: 'conflict',
      reason: 'conditional_update_missed',
      error: 'Followup is not pending',
    });
    throw new Error('Followup is not pending');
  }
}

export async function createLifecycleForLead(params: {
  leadId: string;
  anchorDate: Date;
  lifecycleType?: string;
  templateKey?: string;
  templateVersion?: number;
  tx?: FeedbackDbTransaction;
  scheduleFirstCallNextCalendarDay?: boolean;
  scheduleFirstCallAfterDays?: number;
}) {
  const {
    leadId,
    anchorDate,
    lifecycleType,
    templateKey,
    templateVersion,
    tx: outerTx,
    scheduleFirstCallNextCalendarDay,
    scheduleFirstCallAfterDays,
  } = params;
  const firstCallDelayDays =
    scheduleFirstCallAfterDays ?? (scheduleFirstCallNextCalendarDay ? 1 : undefined);
  const now = new Date();

  const insertLifecycle = async (d: FeedbackDbTransaction) => {
    const [leadRow] = await d
      .select({
        lead: leads,
        customer: customers,
      })
      .from(leads)
      .innerJoin(customers, eq(leads.customer_id, customers.id))
      .where(eq(leads.id, leadId));
    if (!leadRow) {
      throw new Error('Lead not found');
    }
    if (leadRow.lead.active_lifecycle_id) {
      return leadRow.lead.active_lifecycle_id;
    }

    const activeConfig = await getActiveLifecycleConfig();
    const configVersionId = activeConfig.id === 'defaults' ? null : activeConfig.id;
    const leadType = leadRow.lead.lead_type as LeadType;
    const stage0 = getStageConfig(activeConfig.config, leadType, 0);

    const [lifecycle] = await d
      .insert(leadLifecycles)
      .values({
        lead_id: leadId,
        lifecycle_type: lifecycleType ?? 'feedback_default',
        status: 'active',
        started_at: now,
        lifecycle_config_version_id: configVersionId,
        metadata: {
          template_key: templateKey ?? 'review_followup',
          template_version: templateVersion ?? activeConfig.version,
          anchor_at: anchorDate.toISOString(),
          anchor_reason:
            firstCallDelayDays === 1
              ? 'next_calendar_day'
              : firstCallDelayDays != null
                ? 'delay_days'
                : 'manual_start',
          schedule_first_call_next_calendar_day: firstCallDelayDays === 1,
          schedule_first_call_after_days: firstCallDelayDays ?? null,
        },
      })
      .returning();

    const firstScheduledDate =
      firstCallDelayDays != null
        ? scheduleInitialFollowupAfterDays(anchorDate, firstCallDelayDays, activeConfig.config)
        : scheduleInitialFollowup(anchorDate, activeConfig.config);

    await d.insert(leadLifecycleFollowups).values({
      lifecycle_id: lifecycle.id,
      followup_number: 0,
      assigned_dt_id: leadRow.lead.assigned_dt_id ?? null,
      scheduled_date: firstScheduledDate,
      status: 'pending',
      attempt_count: 0,
      max_attempts: stage0.maxAttempts,
      payload: {
        objective: getCallObjective(leadRow.lead.lead_type, 0, activeConfig.config),
      },
    });

    await d
      .update(leads)
      .set({
        active_lifecycle_id: lifecycle.id,
        current_followup_number: 0,
        current_touch_status: 'pending',
        activity_status: 'active',
        updated_at: now,
      })
      .where(eq(leads.id, leadId));

    return lifecycle.id;
  };

  if (outerTx) {
    return insertLifecycle(outerTx);
  }

  const [leadRow] = await db
    .select({
      lead: leads,
      customer: customers,
    })
    .from(leads)
    .innerJoin(customers, eq(leads.customer_id, customers.id))
    .where(eq(leads.id, leadId));
  if (!leadRow) {
    throw new Error('Lead not found');
  }
  if (leadRow.lead.active_lifecycle_id) {
    return leadRow.lead.active_lifecycle_id;
  }

  return db.transaction(async (tx) => insertLifecycle(tx));
}

export async function recordFollowupAttemptOutcome(params: {
  followupId: string;
  dtId: string;
  outcome: NonConnectedOutcome;
  notes?: string;
  preferredScheduledDate?: Date;
}) {
  const { followupId, dtId, outcome, notes, preferredScheduledDate } = params;
  const now = new Date();

  const [row] = await db
    .select({
      followup: leadLifecycleFollowups,
      lifecycle: leadLifecycles,
      lead: leads,
      customer: customers,
    })
    .from(leadLifecycleFollowups)
    .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .innerJoin(customers, eq(leads.customer_id, customers.id))
    .where(eq(leadLifecycleFollowups.id, followupId));

  if (!row) throw new Error('Followup not found');

  return db.transaction(async (tx) => {
    const lockedFollowup = await lockPendingFollowup(tx, followupId, 'followup_outcome');
    const isOverdue = isFollowupOverdue(lockedFollowup.scheduled_date, now);

    const [attempt] = await tx
      .insert(leadLifecycleFollowupAttempts)
      .values({
      followup_id: followupId,
      dt_id: dtId,
      attempt_date: now,
      outcome,
      notes,
      was_overdue: isOverdue,
      })
      .returning();

    await upsertCallLogForAttempt(tx, {
      customer_id: row.customer.id,
      lead_id: row.lead.id,
      lifecycle_id: row.lifecycle.id,
      followup_id: row.followup.id,
      attempt_id: attempt.id,
      dt_id: dtId,
      provider: 'exotel',
      customer_number: row.customer.phone,
      attempt_outcome: outcome,
      attempt_notes: notes,
      scheduled_date_at_attempt: lockedFollowup.scheduled_date,
      was_overdue: isOverdue,
      lead_type: row.lead.lead_type,
      followup_number: lockedFollowup.followup_number,
      ingest_source: 'attempt_api',
      ingest_status: 'partial',
      raw_payload: null,
      updated_at: now,
    });

    const attemptCountAfter = lockedFollowup.attempt_count + 1;
    const transition = computeNonConnectedTransition({
      outcome,
      attemptCountAfter,
      maxAttempts: lockedFollowup.max_attempts,
    });

    const followupUpdates: Partial<typeof leadLifecycleFollowups.$inferInsert> = {
      attempt_count: attemptCountAfter,
      status: transition.nextTouchStatus,
      first_attempt_date: lockedFollowup.first_attempt_date ?? now,
      remarks: notes ?? lockedFollowup.remarks,
      updated_at: now,
    };

    if (!transition.terminal && (outcome === 'busy' || outcome === 'no_answer')) {
      if (outcome === 'busy' && preferredScheduledDate) {
        followupUpdates.scheduled_date = ensureBusinessDayScheduledDate(preferredScheduledDate);
      } else {
        const resolved = await resolveConfigForLeadLifecycle(row.lifecycle.id);
        const stage = getStageConfig(
          resolved.config.config,
          resolved.leadType,
          lockedFollowup.followup_number
        );
        const nextScheduled = computeScheduledDateForAttempt({
          stage,
          global: resolved.config.config.global,
          nextAttemptCount: attemptCountAfter + 1,
          anchorDate: lockedFollowup.scheduled_date,
          lastAttemptDate: now,
        });
        followupUpdates.scheduled_date = nextScheduled;
      }
      followupUpdates.status = 'pending';
    }

    await updatePendingFollowupOrThrow(tx, followupId, followupUpdates, 'followup_outcome');

    const lifecycleUpdates: Partial<typeof leadLifecycles.$inferInsert> = {
      updated_at: now,
    };
    const leadUpdates: Partial<typeof leads.$inferInsert> = {
      activity_status: transition.nextActivityStatus,
      current_followup_number: lockedFollowup.followup_number,
      current_touch_status: transition.nextTouchStatus,
      updated_at: now,
    };

    if (transition.terminal) {
      lifecycleUpdates.status = transition.nextActivityStatus === 'deferred' ? 'deferred' : 'completed';
      lifecycleUpdates.completed_at = now;
      leadUpdates.active_lifecycle_id = null;
    }

    await tx.update(leadLifecycles).set(lifecycleUpdates).where(eq(leadLifecycles.id, row.lifecycle.id));
    await tx.update(leads).set(leadUpdates).where(eq(leads.id, row.lead.id));
    if (transition.nextActivityStatus === 'deferred') {
      await tx
        .update(customers)
        .set({
          flag_type: 'deferred',
          updated_at: now,
        })
        .where(eq(customers.id, row.customer.id));
    }

    return {
      success: true,
      terminal: transition.terminal,
      followupStatus: followupUpdates.status,
      nextScheduledDate: followupUpdates.scheduled_date ?? null,
    };
  });
}

export async function recordConnectedOutcome(params: {
  followupId: string;
  dtId: string;
  choice: ConnectedChoice;
  payload: ConnectedChoicePayload;
  notes?: string;
}) {
  const { followupId, dtId, choice, payload, notes } = params;
  const now = new Date();

  const [row] = await db
    .select({
      followup: leadLifecycleFollowups,
      lifecycle: leadLifecycles,
      lead: leads,
      customer: customers,
    })
    .from(leadLifecycleFollowups)
    .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .innerJoin(customers, eq(leads.customer_id, customers.id))
    .where(eq(leadLifecycleFollowups.id, followupId));

  if (!row) throw new Error('Followup not found');

  const leadType = row.lead.lead_type;
  const resolved = await resolveConfigForLeadLifecycle(row.lifecycle.id);
  const configBundle = resolved.config.config;
  const maxFollowupNumber = getMaxFollowupNumber(leadType, configBundle);

  const allowedChoices = getConnectedChoicesForStage(row.followup.followup_number, leadType);
  if (!allowedChoices.includes(choice)) {
    throw new Error('Connected choice is not allowed for this followup stage');
  }

  const validation = validateConnectedChoicePayload({
    choice,
    followupNumber: row.followup.followup_number,
    leadType,
    payload,
  });
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  if (choice === 'interested' && !canChooseInterested(row.followup.followup_number, leadType)) {
    throw new Error('Interested is not allowed for this stage');
  }

  return db.transaction(async (tx) => {
    const lockedFollowup = await lockPendingFollowup(tx, followupId, 'connected_outcome');

    const hasIssueAdvancedOnce =
      choice === 'issue_with_product'
        ? (
            await tx
              .select({ id: leadLifecycleFollowups.id })
              .from(leadLifecycleFollowups)
              .where(
                and(
                  eq(leadLifecycleFollowups.lifecycle_id, row.lifecycle.id),
                  sql<boolean>`${leadLifecycleFollowups.payload} ->> 'issue_advanced_once' = 'true'`
                )
              )
              .limit(1)
          ).length > 0
        : false;

    const [attempt] = await tx
      .insert(leadLifecycleFollowupAttempts)
      .values({
      followup_id: followupId,
      dt_id: dtId,
      attempt_date: now,
      outcome: 'connected',
      notes,
      was_overdue: isFollowupOverdue(lockedFollowup.scheduled_date, now),
      })
      .returning();

    await upsertCallLogForAttempt(tx, {
      customer_id: row.customer.id,
      lead_id: row.lead.id,
      lifecycle_id: row.lifecycle.id,
      followup_id: lockedFollowup.id,
      attempt_id: attempt.id,
      dt_id: dtId,
      provider: 'exotel',
      customer_number: row.customer.phone,
      attempt_outcome: 'connected',
      attempt_notes: notes,
      scheduled_date_at_attempt: lockedFollowup.scheduled_date,
      was_overdue: isFollowupOverdue(lockedFollowup.scheduled_date, now),
      lead_type: row.lead.lead_type,
      followup_number: lockedFollowup.followup_number,
      ingest_source: 'attempt_api',
      ingest_status: 'partial',
      raw_payload: null,
      updated_at: now,
    });

    const feedbackForm =
      payload.feedback_form !== undefined ? sanitizeFeedbackFormPayload(payload.feedback_form) : null;
    const isTestimonial =
      payload.is_testimonial === true || feedbackForm?.testimonial_comfortable === 'Yes';

    const connectedPayload = {
      ...(lockedFollowup.payload ?? {}),
      connected_choice: choice,
      review_screenshot_url: payload.review_screenshot_url ?? null,
      review_remark: payload.review_remark ?? null,
      is_testimonial: isTestimonial,
      issue_description: payload.issue_description ?? null,
      interested_remark: payload.interested_remark ?? null,
      didnt_reviewed_remark: payload.didnt_reviewed_remark ?? null,
      feedback_form: feedbackForm,
      escalated: choice === 'issue_with_product',
      issue_advanced_once: choice === 'issue_with_product' ? !hasIssueAdvancedOnce : null,
      objective: getCallObjective(row.lead.lead_type, lockedFollowup.followup_number, configBundle),
    };

    await updatePendingFollowupOrThrow(
      tx,
      followupId,
      {
        status: 'connected',
        connected_date: now,
        payload: connectedPayload,
        attempt_count: lockedFollowup.attempt_count + 1,
        first_attempt_date: lockedFollowup.first_attempt_date ?? now,
        remarks: notes ?? lockedFollowup.remarks,
        updated_at: now,
      },
      'connected_outcome'
    );

    const baseTransition = computeConnectedTransition(choice, leadType);
    const transition =
      choice === 'issue_with_product' &&
      shouldAdvanceIssueWithProduct({
        hasIssueAdvancedOnce,
        followupNumber: lockedFollowup.followup_number,
        leadType,
      })
        ? { nextActivityStatus: 'active' as const, advanceStage: true }
        : baseTransition;
    const nextFollowupNumber = transition.advanceStage
      ? Math.min(lockedFollowup.followup_number + 1, maxFollowupNumber)
      : lockedFollowup.followup_number;

    let nextFollowupId: string | null = null;
    if (transition.advanceStage && lockedFollowup.followup_number < maxFollowupNumber) {
      const insertedFollowupNumber = lockedFollowup.followup_number + 1;
      const nextStage = getStageConfig(configBundle, leadType, insertedFollowupNumber);
      const [nextFollowup] = await tx
        .insert(leadLifecycleFollowups)
        .values({
          lifecycle_id: row.lifecycle.id,
          followup_number: insertedFollowupNumber,
          assigned_dt_id: row.lead.assigned_dt_id ?? dtId,
          scheduled_date: scheduleNextFollowupFromConnected({
            referenceDate: now,
            brand: row.lead.brand,
            currentFollowupNumber: lockedFollowup.followup_number,
            bundle: configBundle,
            stageDaysAfterPriorConnection: nextStage.daysAfterPriorConnection,
          }),
          status: 'pending',
          attempt_count: 0,
          max_attempts: nextStage.maxAttempts,
          payload: {
            objective: getCallObjective(row.lead.lead_type, insertedFollowupNumber, configBundle),
          },
          updated_at: now,
        })
        .returning({ id: leadLifecycleFollowups.id });
      nextFollowupId = nextFollowup.id;
    }

    const lifecycleIsCompleted =
      !transition.advanceStage || lockedFollowup.followup_number >= maxFollowupNumber;
    await tx
      .update(leadLifecycles)
      .set({
        status: lifecycleIsCompleted ? 'completed' : 'active',
        completed_at: lifecycleIsCompleted ? now : null,
        updated_at: now,
      })
      .where(eq(leadLifecycles.id, row.lifecycle.id));

    await tx
      .update(leads)
      .set({
        activity_status: transition.nextActivityStatus,
        current_followup_number: nextFollowupNumber,
        current_touch_status: 'connected',
        last_connected_choice: choice,
        is_testimonial: isTestimonial ? true : row.lead.is_testimonial,
        active_lifecycle_id: lifecycleIsCompleted ? null : row.lifecycle.id,
        updated_at: now,
      })
      .where(eq(leads.id, row.lead.id));
    if (isTestimonial) {
      await tx
        .update(customers)
        .set({
          flag_type: 'testimonial',
          updated_at: now,
        })
        .where(eq(customers.id, row.customer.id));
    }

    return {
      success: true,
      completed: lifecycleIsCompleted,
      nextFollowupId,
      nextFollowupNumber,
    };
  });
}

/** Pending follow-ups for a DT through end of today (IST): today's due + overdue. Matches admin call-distribution totals. */
export async function getActiveFollowupsForDt(dtId: string, date: Date = new Date(), brand: CrmBrand = 'fitty') {
  const now = date;
  const dayBounds = getTodayBoundsForFeedbackFollowups(now);
  const { dayEnd } = dayBounds;

  const rows = await db
    .select({
      followup: leadLifecycleFollowups,
      lifecycle: leadLifecycles,
      lead: leads,
      customer: customers,
    })
    .from(leadLifecycleFollowups)
    .innerJoin(leadLifecycles, eq(leadLifecycleFollowups.lifecycle_id, leadLifecycles.id))
    .innerJoin(leads, eq(leadLifecycles.lead_id, leads.id))
    .innerJoin(customers, eq(leads.customer_id, customers.id))
    .where(
      and(
        eq(leadLifecycleFollowups.assigned_dt_id, dtId),
        eq(leadLifecycles.status, 'active'),
        eq(leadLifecycleFollowups.status, 'pending'),
        lte(leadLifecycleFollowups.scheduled_date, dayEnd),
        leadMatchesCrmBrand(brand)
      )
    );

  const followupIds = rows.map((r) => r.followup.id);
  const attemptRows =
    followupIds.length > 0
      ? await db
          .select({
            followupId: leadLifecycleFollowupAttempts.followup_id,
            outcome: leadLifecycleFollowupAttempts.outcome,
          })
          .from(leadLifecycleFollowupAttempts)
          .where(inArray(leadLifecycleFollowupAttempts.followup_id, followupIds))
          .orderBy(desc(leadLifecycleFollowupAttempts.attempt_date))
      : [];

  const lastAttemptOutcomeByFollowup = new Map<string, string>();
  for (const attempt of attemptRows) {
    if (!lastAttemptOutcomeByFollowup.has(attempt.followupId)) {
      lastAttemptOutcomeByFollowup.set(attempt.followupId, attempt.outcome);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    objective: getCallObjective(r.lead.lead_type, r.followup.followup_number),
    available_connected_choices: getConnectedChoicesForStage(r.followup.followup_number, r.lead.lead_type),
    last_attempt_outcome: lastAttemptOutcomeByFollowup.get(r.followup.id) ?? null,
  }));

  const visible = filterVisibleActiveFollowups(enriched, now, dayBounds);
  const { todayDue, overdue } = splitFeedbackFollowupsByIstDay(visible, now);

  return {
    overdue,
    todayDue,
    total: visible.length,
  };
}
