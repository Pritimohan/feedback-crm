import { db, type FeedbackDbTransaction } from '@/lib/db';
import { customers, leadLifecycles, leads } from '@/lib/db/schema';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import {
  ensureLifecycleForLead,
  resolveOrCreateLeadForCustomer,
  resolveAssignedDt,
} from '@/lib/services/externalImportService';
import { refreshCustomerSummary } from '@/lib/services/customerSummaryService';
import { normalizeIndianPhone } from '@/lib/utils/normalizeIndianPhone';

export interface CreateCustomerInput {
  phone?: string;
  name?: string;
  email?: string;
  source?: string;
  flag_type?: string;
  purchase_date?: string;
  variant?: string;
  metadata?: Record<string, unknown>;
  leadType?: 'nps' | 'review' | 'feedback';
  brand?: 'fitty' | 'fitelo';
  assignedDtId?: string;
  remarks?: string;
  anchorDate?: string;
  /** Server-set for warranty/dietplan: first follow-up on next calendar day at NEXT_DAY_RETRY_HOUR. */
  scheduleFirstCallNextCalendarDay?: boolean;
}

export interface CreateCustomerResult {
  customer: typeof customers.$inferSelect;
  lead_id: string;
  lifecycle_id: string;
  assigned_dt_id: string | null;
}

export interface EnsureCustomerLifecycleResult {
  customer: typeof customers.$inferSelect;
  lead_id: string;
  lifecycle_id: string;
  assigned_dt_id: string | null;
  lifecycle_action: 'created' | 'already_active';
}

export type CreateOrEnsureCustomerLifecycleResult =
  | { status: 'created'; data: CreateCustomerResult }
  | { status: 'existing'; data: EnsureCustomerLifecycleResult };

function matchesBrandFilter(brand: 'fitty' | 'fitelo') {
  if (brand === 'fitelo') {
    return eq(leads.brand, 'fitelo');
  }
  return or(eq(leads.brand, 'fitty'), isNull(leads.brand));
}

async function findBrandActiveLead(
  customerId: string,
  forcedBrand: 'fitty' | 'fitelo',
  leadType: 'nps' | 'review' | 'feedback',
  tx: FeedbackDbTransaction
) {
  const [lead] = await tx
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.customer_id, customerId),
        eq(leads.lead_type, leadType),
        eq(leads.activity_status, 'active'),
        matchesBrandFilter(forcedBrand)
      )
    )
    .orderBy(desc(leads.updated_at))
    .limit(1);
  return lead ?? null;
}

async function hasActiveLifecycle(leadId: string, tx: FeedbackDbTransaction): Promise<boolean> {
  const [row] = await tx
    .select({ id: leadLifecycles.id })
    .from(leadLifecycles)
    .where(and(eq(leadLifecycles.lead_id, leadId), eq(leadLifecycles.status, 'active')))
    .limit(1);
  return Boolean(row);
}

export function isDuplicatePhoneError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const normalizedMessage = error.message.toLowerCase();
  if (normalizedMessage.includes('duplicate key') || normalizedMessage.includes('customers_phone')) {
    return true;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return false;

  const postgresCode = (cause as { code?: unknown }).code;
  const constraintName = (cause as { constraint_name?: unknown }).constraint_name;
  const detail = (cause as { detail?: unknown }).detail;

  if (postgresCode === '23505' && constraintName === 'customers_phone_unique') {
    return true;
  }

  return typeof detail === 'string' && detail.includes('Key (phone)=');
}

export async function createCustomerWithAutoLeadLifecycle(
  input: CreateCustomerInput,
  forcedBrand: 'fitty' | 'fitelo'
): Promise<CreateCustomerResult> {
  const normalizedPhone = input.phone ? normalizeIndianPhone(input.phone) : null;
  const name = input.name?.trim();

  if (!input.phone || !name) {
    throw new Error('VALIDATION_PHONE_NAME_REQUIRED');
  }
  if (!normalizedPhone) {
    throw new Error('VALIDATION_PHONE_INVALID');
  }

  const leadType = input.leadType ?? 'review';
  const source = input.source?.trim() || 'api_manual';

  const { customer, lead, lifecycleId } = await db.transaction(async (tx) => {
    const [newCustomer] = await tx
      .insert(customers)
      .values({
        phone: normalizedPhone,
        name,
        email: input.email?.trim().toLowerCase(),
        flag_type: input.flag_type?.trim(),
        metadata: input.metadata ?? { created_via: 'api_customers_post' },
      })
      .returning();

    const { lead: newLead, created } = await resolveOrCreateLeadForCustomer({
      customerId: newCustomer.id,
      leadType,
      preferredDtId: input.assignedDtId ?? null,
      brand: forcedBrand,
      remarks: input.remarks,
      tx,
    });

    if (!created) {
      throw new Error('CONFLICT_ACTIVE_LEAD');
    }

    await tx
      .update(leads)
      .set({
        source,
        purchase_date: input.purchase_date?.trim(),
        variant: input.variant?.trim(),
      })
      .where(eq(leads.id, newLead.id));

    const lcId = await ensureLifecycleForLead(newLead.id, input.anchorDate, tx, {
      scheduleFirstCallNextCalendarDay: input.scheduleFirstCallNextCalendarDay,
    });
    return { customer: newCustomer, lead: newLead, lifecycleId: lcId };
  });

  await refreshCustomerSummary(customer.id);

  return {
    customer,
    lead_id: lead.id,
    lifecycle_id: lifecycleId,
    assigned_dt_id: lead.assigned_dt_id,
  };
}

export async function ensureLifecycleForExistingCustomerByPhone(
  input: CreateCustomerInput,
  forcedBrand: 'fitty' | 'fitelo'
): Promise<EnsureCustomerLifecycleResult> {
  const normalizedPhone = input.phone ? normalizeIndianPhone(input.phone) : null;
  const name = input.name?.trim();
  if (!input.phone || !name) {
    throw new Error('VALIDATION_PHONE_NAME_REQUIRED');
  }
  if (!normalizedPhone) {
    throw new Error('VALIDATION_PHONE_INVALID');
  }

  const result = await db.transaction(async (tx) => {
    const [existingCustomer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.phone, normalizedPhone))
      .limit(1);
    if (!existingCustomer) {
      throw new Error('CUSTOMER_NOT_FOUND_BY_PHONE');
    }

    const leadType = input.leadType ?? 'review';
    let lead = await findBrandActiveLead(existingCustomer.id, forcedBrand, leadType, tx);
    if (!lead) {
      const assignedDtId = await resolveAssignedDt(input.assignedDtId ?? null, tx, {
        brand: forcedBrand,
        leadType,
      });
      const [newLead] = await tx
        .insert(leads)
        .values({
          customer_id: existingCustomer.id,
          lead_type: leadType,
          activity_status: 'active',
          assigned_dt_id: assignedDtId,
          brand: forcedBrand,
          source: input.source?.trim() || 'api_manual',
          purchase_date: input.purchase_date?.trim(),
          variant: input.variant?.trim(),
          remarks: input.remarks,
        })
        .returning();
      lead = newLead;
    }

    const lifecycleAlreadyActive = await hasActiveLifecycle(lead.id, tx);
    const lifecycleId = await ensureLifecycleForLead(lead.id, input.anchorDate, tx, {
      scheduleFirstCallNextCalendarDay: input.scheduleFirstCallNextCalendarDay,
    });
    const lifecycleAction: EnsureCustomerLifecycleResult['lifecycle_action'] =
      lifecycleAlreadyActive ? 'already_active' : 'created';
    return {
      customer: existingCustomer,
      lead,
      lifecycleId,
      lifecycleAction,
    };
  });

  await refreshCustomerSummary(result.customer.id);

  return {
    customer: result.customer,
    lead_id: result.lead.id,
    lifecycle_id: result.lifecycleId,
    assigned_dt_id: result.lead.assigned_dt_id,
    lifecycle_action: result.lifecycleAction,
  };
}

export async function createOrEnsureCustomerLifecycle(
  input: CreateCustomerInput,
  forcedBrand: 'fitty' | 'fitelo'
): Promise<CreateOrEnsureCustomerLifecycleResult> {
  try {
    const created = await createCustomerWithAutoLeadLifecycle(input, forcedBrand);
    return { status: 'created', data: created };
  } catch (error) {
    if (!isDuplicatePhoneError(error)) {
      throw error;
    }
    const existing = await ensureLifecycleForExistingCustomerByPhone(input, forcedBrand);
    return { status: 'existing', data: existing };
  }
}
