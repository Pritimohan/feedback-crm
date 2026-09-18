/**
 * Extract and normalize error messages for user-facing toasts.
 * Prefer real API / Exotel messages over generic fallbacks; never show raw XML.
 */

const XML_MESSAGE_RE = /<Message>([^<]+)<\/Message>/i;
const XML_HINT_RE = /<\?xml|<TwilioResponse|<RestException/i;

/** Known Exotel / provider phrases → clearer guidance for agents. */
const KNOWN_MESSAGE_MAP: Array<{ match: RegExp; message: string }> = [
  {
    match: /could not find the callerid/i,
    message:
      'Could not find the CallerId from which this call can be made. Check the Exophone in Admin → Config → Calling (or EXOTEL_EXOPHONE_* env) matches a number on this Exotel account.',
  },
  {
    match: /not a valid.+number|invalid (from|to|callerid)/i,
    message:
      'One of the phone numbers is invalid for Exotel. Check the agent number, customer number, and Exophone format.',
  },
  {
    match: /exotel.*(authentication|unauthorized|invalid credentials)|(authentication|unauthorized|invalid credentials).*exotel/i,
    message: 'Exotel authentication failed. Check EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_SID.',
  },
];

export function extractMessageFromXml(text: string): string | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const m = text.match(XML_MESSAGE_RE);
  const msg = m?.[1]?.trim();
  return msg || undefined;
}

function asNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

/**
 * Pull a user-facing string from a parsed API JSON body (or similar).
 */
export function extractErrorFromBody(data: unknown): string | undefined {
  if (data == null) return undefined;

  if (typeof data === 'string') {
    const xmlMsg = extractMessageFromXml(data);
    if (xmlMsg) return xmlMsg;
    if (XML_HINT_RE.test(data)) return undefined;
    return asNonEmptyString(data);
  }

  if (typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  const restException = obj.RestException;
  if (restException && typeof restException === 'object') {
    const msg = asNonEmptyString((restException as { Message?: unknown }).Message);
    if (msg) return msg;
  }

  for (const key of ['error', 'message', 'Message'] as const) {
    const raw = obj[key];
    if (typeof raw === 'string') {
      const xmlMsg = extractMessageFromXml(raw);
      if (xmlMsg) return xmlMsg;
      if (XML_HINT_RE.test(raw)) continue;
      const s = asNonEmptyString(raw);
      if (s) return s;
    }
  }

  return undefined;
}

function applyKnownMaps(message: string): string {
  for (const entry of KNOWN_MESSAGE_MAP) {
    if (entry.match.test(message)) return entry.message;
  }
  return message;
}

/**
 * Normalize any thrown value / API string into a toast-safe message.
 */
export function toUserFacingMessage(error: unknown, fallback: string): string {
  let raw: string | undefined;

  if (typeof error === 'string') {
    raw = extractErrorFromBody(error) ?? asNonEmptyString(error);
  } else if (error instanceof Error) {
    raw = extractErrorFromBody(error.message) ?? asNonEmptyString(error.message);
  } else if (error && typeof error === 'object') {
    raw = extractErrorFromBody(error);
  }

  if (!raw) return fallback;

  // Strip common "Exotel call failed (400 …): " prefix if Message was already extracted
  const stripped = raw
    .replace(/^Exotel call failed\s*\([^)]*\):\s*/i, '')
    .trim();

  const candidate = stripped || raw;
  if (XML_HINT_RE.test(candidate) && !extractMessageFromXml(candidate)) {
    return fallback;
  }

  return applyKnownMaps(candidate);
}

/**
 * Read an error response body and return a toast-safe message.
 * Safe if body is not JSON.
 */
export async function getErrorFromResponse(
  response: Response,
  fallback: string
): Promise<string> {
  let data: unknown;
  try {
    const text = await response.text();
    if (!text) return fallback;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  } catch {
    return fallback;
  }

  const extracted = extractErrorFromBody(data);
  return toUserFacingMessage(extracted ?? data, fallback);
}
