import type { CustomerListRow } from '@/lib/services/customerListService';
import {
  applyCustomerListFilters,
  parseCustomerListFilters,
} from '@/lib/utils/customerListFilters';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const sampleCustomers: CustomerListRow[] = [
  {
    id: '1',
    name: 'Alice Review',
    phone: '9000000001',
    email: 'alice@example.com',
    leadType: 'review',
    assignedDtId: 'dt-1',
    currentLifecycleStage: 'active',
    currentFollowupStage: 0,
    source: 'Amazon',
    purchaseDate: '2025-01-01',
    variant: 'A',
    ltvScore: '100',
    lastOrderDate: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    latestProductName: 'GLP',
    sku: 'SKU-1',
  },
  {
    id: '2',
    name: 'Bob Feedback',
    phone: '9000000002',
    email: 'bob@example.com',
    leadType: 'feedback',
    assignedDtId: 'dt-2',
    currentLifecycleStage: 'inactive',
    currentFollowupStage: 1,
    source: 'Flipkart',
    purchaseDate: '2025-02-01',
    variant: 'B',
    ltvScore: '200',
    lastOrderDate: null,
    createdAt: new Date('2025-02-01T00:00:00.000Z'),
    latestProductName: 'Scale',
    sku: 'SKU-2',
  },
];

function testParseFilters() {
  const params = new URLSearchParams({
    search: 'alice',
    leadType: 'review',
    marketplace: 'Amazon',
    assignedDtId: 'dt-1',
    lifecycleStage: 'active',
    followupStage: '0',
  });
  const filters = parseCustomerListFilters(params);
  assert(filters.search === 'alice', 'search parsed');
  assert(filters.leadType === 'review', 'leadType parsed');
  assert(filters.marketplace === 'Amazon', 'marketplace parsed');
  assert(filters.assignedDtId === 'dt-1', 'assignedDtId parsed');
  assert(filters.lifecycleStage === 'active', 'lifecycleStage parsed');
  assert(filters.followupStage === 0, 'followupStage parsed');
}

function testInvalidFiltersIgnored() {
  const params = new URLSearchParams({
    leadType: 'invalid',
    lifecycleStage: 'unknown',
    followupStage: '9',
  });
  const filters = parseCustomerListFilters(params);
  assert(filters.leadType === null, 'invalid leadType ignored');
  assert(filters.lifecycleStage === null, 'invalid lifecycleStage ignored');
  assert(filters.followupStage === null, 'invalid followupStage ignored');
}

function testApplyFilters() {
  const result = applyCustomerListFilters(sampleCustomers, {
    search: 'alice',
    leadType: 'review',
    marketplace: 'Amazon',
    assignedDtId: 'dt-1',
    lifecycleStage: 'active',
    followupStage: 0,
  });
  assert(result.length === 1, 'combined filters return one customer');
  assert(result[0]?.name === 'Alice Review', 'correct customer returned');
}

function testMarketplaceFilter() {
  const result = applyCustomerListFilters(sampleCustomers, {
    search: null,
    leadType: null,
    marketplace: 'Flipkart',
    assignedDtId: null,
    lifecycleStage: null,
    followupStage: null,
  });
  assert(result.length === 1 && result[0]?.id === '2', 'marketplace filter works');
}

testParseFilters();
testInvalidFiltersIgnored();
testApplyFilters();
testMarketplaceFilter();
console.log('customerListFilters.test.ts: all tests passed');
