import type { CustomerListRow } from '@/lib/services/customerListService';
import { matchesMarketplaceFilter } from '@/lib/utils/marketplaceSources';

export type LeadTypeFilter = 'review' | 'nps' | 'feedback';
export type LifecycleStageFilter = 'active' | 'inactive' | 'deferred';

export type CustomerListFilterParams = {
  search: string | null;
  leadType: LeadTypeFilter | null;
  marketplace: string | null;
  assignedDtId: string | null;
  lifecycleStage: LifecycleStageFilter | null;
  followupStage: number | null;
};

const LEAD_TYPES: LeadTypeFilter[] = ['review', 'nps', 'feedback'];
const LIFECYCLE_STAGES: LifecycleStageFilter[] = ['active', 'inactive', 'deferred'];

function parseLeadType(value: string | null): LeadTypeFilter | null {
  if (!value) return null;
  return LEAD_TYPES.includes(value as LeadTypeFilter) ? (value as LeadTypeFilter) : null;
}

function parseLifecycleStage(value: string | null): LifecycleStageFilter | null {
  if (!value) return null;
  return LIFECYCLE_STAGES.includes(value as LifecycleStageFilter)
    ? (value as LifecycleStageFilter)
    : null;
}

function parseFollowupStage(value: string | null): number | null {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2) return null;
  return parsed;
}

export function parseCustomerListFilters(searchParams: URLSearchParams): CustomerListFilterParams {
  const search = searchParams.get('search')?.trim() || null;
  const leadType = parseLeadType(searchParams.get('leadType'));
  const marketplace = searchParams.get('marketplace')?.trim() || null;
  const assignedDtId = searchParams.get('assignedDtId')?.trim() || null;
  const lifecycleStage = parseLifecycleStage(searchParams.get('lifecycleStage'));
  const followupStage = parseFollowupStage(searchParams.get('followupStage'));

  return {
    search,
    leadType,
    marketplace,
    assignedDtId,
    lifecycleStage,
    followupStage,
  };
}

export function applyCustomerListFilters(
  rows: CustomerListRow[],
  filters: CustomerListFilterParams
): CustomerListRow[] {
  let filtered = rows;

  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(
      (customer) =>
        customer.name.toLowerCase().includes(search) ||
        customer.phone.includes(filters.search!) ||
        (customer.email && customer.email.toLowerCase().includes(search))
    );
  }

  if (filters.assignedDtId) {
    filtered = filtered.filter((customer) => customer.assignedDtId === filters.assignedDtId);
  }

  if (filters.lifecycleStage) {
    filtered = filtered.filter(
      (customer) => customer.currentLifecycleStage === filters.lifecycleStage
    );
  }

  if (filters.followupStage !== null) {
    filtered = filtered.filter(
      (customer) => customer.currentFollowupStage === filters.followupStage
    );
  }

  if (filters.leadType) {
    filtered = filtered.filter((customer) => customer.leadType === filters.leadType);
  }

  if (filters.marketplace) {
    filtered = filtered.filter((customer) =>
      matchesMarketplaceFilter(customer.source, filters.marketplace)
    );
  }

  return filtered;
}

export function customerListFiltersToSearchParams(
  filters: CustomerListFilterParams
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.leadType) params.set('leadType', filters.leadType);
  if (filters.marketplace) params.set('marketplace', filters.marketplace);
  if (filters.assignedDtId) params.set('assignedDtId', filters.assignedDtId);
  if (filters.lifecycleStage) params.set('lifecycleStage', filters.lifecycleStage);
  if (filters.followupStage !== null) params.set('followupStage', String(filters.followupStage));
  return params;
}
