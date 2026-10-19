export type MarketingTrigger =
  | 'prospect_selected'
  | 'lead_created'
  | 'line_registered'
  | 'diagnosis_invited'
  | 'diagnosis_completed'
  | 'report_approved'
  | 'report_sent'
  | 'meeting_completed'
  | 'tag_added'
  | 'booking_created'
  | 'deal_stage_changed'
  | 'deal_won'
  | 'proposal_approved'
  | 'proposal_sent'
  | 'contract_sent'
  | 'contract_signed'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'retainer_period'
  | 'project_milestone'
  | 'manual';

export type MarketingChannel = 'line' | 'email' | 'both';
export type MarketingLineMessageType = 'text' | 'image' | 'video' | 'flex';
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
  lineVideoUrl?: string;
  lineVideoPreviewUrl?: string;
  flexAltText: string;
  flexTitle: string;
  flexBody: string;
  flexButtonLabel: string;
  flexButtonUrl: string;
  status: MarketingScenarioStatus;
  updatedAt: number;
}
