/** Lead breakdown: fresh vs rescheduled */
export interface LeadBreakdown {
  freshLead: number;
  rescheduledLead: number;
}

export interface CallAttemptBreakdown {
  freshLead: number;
  rescheduledLead: number;
}

export interface OutcomeBreakdown {
  freshLead: number;
  rescheduledLead: number;
}

export interface ConversionBreakdown {
  reviewed: number;
  issue_with_product: number;
  interested: number;
  didnt_reviewed: number;
  /** Connected in CRM but missing or unrecognized connected_choice. */
  unknown: number;
}

export interface AnalyticsSection {
  leads: number;
  leadBreakdown?: LeadBreakdown;
  /** Unique lead-days (IST): one per lead per calendar day, last attempt wins for disposition splits. */
  attempted: number;
  /** Raw attempt rows in range for this stage. */
  totalDials: number;
  callAttemptBreakdown: CallAttemptBreakdown;
  /** CRM connected leads in range (sum of conversionBreakdown). */
  connected: number;
  /** Unique lead-days with dial outcome connected (not shown in stage comparison). */
  connectedAttempts?: number;
  connectedBreakdown?: OutcomeBreakdown;
  callLater: number;
  callLaterBreakdown?: OutcomeBreakdown;
  cnrBusyFailedWrongNumber: number;
  failedBreakdown?: OutcomeBreakdown;
  connectedPercentage: number;
  /** Reviewed connected choices in range (conversion KPI). */
  converted: number;
  conversionBreakdown?: ConversionBreakdown;
}

export interface FunnelSummary {
  totalLeads: number;
  newLeads: number;
  rescheduledLeads: number;
  /** Unique customer-days (IST). */
  attempted: number;
  /** Raw attempt rows in range. */
  totalDials: number;
  connected: number;
  converted: number;
}

export interface AnalyticsData {
  counselling: AnalyticsSection;
  firstFollowup: AnalyticsSection;
  secondFollowup: AnalyticsSection;
  thirdFollowup: AnalyticsSection;
  funnelSummary: FunnelSummary;
  activity: {
    /** Raw attempt row count in range (all dials). */
    attempts: number;
    /** Unique customer-days (IST): max one per customer per calendar day. */
    uniqueCustomersCalled: number;
    /** Customer-days where any dial that day was connected. */
    uniqueCustomersConnected: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export type AnalyticsFilterType =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'quarter'
  | 'custom';

export interface OutcomeCountRow {
  key: string;
  label: string;
  count: number;
}

export interface OutcomesAnalytics {
  byConnectedChoice: OutcomeCountRow[];
  byAttemptOutcome: OutcomeCountRow[];
  dateRange: { startDate: string; endDate: string };
}

export interface RescheduledDueTodayByStage {
  counselling: number;
  fu1: number;
  fu2: number;
  fu3: number;
}

export interface DietitianAnalyticsRow {
  dtId: string;
  dtName: string;
  todayDue?: number;
  overdue?: number;
  newDueToday?: number;
  rescheduledDueToday?: number;
  rescheduledDueTodayByStage?: RescheduledDueTodayByStage;
  overdueDueToday?: number;
  overdueAttempted?: number;
  leads: number;
  newLeads: number;
  rescheduledLeads: number;
  /** Unique customer-days (IST): one per customer per calendar day. */
  attempted: number;
  /** Raw attempt rows logged by this agent in range. */
  totalDials: number;
  connected: number;
  /** Attempted customer-days as % of distinct leads in pool for the period. */
  attemptPct: number;
  connPct: number;
  reviewed: number;
  conversionPct: number;
  /** First call (FU0) connected lead-days — use with fu0Att as connected/attempted. */
  counselling: number;
  fu0Att: number;
  fu1Conn: number;
  fu1Att: number;
  fu2Conn: number;
  fu2Att: number;
  fu3Conn: number;
  fu3Att: number;
  unreachablePct: number;
  tToCallHours: number;
}

export interface TransactionRow {
  customerName: string;
  dietitianName: string;
  stage: string;
  attempted: boolean;
  connected: boolean;
  outcome: string;
  timeToCall: string;
}

/** Reviewed conversion attributed to the agent's connected attempt. */
export interface AgentReviewedRow {
  attemptId: string;
  leadId: string;
  customerName: string;
  phone: string;
  stage: string;
  connectedAt: string;
  attemptAt: string;
}

export interface PipelineAnalytics {
  cohortPipeline?: { label: string; count: number; potential: number }[];
  adherenceDistribution?: number[];
  alerts?: { type: 'red' | 'amber' | 'green'; title: string; sub: string }[];
  forecast?: number[];
}
