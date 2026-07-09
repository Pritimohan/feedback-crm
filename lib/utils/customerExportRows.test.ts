import type { CustomerListRow } from '@/lib/services/customerListService';
import type { CustomerInteractionRow } from '@/lib/services/customerInteractionService';
import {
  buildCustomerExportRows,
  CUSTOMER_EXPORT_CSV_HEADERS,
  groupInteractionsByCustomer,
} from '@/lib/utils/customerExportRows';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const customer: CustomerListRow = {
  id: 'cust-1',
  name: 'Alice',
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
};

const interaction: CustomerInteractionRow = {
  customerId: 'cust-1',
  outcome: 'connected',
  notes: 'Spoke with customer',
  timestamp: new Date('2025-03-01T10:00:00.000Z'),
  followupNumber: 1,
  agentName: 'Agent One',
  formData: {
    connected_choice: 'issue_with_product',
    issue_description: 'Packaging damaged',
    review_remark: 'Will review later',
  },
};

function testHeadersCount() {
  assert(CUSTOMER_EXPORT_CSV_HEADERS.length === 20, 'export has 20 columns');
}

function testOneRowPerInteraction() {
  const initiated: CustomerInteractionRow = {
    ...interaction,
    outcome: 'initiated',
    notes: null,
    formData: null,
  };
  const second: CustomerInteractionRow = {
    ...interaction,
    outcome: 'busy',
    notes: 'No answer',
    timestamp: new Date('2025-03-02T10:00:00.000Z'),
    formData: null,
  };
  const map = groupInteractionsByCustomer([interaction, initiated, second]);
  const rows = buildCustomerExportRows([customer], map);
  assert(rows.length === 2, 'initiated excluded; two exportable interactions');
  assert(rows[0]?.[0] === 'Alice', 'customer name on each row');
  assert(rows[0]?.[15] === 'issue_with_product', 'connectedChoice flattened');
  assert(rows[0]?.[16] === 'Packaging damaged', 'issueDescription flattened');
}

function testNoInteractionsRow() {
  const rows = buildCustomerExportRows([customer], new Map());
  assert(rows.length === 1, 'customer without calls still exported once');
  assert(rows[0]?.[10] === '', 'call columns blank when no interactions');
}

function testExcludedColumnsNotPresent() {
  const rows = buildCustomerExportRows([customer], groupInteractionsByCustomer([interaction]));
  const row = rows[0] ?? [];
  assert(row.length === 20, 'row has exactly 20 cells');
  assert(!CUSTOMER_EXPORT_CSV_HEADERS.includes('id' as never), 'id not in headers');
  assert(!CUSTOMER_EXPORT_CSV_HEADERS.includes('callRecordingUrl' as never), 'recording url not exported');
}

testHeadersCount();
testOneRowPerInteraction();
testNoInteractionsRow();
testExcludedColumnsNotPresent();
console.log('customerExportRows.test.ts: all tests passed');
