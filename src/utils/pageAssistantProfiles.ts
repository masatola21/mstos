import { AIWorkModeId } from '../data/aiWorkModes';

export type PageAssistantProfile = { label: string; mode: AIWorkModeId };

export const getPageAssistantProfile = (pageId: string): PageAssistantProfile => {
  if (pageId === 'marketing_automation' || pageId === 'ai_acquisition') return { label: 'マーケティング', mode: 'marketing_execution' };
  if (pageId === 'mst_diagnoses') return { label: '診断・提案', mode: 'diagnosis' };
  if (pageId === 'product_hub' || pageId === 'category_hub') return { label: '商品設計', mode: 'new_product' };
  if (pageId === 'communication_send') return { label: '配信・顧客フォロー', mode: 'marketing_execution' };
  if (['invoices', 'contracts', 'customer_invoices', 'customer_contracts'].includes(pageId)) return { label: '契約・請求管理', mode: 'billing_operations' };
  if (pageId === 'customer_operations' || ['contacts', 'companies', 'leads', 'deals', 'customers', 'prospects', 'deal_invitations'].includes(pageId)) return { label: '営業・顧客管理', mode: 'sales_operations' };
  if (pageId === 'ai_projects' || pageId === 'ai_tasks' || pageId === 'automations') return { label: 'プロジェクト・業務改善', mode: 'operations_management' };
  return { label: '経営OS全体', mode: 'president' };
};
