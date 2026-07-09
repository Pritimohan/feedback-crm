import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdateAdhocCallLogBySid, enrichCallLogBySid } from '@/lib/services/callLogService';
import { getRecordingUrlForCall } from '@/lib/services/exotel';

function parseWebhookPayload(text: string) {
  const params = new URLSearchParams(text);
  const payload: Record<string, string> = {};
  params.forEach((value, key) => {
    payload[key] = value;
  });
  return payload;
}

function parseGetPayload(request: NextRequest) {
  const payload: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    payload[key] = value;
  });
  return payload;
}

function pickRecordingUrl(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload?.RecordingUrl,
    payload?.RecordingURL,
    payload?.recording_url,
    payload?.recordingUrl,
    (payload?.Call as Record<string, unknown> | undefined)?.RecordingUrl,
    (payload?.Call as Record<string, unknown> | undefined)?.RecordingURL,
    (payload?.Call as Record<string, unknown> | undefined)?.recording_url,
    (payload?.Call as Record<string, unknown> | undefined)?.recordingUrl,
    payload?.RecordingUrl0,
    payload?.RecordingUrl1,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

async function handleWebhookPayload(payload: Record<string, unknown>) {
  const sid =
    (payload.CallSid as string | undefined) ||
    (payload.CallSID as string | undefined) ||
    (payload.call_sid as string | undefined) ||
    (payload.sid as string | undefined) ||
    ((payload.Call as Record<string, unknown> | undefined)?.Sid as string | undefined) ||
    ((payload.Call as Record<string, unknown> | undefined)?.CallSid as string | undefined);

  if (!sid) {
    return NextResponse.json({ error: 'Missing call sid' }, { status: 400 });
  }

  const parseDate = (v: unknown) => {
    if (!v || typeof v !== 'string') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const status =
    (payload.CallStatus as string | undefined) ||
    (payload.Status as string | undefined) ||
    ((payload.Call as Record<string, unknown> | undefined)?.Status as string | undefined) ||
    (payload.status as string | undefined);

  const durationRaw =
    payload.Duration ?? payload.CallDuration ?? (payload.Call as Record<string, unknown> | undefined)?.Duration;
  const durationParsed = durationRaw != null && durationRaw !== '' ? Number(durationRaw) : NaN;
  const durationSec = Number.isFinite(durationParsed) ? durationParsed : null;

  let recordingUrl = pickRecordingUrl(payload);
  const lowerStatus = typeof status === 'string' ? status.toLowerCase() : '';
  if (!recordingUrl && (lowerStatus === 'completed' || lowerStatus === 'connected')) {
    try {
      recordingUrl = (await getRecordingUrlForCall(sid)) ?? null;
    } catch (e) {
      console.warn('[Exotel Webhook] Failed to fetch recording URL:', e);
    }
  }

  const lifecycleRow = await enrichCallLogBySid({
    providerCallSid: sid,
    providerStatusRaw: status,
    providerRecordingUrl: recordingUrl ?? undefined,
    providerStartAt: parseDate(payload.StartTime ?? payload.start_time),
    providerEndAt: parseDate(payload.EndTime ?? payload.end_time),
    providerDurationSec: durationSec,
    providerRingSec: payload.ring_duration != null ? Number(payload.ring_duration) : null,
    providerTalkSec: payload.talk_duration != null ? Number(payload.talk_duration) : null,
    rawPayload: payload,
  });

  if (lifecycleRow) {
    return NextResponse.json({ success: true, data: lifecycleRow, source: 'lifecycle_call_log' });
  }

  const dtPhone =
    (payload.From as string | undefined) ||
    (payload.AgentPhone as string | undefined) ||
    '';
  const customerPhone =
    (payload.To as string | undefined) ||
    (payload.CustomerPhone as string | undefined) ||
    '';
  const customerIdRaw = payload.CustomerId ?? (payload as { customer_id?: string }).customer_id;
  const customerId =
    typeof customerIdRaw === 'string' && /^[0-9a-f-]{36}$/i.test(customerIdRaw) ? customerIdRaw : null;

  const adhocRow = customerPhone
    ? await createOrUpdateAdhocCallLogBySid({
        providerCallSid: sid,
        dtId: null,
        dtPhone: dtPhone || undefined,
        customerPhone,
        customerId,
        providerStatusRaw: status,
        rawPayload: payload,
      })
    : null;

  if (adhocRow) {
    await enrichCallLogBySid({
      providerCallSid: sid,
      providerStatusRaw: status,
      providerRecordingUrl: recordingUrl ?? undefined,
      providerStartAt: parseDate(payload.StartTime ?? payload.start_time),
      providerEndAt: parseDate(payload.EndTime ?? payload.end_time),
      providerDurationSec: durationSec,
      providerRingSec: payload.ring_duration != null ? Number(payload.ring_duration) : null,
      providerTalkSec: payload.talk_duration != null ? Number(payload.talk_duration) : null,
      rawPayload: payload,
    });
    return NextResponse.json({ success: true, source: 'adhoc_call_log' });
  }

  return NextResponse.json({ success: true, source: 'ignored_no_matching_call_log' });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const payload = (contentType.includes('application/json')
      ? await request.json()
      : parseWebhookPayload(await request.text())) as Record<string, unknown>;
    return handleWebhookPayload(payload);
  } catch (error) {
    console.error('Exotel webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = parseGetPayload(request) as unknown as Record<string, unknown>;
    return handleWebhookPayload(payload);
  } catch (error) {
    console.error('Exotel webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
