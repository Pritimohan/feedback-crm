import type { CustomerListRow } from '@/lib/services/customerListService';
import type { CustomerInteractionRow } from '@/lib/services/customerInteractionService';

export const CUSTOMER_EXPORT_CSV_HEADERS = [
  'name',
  'phone',
  'email',
  'leadType',
  'currentLifecycleStage',
  'currentFollowupStage',
  'source',
  'purchaseDate',
  'variant',
  'createdAt',
  'callOutcome',
  'callNotes',
  'callTimestamp',
  'callFollowupStage',
  'callAgentName',
  'connectedChoice',
  'issueDescription',
  'reviewRemark',
  'interestedRemark',
  'didntReviewedRemark',
] as const;

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formDataString(formData: Record<string, unknown> | null, key: string): string {
  if (!formData) return '';
  const value = formData[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

function customerCells(customer: CustomerListRow): string[] {
  return [
    formatCell(customer.name),
    formatCell(customer.phone),
    formatCell(customer.email),
    formatCell(customer.leadType),
    formatCell(customer.currentLifecycleStage),
    formatCell(customer.currentFollowupStage),
    formatCell(customer.source),
    formatCell(customer.purchaseDate),
    formatCell(customer.variant),
    formatDate(customer.createdAt),
  ];
}

function interactionCells(interaction: CustomerInteractionRow | null): string[] {
  if (!interaction) {
    return Array(10).fill('');
  }

  const formData = interaction.formData;
  return [
    formatCell(interaction.outcome),
    formatCell(interaction.notes),
    formatDate(interaction.timestamp),
    formatCell(interaction.followupNumber),
    formatCell(interaction.agentName),
    formDataString(formData, 'connected_choice'),
    formDataString(formData, 'issue_description'),
    formDataString(formData, 'review_remark'),
    formDataString(formData, 'interested_remark'),
    formDataString(formData, 'didnt_reviewed_remark'),
  ];
}

function isExportableInteraction(interaction: CustomerInteractionRow): boolean {
  return interaction.outcome.toLowerCase() !== 'initiated';
}

export function groupInteractionsByCustomer(
  interactions: CustomerInteractionRow[]
): Map<string, CustomerInteractionRow[]> {
  const map = new Map<string, CustomerInteractionRow[]>();
  for (const interaction of interactions) {
    if (!isExportableInteraction(interaction)) continue;
    const existing = map.get(interaction.customerId) ?? [];
    existing.push(interaction);
    map.set(interaction.customerId, existing);
  }
  return map;
}

export function buildCustomerExportRows(
  customers: CustomerListRow[],
  interactionsByCustomer: Map<string, CustomerInteractionRow[]>
): string[][] {
  const rows: string[][] = [];

  for (const customer of customers) {
    const interactions = interactionsByCustomer.get(customer.id) ?? [];
    if (interactions.length === 0) {
      rows.push([...customerCells(customer), ...interactionCells(null)]);
      continue;
    }

    for (const interaction of interactions) {
      rows.push([...customerCells(customer), ...interactionCells(interaction)]);
    }
  }

  return rows;
}
