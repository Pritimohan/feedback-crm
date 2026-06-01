import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db, type FeedbackDbTransaction } from '@/lib/db';
import {
  callLogs,
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
  computeRetrySchedule,
  DEFAULT_LEAD_LIFECYCLE_TEMPLATE,
  scheduleInitialFollowup,
  scheduleInitialFollowupNextCalendarDay,
  scheduleNextFollowupFromConnected,
} from '@/lib/lifecycle/leadLifecycleSchedule';
import { mergeFollowupPayloadForFiveHourRetry } from '@/lib/lifecycle/fiveHourRetryFollowup';
import { getCallObjective } from '@/lib/lifecycle/callObjectives';
import { MAX_ATTEMPTS_PER_DAY } from '@/lib/utils/lifecycleConstants';
import { MAX_FOLLOWUP_NUMBER } from '@/lib/lifecycle/followupStageBounds';
import {
  filterVisibleActiveFollowups,
  getTodayBoundsForFeedbackFollowups,
  splitFeedbackFollowupsByIstDay,
} from '@/lib/dt/activeFollowupsCallPriority';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function shouldAdvanceIssueWithProduct(params: {
  hasIssueAdvancedOnce: boolean;
  followupNumber: number;
}): boolean {
  const { hasIssueAdvancedOnce, followupNumber } = params;
  return !hasIssueAdvancedOnce && followupNumber < MAX_FOLLOWUP_NUMBER;
}

export async function createLifecycleForLead(params: {
  leadId: string;
  anchorDate: Date;
  lifecycleType?: string;
  templateKey?: string;
  templateVersion?: number;
  tx?: FeedbackDbTransaction;
  scheduleFirstCallNextCalendarDay?: boolean;
}) {
  const {
    leadId,
    anchorDate,
    lifecycleType,
    templateKey,
    templateVersion,
    tx: outerTx,
    scheduleFirstCallNextCalendarDay,
  } = params;
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

    const [lifecycle] = await d
      .insert(leadLifecycles)
      .values({
        lead_id: leadId,
        lifecycle_type: lifecycleType ?? 'feedback_default',
        status: 'active',
        started_at: now,
        metadata: {
          template_key: templateKey ?? DEFAULT_LEAD_LIFECYCLE_TEMPLATE.key,
          template_version: templateVersion ?? DEFAULT_LEAD_LIFECYCLE_TEMPLATE.version,
          anchor_at: anchorDate.toISOString(),
          anchor_reason: 'manual_start',
        },
      })
      .returning();

    const firstScheduledDate = scheduleFirstCallNextCalendarDay
      ? scheduleInitialFollowupNextCalendarDay(anchorDate)
      : scheduleInitialFollowup(anchorDate);
    const maxAttempts = DEFAULT_LEAD_LIFECYCLE_TEMPLATE.maxAttemptsByLeadType[leadRow.lead.lead_type];

    await d.insert(leadLifecycleFollowups).values({
      lifecycle_id: lifecycle.id,
      followup_number: 0,
      assigned_dt_id: leadRow.lead.assigned_dt_id ?? null,
      scheduled_date: firstScheduledDate,
      status: 'pending',
      attempt_count: 0,
      max_attempts: maxAttempts,
      payload: {
        objective: getCallObjective(leadRow.lead.lead_type, 0),
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
}) {
  const { followupId, dtId, outcome, notes } = params;
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

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
  if (row.followup.status !== 'pending') throw new Error('Followup is not pending');

  return db.transaction(async (tx) => {
    const isOverdue = row.followup.scheduled_date < dayStart;

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

    await tx.insert(callLogs).values({
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
      scheduled_date_at_attempt: row.followup.scheduled_date,
      was_overdue: isOverdue,
      lead_type: row.lead.lead_type,
      followup_number: row.followup.followup_number,
      ingest_source: 'attempt_api',
      ingest_status: 'partial',
      raw_payload: null,
      updated_at: now,
    });

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(leadLifecycleFollowupAttempts)
      .where(
        and(
          eq(leadLifecycleFollowupAttempts.followup_id, followupId),
          gte(leadLifecycleFollowupAttempts.attempt_date, dayStart),
          lte(leadLifecycleFollowupAttempts.attempt_date, dayEnd)
        )
      );

    const attemptCountAfter = row.followup.attempt_count + 1;
    const transition = computeNonConnectedTransition({
      outcome,
      attemptCountAfter,
      maxAttempts: row.followup.max_attempts,
    });

    const followupUpdates: Partial<typeof leadLifecycleFollowups.$inferInsert> = {
      attempt_count: attemptCountAfter,
      status: transition.nextTouchStatus,
      first_attempt_date: row.followup.first_attempt_date ?? now,
      remarks: notes ?? row.followup.remarks,
      updated_at: now,
    };

    if (!transition.terminal && (outcome === 'busy' || outcome === 'no_answer')) {
      const attemptsToday = Number(count);
      const nextScheduled = computeRetrySchedule({
        now,
        attemptsToday,
        brand: row.lead.brand,
      });
      followupUpdates.scheduled_date = nextScheduled;
      followupUpdates.status = 'pending';
      if (attemptsToday < MAX_ATTEMPTS_PER_DAY) {
        followupUpdates.payload = mergeFollowupPayloadForFiveHourRetry(
          row.followup.payload,
          nextScheduled
        );
      }
    }

    await tx.update(leadLifecycleFollowups).set(followupUpdates).where(eq(leadLifecycleFollowups.id, followupId));

    const lifecycleUpdates: Partial<typeof leadLifecycles.$inferInsert> = {
      updated_at: now,
    };
    const leadUpdates: Partial<typeof leads.$inferInsert> = {
      activity_status: transition.nextActivityStatus,
      current_followup_number: row.followup.followup_number,
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
  if (row.followup.status !== 'pending') throw new Error('Followup is not pending');

  const allowedChoices = getConnectedChoicesForStage(row.followup.followup_number);
  if (!allowedChoices.includes(choice)) {
    throw new Error('Connected choice is not allowed for this followup stage');
  }

  const validation = validateConnectedChoicePayload({
    choice,
    followupNumber: row.followup.followup_number,
    payload,
  });
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  if (choice === 'interested' && !canChooseInterested(row.followup.followup_number)) {
    throw new Error('Interested is not allowed for this stage');
  }

  return db.transaction(async (tx) => {
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
      was_overdue: row.followup.scheduled_date < startOfDay(now),
      })
      .returning();

    await tx.insert(callLogs).values({
      customer_id: row.customer.id,
      lead_id: row.lead.id,
      lifecycle_id: row.lifecycle.id,
      followup_id: row.followup.id,
      attempt_id: attempt.id,
      dt_id: dtId,
      provider: 'exotel',
      customer_number: row.customer.phone,
      attempt_outcome: 'connected',
      attempt_notes: notes,
      scheduled_date_at_attempt: row.followup.scheduled_date,
      was_overdue: row.followup.scheduled_date < startOfDay(now),
      lead_type: row.lead.lead_type,
      followup_number: row.followup.followup_number,
      ingest_source: 'attempt_api',
      ingest_status: 'partial',
      raw_payload: null,
      updated_at: now,
    });

    const connectedPayload = {
      ...(row.followup.payload ?? {}),
      connected_choice: choice,
      review_screenshot_url: payload.review_screenshot_url ?? null,
      review_remark: payload.review_remark ?? null,
      is_testimonial: payload.is_testimonial ?? false,
      issue_description: payload.issue_description ?? null,
      interested_remark: payload.interested_remark ?? null,
      didnt_reviewed_remark: payload.didnt_reviewed_remark ?? null,
      escalated: choice === 'issue_with_product',
      issue_advanced_once: choice === 'issue_with_product' ? !hasIssueAdvancedOnce : null,
      objective: getCallObjective(row.lead.lead_type, row.followup.followup_number),
    };

    await tx
      .update(leadLifecycleFollowups)
      .set({
        status: 'connected',
        connected_date: now,
        payload: connectedPayload,
        attempt_count: row.followup.attempt_count + 1,
        first_attempt_date: row.followup.first_attempt_date ?? now,
        remarks: notes ?? row.followup.remarks,
        updated_at: now,
      })
      .where(eq(leadLifecycleFollowups.id, followupId));

    const baseTransition = computeConnectedTransition(choice);
    const transition =
      choice === 'issue_with_product' &&
      shouldAdvanceIssueWithProduct({
        hasIssueAdvancedOnce,
        followupNumber: row.followup.followup_number,
      })
        ? { nextActivityStatus: 'active' as const, advanceStage: true }
        : baseTransition;
    const nextFollowupNumber = transition.advanceStage
      ? Math.min(row.followup.followup_number + 1, MAX_FOLLOWUP_NUMBER)
      : row.followup.followup_number;

    let nextFollowupId: string | null = null;
    if (transition.advanceStage && row.followup.followup_number < MAX_FOLLOWUP_NUMBER) {
      const insertedFollowupNumber = row.followup.followup_number + 1;
      const [nextFollowup] = await tx
        .insert(leadLifecycleFollowups)
        .values({
          lifecycle_id: row.lifecycle.id,
          followup_number: insertedFollowupNumber,
          assigned_dt_id: row.lead.assigned_dt_id ?? dtId,
          scheduled_date: scheduleNextFollowupFromConnected({
            referenceDate: now,
            brand: row.lead.brand,
            currentFollowupNumber: row.followup.followup_number,
          }),
          status: 'pending',
          attempt_count: 0,
          max_attempts: row.followup.max_attempts,
          payload: {
            objective: getCallObjective(row.lead.lead_type, insertedFollowupNumber),
          },
          updated_at: now,
        })
        .returning({ id: leadLifecycleFollowups.id });
      nextFollowupId = nextFollowup.id;

    }

    const lifecycleIsCompleted =
      !transition.advanceStage || row.followup.followup_number >= MAX_FOLLOWUP_NUMBER;
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
        is_testimonial: payload.is_testimonial ? true : row.lead.is_testimonial,
        active_lifecycle_id: lifecycleIsCompleted ? null : row.lifecycle.id,
        updated_at: now,
      })
      .where(eq(leads.id, row.lead.id));
    if (payload.is_testimonial) {
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

  const enriched = rows.map((r) => ({
    ...r,
    objective: getCallObjective(r.lead.lead_type, r.followup.followup_number),
    available_connected_choices: getConnectedChoicesForStage(r.followup.followup_number),
  }));

  const visible = filterVisibleActiveFollowups(enriched, now, dayBounds);
  const { todayDue, overdue } = splitFeedbackFollowupsByIstDay(visible, now);

  return {
    overdue,
    todayDue,
    total: visible.length,
  };
}
