import { getMaxFollowupNumber, MAX_FOLLOWUP_NUMBER } from '@/lib/lifecycle/followupStageBounds';

export type LeadType = 'nps' | 'review' | 'feedback';
export type LeadActivityStatus = 'active' | 'inactive' | 'deferred';
export type NonConnectedOutcome = 'busy' | 'wrong_number' | 'not_interested' | 'no_answer';
export type ReviewConnectedChoice = 'reviewed' | 'issue_with_product' | 'interested' | 'didnt_reviewed';
export type FeedbackConnectedChoice = 'feedbacked' | 'didnt_feedback';
export type ConnectedChoice = ReviewConnectedChoice | FeedbackConnectedChoice;
export type TouchStatus =
  | 'pending'
  | 'busy'
  | 'wrong_number'
  | 'not_interested'
  | 'no_answer'
  | 'cnr'
  | 'connected';

export const NON_CONNECTED_OUTCOMES: NonConnectedOutcome[] = ['busy', 'wrong_number', 'not_interested', 'no_answer'];
export const REVIEW_CONNECTED_CHOICES: ReviewConnectedChoice[] = [
  'reviewed',
  'issue_with_product',
  'interested',
  'didnt_reviewed',
];
export const FEEDBACK_CONNECTED_CHOICES: FeedbackConnectedChoice[] = ['feedbacked', 'didnt_feedback'];
export const CONNECTED_CHOICES: ConnectedChoice[] = [...REVIEW_CONNECTED_CHOICES, ...FEEDBACK_CONNECTED_CHOICES];

export function isNonConnectedOutcome(value: string): value is NonConnectedOutcome {
  return NON_CONNECTED_OUTCOMES.includes(value as NonConnectedOutcome);
}

export function isConnectedChoice(value: string): value is ConnectedChoice {
  return CONNECTED_CHOICES.includes(value as ConnectedChoice);
}

export function isFeedbackConnectedChoice(value: string): value is FeedbackConnectedChoice {
  return FEEDBACK_CONNECTED_CHOICES.includes(value as FeedbackConnectedChoice);
}

export function canChooseInterested(followupNumber: number, leadType: LeadType = 'review'): boolean {
  return followupNumber < getMaxFollowupNumber(leadType);
}

export function getConnectedChoicesForStage(followupNumber: number, leadType: LeadType = 'review'): ConnectedChoice[] {
  if (leadType === 'feedback') {
    return ['feedbacked', 'didnt_feedback'];
  }

  if (followupNumber >= MAX_FOLLOWUP_NUMBER) {
    return ['reviewed', 'issue_with_product', 'didnt_reviewed'];
  }

  return ['reviewed', 'issue_with_product', 'interested'];
}

export interface ConnectedChoicePayload {
  review_screenshot_url?: string;
  review_remark?: string;
  is_testimonial?: boolean;
  issue_description?: string;
  interested_remark?: string;
  didnt_reviewed_remark?: string;
}

export function validateConnectedChoicePayload(params: {
  choice: ConnectedChoice;
  followupNumber: number;
  leadType?: LeadType;
  payload: ConnectedChoicePayload;
}): { valid: boolean; reason?: string } {
  const { choice, followupNumber, payload, leadType = 'review' } = params;

  if (choice === 'interested' && !canChooseInterested(followupNumber, leadType)) {
    return { valid: false, reason: 'Interested is not available on the final follow-up stage' };
  }

  if (choice === 'issue_with_product' && !payload.issue_description?.trim()) {
    return { valid: false, reason: 'Issue description is required' };
  }

  return { valid: true };
}

export interface NonConnectedTransitionResult {
  nextActivityStatus: LeadActivityStatus;
  nextTouchStatus: TouchStatus;
  terminal: boolean;
}

export function computeNonConnectedTransition(params: {
  outcome: NonConnectedOutcome;
  attemptCountAfter: number;
  maxAttempts: number;
}): NonConnectedTransitionResult {
  const { outcome, attemptCountAfter, maxAttempts } = params;

  if (outcome === 'wrong_number') {
    return { nextActivityStatus: 'deferred', nextTouchStatus: 'wrong_number', terminal: true };
  }

  if (outcome === 'not_interested') {
    return { nextActivityStatus: 'deferred', nextTouchStatus: 'not_interested', terminal: true };
  }

  if (outcome === 'busy') {
    if (attemptCountAfter >= maxAttempts) {
      return { nextActivityStatus: 'inactive', nextTouchStatus: 'busy', terminal: true };
    }
    return { nextActivityStatus: 'active', nextTouchStatus: 'busy', terminal: false };
  }

  if (attemptCountAfter >= maxAttempts) {
    return { nextActivityStatus: 'inactive', nextTouchStatus: 'cnr', terminal: true };
  }
  return { nextActivityStatus: 'active', nextTouchStatus: 'no_answer', terminal: false };
}

export interface ConnectedTransitionResult {
  nextActivityStatus: LeadActivityStatus;
  advanceStage: boolean;
}

export function computeConnectedTransition(
  choice: ConnectedChoice,
  leadType: LeadType = 'review'
): ConnectedTransitionResult {
  if (leadType === 'feedback') {
    return { nextActivityStatus: 'inactive', advanceStage: false };
  }

  switch (choice) {
    case 'interested':
      return { nextActivityStatus: 'active', advanceStage: true };
    case 'reviewed':
    case 'issue_with_product':
    case 'didnt_reviewed':
      return { nextActivityStatus: 'inactive', advanceStage: false };
    default:
      return { nextActivityStatus: 'inactive', advanceStage: false };
  }
}
