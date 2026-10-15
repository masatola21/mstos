export type MarketingTrigger =
  | 'lead_created'
  | 'diagnosis_completed'
  | 'tag_added'
  | 'booking_created'
  | 'deal_won'
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
