import type { CrmBrand } from '@/lib/crmBrand.shared';
import { resolveExotelExophone } from '@/lib/services/exotelExophone';

export interface ExotelCallRequest {
  from: string;
  to: string;
  callerId?: string;
  brand?: CrmBrand;
}

export interface ExotelCallResponse {
  callSid?: string;
  status?: string;
  raw: unknown;
}

function asStringOrUndefined(v: unknown): string | undefined {
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v);
  }
  return undefined;
}

function extractCallSid(raw: any, text: string): string | undefined {
  const candidates = [
    raw?.Call?.Sid,
    raw?.Call?.SID,
    raw?.Call?.CallSid,
    raw?.Call?.CallSID,
    raw?.CallSid,
    raw?.CallSID,
    raw?.Sid,
    raw?.SID,
  ];
  for (const c of candidates) {
    const s = asStringOrUndefined(c);
    if (s) return s;
  }

  const m =
    text.match(/<Sid>([^<]+)<\/Sid>/i) ||
    text.match(/<CallSid>([^<]+)<\/CallSid>/i) ||
    text.match(/"Sid"\s*:\s*"([^"]+)"/i) ||
    text.match(/"CallSid"\s*:\s*"([^"]+)"/i) ||
    text.match(/\bCallSid\s*=\s*([A-Za-z0-9\-]+)/i) ||
    text.match(/\bSid\s*=\s*([A-Za-z0-9\-]+)/i);
  return m ? m[1]?.trim() : undefined;
}

function extractStatus(raw: any): string | undefined {
  const candidates = [raw?.Call?.Status, raw?.Call?.status, raw?.Status, raw?.status];
  for (const c of candidates) {
    const s = asStringOrUndefined(c);
    if (s) return s;
  }
  return undefined;
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, '').trim();
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function extractRecordingUrl(raw: any, text: string): string | undefined {
  const candidates = [
    raw?.Call?.RecordingUrl,
    raw?.Call?.RecordingURL,
    raw?.Call?.recording_url,
    raw?.Call?.recordingUrl,
    raw?.RecordingUrl,
    raw?.RecordingURL,
    raw?.recording_url,
    raw?.recordingUrl,
  ];
  for (const c of candidates) {
    const s = asStringOrUndefined(c);
    if (s) return s;
  }

  const m =
    text.match(/<RecordingUrl>([^<]+)<\/RecordingUrl>/i) ||
    text.match(/"RecordingUrl"\s*:\s*"([^"]+)"/i) ||
    text.match(/"recording_url"\s*:\s*"([^"]+)"/i);
  return m ? m[1]?.trim() : undefined;
}

export async function connectCall(request: ExotelCallRequest): Promise<ExotelCallResponse> {
  const sid = getEnv('EXOTEL_SID');
  const apiKey = getEnv('EXOTEL_API_KEY');
  const apiToken = getEnv('EXOTEL_API_TOKEN');
  const subdomain = getEnv('EXOTEL_SUBDOMAIN');
  const exophone = await resolveExotelExophone(request.brand ?? 'fitty', request.callerId);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');

  const from = normalizePhone(request.from);
  const to = normalizePhone(request.to);

  const url = `https://${subdomain}/v1/Accounts/${sid}/Calls/connect`;
  console.log('[Exotel] URL:', url);
  console.log('[Exotel] SID:', sid.substring(0, 3) + '***' + sid.substring(sid.length - 3));
  console.log('[Exotel] From:', from, 'To:', to, 'CallerId:', exophone);

  const body = new URLSearchParams();
  body.append('From', from);
  body.append('To', to);
  body.append('CallerId', exophone);
  body.append('Record', 'true');
  body.append('RecordingChannels', 'dual');
  body.append('RecordingFormat', 'mp3');
  if (appUrl) {
    body.append('StatusCallback', `${appUrl}/api/webhooks/exotel`);
    body.append('StatusCallbackMethod', 'POST');
  }

  const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  console.log('[Exotel] Response status:', response.status);

  const text = await response.text();
  let raw: any;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    raw = { error: text };
  }

  if (!response.ok) {
    const apiError =
      (raw as { error?: string }).error ||
      (raw as { RestException?: { Message?: string } }).RestException?.Message ||
      'Exotel call failed';
    throw new Error(`Exotel call failed (${response.status} ${response.statusText}): ${apiError}`);
  }

  const callSid = extractCallSid(raw, text);
  const status = extractStatus(raw);

  return { callSid, status, raw };
}

export async function getRecordingUrlForCall(callSid: string): Promise<string | undefined> {
  const sid = getEnv('EXOTEL_SID');
  const apiKey = getEnv('EXOTEL_API_KEY');
  const apiToken = getEnv('EXOTEL_API_TOKEN');
  const subdomain = getEnv('EXOTEL_SUBDOMAIN');

  const url = `https://${subdomain}/v1/Accounts/${sid}/Calls/${encodeURIComponent(callSid)}`;
  const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const text = await response.text();
  let raw: any;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    raw = { error: text };
  }

  if (!response.ok) return undefined;
  return extractRecordingUrl(raw, text);
}
