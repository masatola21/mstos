export type MarketingTrigger =
  | 'prospect_selected'
  | 'lead_created'
  | 'line_registered'
  | 'diagnosis_invited'
  | 'diagnosis_completed'
  | 'report_approved'
  | 'meeting_completed'
  | 'tag_added'
  | 'booking_created'
  | 'deal_stage_changed'
  | 'deal_won'
  | 'proposal_approved'
  | 'contract_sent'
  | 'contract_signed'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'retainer_period'
  | 'project_milestone'
  | 'manual';

export type MarketingChannel = 'line' | 'email' | 'both';
export type MarketingLineMessageType = 'text' | 'image' | 'flex';
export type MarketingScenarioStatus = 'draft' | 'prepared';

export interface MarketingScenario {
  id: string;
  name: string;
  trigger: MarketingTrigger;
  channel: MarketingChannel;
  audience: string;
  waitMinutes: number;
  emailSubject: string;
  messageBody: string;
  emailBody: string;
  lineMessageType: MarketingLineMessageType;
  lineImageUrl: string;
  linePreviewImageUrl: string;
  flexAltText: string;
  flexTitle: string;
  flexBody: string;
  flexButtonLabel: string;
  flexButtonUrl: string;
  status: MarketingScenarioStatus;
  updatedAt: number;
}
