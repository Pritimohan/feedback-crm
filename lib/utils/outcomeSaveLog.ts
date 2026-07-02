export type OutcomeSaveEvent = {
  action: 'followup_outcome' | 'connected_outcome';
  followupId: string;
  dtId?: string;
  outcome?: string;
  choice?: string;
  status: 'success' | 'conflict' | 'error';
  reason?: string;
  durationMs?: number;
  error?: string;
};

export function logOutcomeSaveEvent(event: OutcomeSaveEvent): void {
  const payload = {
    type: 'outcome_save',
    timestamp: new Date().toISOString(),
    ...event,
  };

  if (event.status === 'success') {
    console.info(JSON.stringify(payload));
    return;
  }

  console.error(JSON.stringify(payload));
}
