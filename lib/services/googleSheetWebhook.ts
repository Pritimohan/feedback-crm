interface ConnectedIssueSheetRow {
  customerPhoneNo: string;
  customerName: string;
  brand: string;
  orderId: string;
  productPurchased: string;
  issue: string;
  raisedByDt: string;
  timestamp: string;
}

interface ConnectedIssueSheetPayload {
  sheetName: 'fitelo' | 'fitty';
  row: ConnectedIssueSheetRow;
}

const CONNECTED_ISSUE_HEADERS = [
  'Customer Phone No.',
  'Customer Name',
  'Brand',
  'Order ID',
  'Product Purchased',
  'Issue',
  'Raised By (Dt)',
  'Timestamp',
] as const;

const DEFAULT_TIMEOUT_MS = 5000;
const RETRY_ATTEMPTS = 2;

async function postWithTimeout(url: string, body: unknown, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendConnectedIssueRowToGoogleSheet(payload: ConnectedIssueSheetPayload): Promise<void> {
  const webhookUrl = process.env.GSHEET_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('GSHEET_WEBHOOK_URL is not configured; skipping Google Sheet sync');
    return;
  }
  if (!webhookUrl.startsWith('https://script.google.com/macros/s/') || !webhookUrl.endsWith('/exec')) {
    throw new Error(
      'GSHEET_WEBHOOK_URL must be Apps Script Web App /exec URL (Deploy -> Web app), e.g. https://script.google.com/macros/s/.../exec'
    );
  }

  const requestBody = {
    sheetName: payload.sheetName,
    headers: CONNECTED_ISSUE_HEADERS,
    row: payload.row,
    values: [
      payload.row.customerPhoneNo,
      payload.row.customerName,
      payload.row.brand,
      payload.row.orderId,
      payload.row.productPurchased,
      payload.row.issue,
      payload.row.raisedByDt,
      payload.row.timestamp,
    ],
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await postWithTimeout(webhookUrl, requestBody, DEFAULT_TIMEOUT_MS);
      if (response.ok) return;

      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Webhook returned ${response.status}. Apps Script access is denied; redeploy as Web app with access set to Anyone and use the /exec URL.`
        );
      }
      throw new Error(`Webhook returned ${response.status}: ${errorText || 'Unknown error'}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown webhook error');
      if (attempt === RETRY_ATTEMPTS) break;
    }
  }

  throw lastError ?? new Error('Failed to send data to Google Sheet webhook');
}
