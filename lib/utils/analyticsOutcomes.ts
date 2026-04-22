/** Normalize raw attempt outcomes for analytics display (badge labels). */
export function formatOutcomeForDisplay(outcome: string | null | undefined): string {
  const o = (outcome ?? '').toLowerCase();
  if (o === 'connected') return 'Connected';
  if (o === 'not_interested') return 'Not Interested';
  if (o === 'call_later' || o === 'busy') return 'Call Later';
  if (
    o === 'no_answer' ||
    o === 'wrong_number' ||
    o === 'cnr' ||
    o === 'failed' ||
    o === 'unreachable'
  ) {
    return 'Unreachable';
  }
  if (o === 'whatsapp' || o === 'moved_to_whatsapp') return '→ WhatsApp';
  return outcome?.replace(/_/g, ' ') || '—';
}

export function isConnectedOutcome(outcome: string | null | undefined): boolean {
  return (outcome ?? '').toLowerCase() === 'connected';
}
