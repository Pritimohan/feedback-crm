import * as XLSX from 'xlsx';
import {
  createOrEnsureCustomerLifecycle,
  type CreateCustomerInput,
} from '@/lib/services/customerCreateService';
import { normalizeIndianPhone } from '@/lib/utils/normalizeIndianPhone';

export const FEEDBACK_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_IMPORT_MAX_ROWS = 500;

export const FEEDBACK_IMPORT_COLUMNS = [
  'phone',
  'name',
  'brand',
  'email',
  'source',
  'flag_type',
  'purchase_date',
  'variant',
  'assignedDtId',
  'remarks',
  'anchorDate',
  'metadata',
] as const;

const REQUIRED_COLUMNS = ['phone', 'name', 'brand'] as const;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface FeedbackImportPreviewRow {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  data: CreateCustomerInput | null;
}

export interface FeedbackImportPreviewResult {
  summary: { total: number; valid: number; invalid: number };
  rows: FeedbackImportPreviewRow[];
}

export type FeedbackImportResultStatus = 'created' | 'updated' | 'already_active' | 'error';

export interface FeedbackImportResultRow {
  rowNumber: number;
  status: FeedbackImportResultStatus;
  message?: string;
  lead_id?: string;
  lifecycle_id?: string;
  phone: string;
  name: string;
}

export interface FeedbackImportResult {
  summary: {
    total: number;
    created: number;
    updated: number;
    already_active: number;
    failed: number;
  };
  results: FeedbackImportResultRow[];
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function isRowEmpty(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v.trim());
}

function parseBrand(value: string): 'fitty' | 'fitelo' | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'fitty' || normalized === 'fitelo') return normalized;
  return null;
}

function parseMetadata(value: string): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, data: {} };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'metadata must be a JSON object' };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: 'metadata must be valid JSON' };
  }
}

export function validateFeedbackImportRow(
  raw: Record<string, string>,
  rowNumber: number
): FeedbackImportPreviewRow {
  const errors: string[] = [];

  const phoneRaw = cellToString(raw.phone);
  const name = cellToString(raw.name);
  const brandRaw = cellToString(raw.brand);

  if (!phoneRaw) errors.push('phone is required');
  if (!name) errors.push('name is required');
  if (!brandRaw) errors.push('brand is required');

  const brand = brandRaw ? parseBrand(brandRaw) : null;
  if (brandRaw && !brand) errors.push('brand must be fitty or fitelo');

  const normalizedPhone = phoneRaw ? normalizeIndianPhone(phoneRaw) : null;
  if (phoneRaw && !normalizedPhone) {
    errors.push('phone must be a valid 10-digit Indian number');
  }

  const assignedDtId = cellToString(raw.assignedDtId);
  if (assignedDtId && !UUID_REGEX.test(assignedDtId)) {
    errors.push('assignedDtId must be a valid UUID');
  }

  const metadataRaw = cellToString(raw.metadata);
  const metadataParsed = parseMetadata(metadataRaw);
  if (!metadataParsed.ok) errors.push(metadataParsed.error);

  const anchorDate = cellToString(raw.anchorDate);
  if (anchorDate) {
    const parsed = Date.parse(anchorDate);
    if (Number.isNaN(parsed)) errors.push('anchorDate must be a valid ISO date');
  }

  if (errors.length > 0 || !brand || !normalizedPhone || !name) {
    return { rowNumber, valid: false, errors, data: null };
  }

  const input: CreateCustomerInput = {
    phone: normalizedPhone,
    name,
    brand,
    email: cellToString(raw.email) || undefined,
    source: cellToString(raw.source) || undefined,
    flag_type: cellToString(raw.flag_type) || undefined,
    purchase_date: cellToString(raw.purchase_date) || undefined,
    variant: cellToString(raw.variant) || undefined,
    assignedDtId: assignedDtId || undefined,
    remarks: cellToString(raw.remarks) || undefined,
    anchorDate: anchorDate || undefined,
    metadata: metadataParsed.ok && Object.keys(metadataParsed.data).length > 0 ? metadataParsed.data : undefined,
  };

  return { rowNumber, valid: true, errors: [], data: input };
}

export function parseFeedbackImportSheet(buffer: Buffer): FeedbackImportPreviewResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  if (!matrix.length) {
    throw new Error('Excel sheet is empty');
  }

  const headerRow = matrix[0];
  if (!Array.isArray(headerRow)) {
    throw new Error('Excel sheet is missing a header row');
  }

  const headers = headerRow.map((cell) => cellToString(cell));
  const missingRequired = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingRequired.length > 0) {
    throw new Error(`Missing required columns: ${missingRequired.join(', ')}`);
  }

  const dataRows = matrix.slice(1).filter((row) => {
    if (!Array.isArray(row)) return false;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = cellToString(row[index]);
    });
    return !isRowEmpty(record);
  });

  if (dataRows.length > FEEDBACK_IMPORT_MAX_ROWS) {
    throw new Error(`Too many rows. Maximum allowed is ${FEEDBACK_IMPORT_MAX_ROWS}`);
  }

  const rows: FeedbackImportPreviewRow[] = dataRows.map((row, index) => {
    const record: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      if (!header) return;
      record[header] = cellToString(Array.isArray(row) ? row[colIndex] : '');
    });
    return validateFeedbackImportRow(record, index + 2);
  });

  const valid = rows.filter((r) => r.valid).length;
  return {
    summary: { total: rows.length, valid, invalid: rows.length - valid },
    rows,
  };
}

export function buildFeedbackImportTemplateBuffer(): Buffer {
  const exampleRow: Record<string, string> = {
    phone: '9876543210',
    name: 'Jane Doe',
    brand: 'fitty',
    email: 'jane@example.com',
    source: 'excel_import',
    flag_type: '',
    purchase_date: '2026-06-01',
    variant: 'SKU-123',
    assignedDtId: '',
    remarks: 'Sample row',
    anchorDate: '',
    metadata: '{"order_id":"ORD-123"}',
  };

  const sheetData = [
    [...FEEDBACK_IMPORT_COLUMNS],
    FEEDBACK_IMPORT_COLUMNS.map((col) => exampleRow[col] ?? ''),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'feedback_leads');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

export async function importFeedbackLeads(
  rows: Array<{ rowNumber: number; input: CreateCustomerInput }>
): Promise<FeedbackImportResult> {
  const results: FeedbackImportResultRow[] = [];

  for (const { rowNumber, input } of rows) {
    const phone = input.phone ?? '';
    const name = input.name ?? '';
    const brand = input.brand;

    if (!brand) {
      results.push({
        rowNumber,
        status: 'error',
        message: 'brand is required',
        phone,
        name,
      });
      continue;
    }

    try {
      const result = await createOrEnsureCustomerLifecycle(
        {
          ...input,
          leadType: 'feedback',
          scheduleFirstCallNextCalendarDay: true,
        },
        brand
      );

      if (result.status === 'created') {
        results.push({
          rowNumber,
          status: 'created',
          message: 'New customer and feedback lead created',
          lead_id: result.data.lead_id,
          lifecycle_id: result.data.lifecycle_id,
          phone,
          name,
        });
        continue;
      }

      if (result.data.lifecycle_action === 'created') {
        results.push({
          rowNumber,
          status: 'updated',
          message: 'Existing customer — new feedback lifecycle created',
          lead_id: result.data.lead_id,
          lifecycle_id: result.data.lifecycle_id,
          phone,
          name,
        });
        continue;
      }

      results.push({
        rowNumber,
        status: 'already_active',
        message: 'Active feedback lifecycle already exists for this customer',
        lead_id: result.data.lead_id,
        lifecycle_id: result.data.lifecycle_id,
        phone,
        name,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message === 'VALIDATION_PHONE_INVALID'
            ? 'phone must be a valid 10-digit Indian number'
            : error.message === 'VALIDATION_PHONE_NAME_REQUIRED'
              ? 'phone and name are required'
              : error.message === 'CONFLICT_ACTIVE_LEAD'
                ? 'An active feedback lead already exists for this customer'
                : error.message
          : 'Import failed';

      results.push({
        rowNumber,
        status: 'error',
        message,
        phone,
        name,
      });
    }
  }

  return {
    summary: {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      updated: results.filter((r) => r.status === 'updated').length,
      already_active: results.filter((r) => r.status === 'already_active').length,
      failed: results.filter((r) => r.status === 'error').length,
    },
    results,
  };
}
