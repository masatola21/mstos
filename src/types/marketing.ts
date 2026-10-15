export type MarketingTrigger =
  | 'lead_created'
  | 'diagnosis_completed'
  | 'tag_added'
  | 'booking_created'
  | 'deal_won'
  | 'manual';

export type MarketingChannel = 'line' | 'email' | 'both';
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
  status: MarketingScenarioStatus;
  updatedAt: number;
}
