import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import { db } from '../lib/db';
import { customers, leadLifecycles, leads } from '../lib/db/schema';
import { ensureLifecycleForExistingCustomerByPhone } from '../lib/services/customerCreateService';
import { createLifecycleForLead } from '../lib/services/leadLifecycleEngine';

dotenv.config({ path: '.env.local' });

function randomPhone(): string {
  const suffix = String(Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000);
  return `+91${suffix}`;
}

async function createCustomerRecord(namePrefix: string) {
  const [customer] = await db
    .insert(customers)
    .values({
      phone: randomPhone(),
      name: `${namePrefix}-${randomUUID().slice(0, 8)}`,
      metadata: { seed: 'duplicate_lifecycle_test' },
    })
    .returning();
  return customer;
}

async function createActiveLead(params: {
  customerId: string;
  brand: 'fitty' | 'fitelo';
  withActiveLifecycle?: boolean;
}) {
  const [lead] = await db
    .insert(leads)
    .values({
      customer_id: params.customerId,
      lead_type: 'review',
      activity_status: 'active',
      brand: params.brand,
      source: 'test_script',
    })
    .returning();

  if (params.withActiveLifecycle) {
    await createLifecycleForLead({
      leadId: lead.id,
      anchorDate: new Date(),
      lifecycleType: 'feedback_default',
    });
  }

  return lead;
}

async function assertLeadBrand(leadId: string, expectedBrand: 'fitty' | 'fitelo') {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  assert.ok(lead, 'lead should exist');
  assert.equal(lead.brand, expectedBrand);
}

async function countActiveReviewLeads(customerId: string): Promise<number> {
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.customer_id, customerId),
        eq(leads.lead_type, 'review'),
        eq(leads.activity_status, 'active')
      )
    );
  return rows.length;
}

async function assertActiveLifecycleExists(leadId: string) {
  const [row] = await db
    .select({ id: leadLifecycles.id })
    .from(leadLifecycles)
    .where(and(eq(leadLifecycles.lead_id, leadId), eq(leadLifecycles.status, 'active')))
    .limit(1);
  assert.ok(row, 'active lifecycle should exist');
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run duplicate lifecycle flow tests');
  }

  // Case 1: duplicate customer with target-brand lead but no active lifecycle -> lifecycle gets created.
  const customer1 = await createCustomerRecord('dup-no-lifecycle');
  const lead1 = await createActiveLead({ customerId: customer1.id, brand: 'fitelo' });
  const case1 = await ensureLifecycleForExistingCustomerByPhone(
    { phone: customer1.phone, name: customer1.name },
    'fitelo'
  );
  assert.equal(case1.lifecycle_action, 'created');
  assert.equal(case1.lead_id, lead1.id);
  await assertActiveLifecycleExists(lead1.id);

  // Case 2: duplicate customer with active lifecycle already present -> no-op lifecycle action.
  const customer2 = await createCustomerRecord('dup-active-lifecycle');
  const lead2 = await createActiveLead({
    customerId: customer2.id,
    brand: 'fitty',
    withActiveLifecycle: true,
  });
  const case2 = await ensureLifecycleForExistingCustomerByPhone(
    { phone: customer2.phone, name: customer2.name },
    'fitty'
  );
  assert.equal(case2.lifecycle_action, 'already_active');
  assert.equal(case2.lead_id, lead2.id);

  // Case 3: duplicate customer has active lead in other brand -> do not update existing lead; create new brand lead + lifecycle.
  const customer3 = await createCustomerRecord('dup-wrong-brand');
  const lead3 = await createActiveLead({ customerId: customer3.id, brand: 'fitty' });
  const case3 = await ensureLifecycleForExistingCustomerByPhone(
    { phone: customer3.phone, name: customer3.name },
    'fitelo'
  );
  assert.equal(case3.lifecycle_action, 'created');
  assert.notEqual(case3.lead_id, lead3.id);
  await assertLeadBrand(lead3.id, 'fitty');
  await assertLeadBrand(case3.lead_id, 'fitelo');
  await assertActiveLifecycleExists(case3.lead_id);
  assert.equal(await countActiveReviewLeads(customer3.id), 2);

  console.log('Duplicate customer lifecycle flow tests passed.');
}

run();
