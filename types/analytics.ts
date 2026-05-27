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
  dont_reviewed: number;
}

export interface AnalyticsSection {
  leads: number;
  leadBreakdown?: LeadBreakdown;
  attempted: number;
  callAttemptBreakdown: CallAttemptBreakdown;
  connected: number;
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
  attempted: number;
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
    attempts: number;
    uniqueCustomersCalled: number;
    uniqueCustomersConnected: number;
    /** Distinct leads with at least one attempt in range (FeedbackCRM-specific). */
    uniqueLeadsTouched: number;
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
  attempted: number;
  connected: number;
  connPct: number;
  reviewed: number;
  conversionPct: number;
  counselling: number;
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

export interface PipelineAnalytics {
  cohortPipeline?: { label: string; count: number; potential: number }[];
  adherenceDistribution?: number[];
  alerts?: { type: 'red' | 'amber' | 'green'; title: string; sub: string }[];
  forecast?: number[];
}
