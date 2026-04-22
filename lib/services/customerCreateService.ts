import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import {
  ensureLifecycleForLead,
  resolveOrCreateLeadForCustomer,
} from '@/lib/services/externalImportService';
import { refreshCustomerSummary } from '@/lib/services/customerSummaryService';

export interface CreateCustomerInput {
  phone?: string;
  name?: string;
  email?: string;
  source?: string;
  flag_type?: string;
  purchase_date?: string;
  variant?: string;
  metadata?: Record<string, unknown>;
  leadType?: 'nps' | 'review';
  assignedDtId?: string;
  remarks?: string;
  anchorDate?: string;
}

export interface CreateCustomerResult {
  customer: typeof customers.$inferSelect;
  lead_id: string;
  lifecycle_id: string;
  assigned_dt_id: string | null;
}

function normalizeIndianPhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (hasPlus) {
    if (!trimmed.startsWith('+91')) return null;
    if (digitsOnly.length !== 12 || !digitsOnly.startsWith('91')) return null;
    const local = digitsOnly.slice(2);
    if (!/^\d{10}$/.test(local)) return null;
    return `+91${local}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const local = digitsOnly.slice(2);
    if (!/^\d{10}$/.test(local)) return null;
    return `+91${local}`;
  }

  if (/^\d{10}$/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  return null;
}

export function isDuplicatePhoneError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('duplicate key') || error.message.includes('customers_phone');
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

  const leadType = 'review' as const;
  const source = input.source?.trim() || 'api_manual';

  const { customer, lead, lifecycleId } = await db.transaction(async (tx) => {
    const [newCustomer] = await tx
      .insert(customers)
      .values({
        phone: normalizedPhone,
        name,
        email: input.email?.trim().toLowerCase(),
        source,
        flag_type: input.flag_type?.trim(),
        purchase_date: input.purchase_date?.trim(),
        variant: input.variant?.trim(),
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

    const lcId = await ensureLifecycleForLead(newLead.id, input.anchorDate, tx);
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
