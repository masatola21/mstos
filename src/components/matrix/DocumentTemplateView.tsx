import React, { useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabaseClient';
import { todayJst } from '../../utils/date';
import { 
  FileText, 
  FileCheck2, 
  Receipt, 
  ClipboardCheck, 
  Printer, 
  Copy, 
  Check, 
  Sliders, 
  Edit3, 
  Save, 
  RefreshCw,
  FileCode
} from 'lucide-react';

export type DocTemplateType = 'contract' | 'proposal' | 'invoice' | 'report';

const addOneMonthDate = (date = todayJst()) => {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
};
const invoiceDueDate = (date = todayJst()) => {
  const [year, month, day] = date.split('-').map(Number);
  const due = new Date(Date.UTC(year, month - 1, day >= 25 ? 1 : 25));
  if (day >= 25) due.setUTCMonth(due.getUTCMonth() + 1);
  if (day >= 25) due.setUTCDate(25);
  return due.toISOString().slice(0, 10);
};
const formatDocumentDate = (value: string) => value ? value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') : '';
const formatDocumentValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatDocumentValue).filter(Boolean).join(' / ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directText = formatDocumentValue(record.title || record.description || record.text || '');
    return directText || Object.values(record).map(formatDocumentValue).filter(Boolean).join(' / ');
  }
  return '';
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => { const replacements: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }; return replacements[char] || char; });

interface DocTemplate {
  id: string;
  type: DocTemplateType;
  title: string;
  description: string;
  htmlContent: string;
  variables: { key: string; label: string; defaultValue: string }[];
}

const DEFAULT_TEMPLATES: DocTemplate[] = [
  {
    id: 'tpl-contract-01',
    type: 'contract',
    title: '業務委託基本契約書 (標準ひな形)',
    description: 'システム開発およびコンサルティング業務に関する標準契約書ひな形',
    htmlContent: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.8;">
  <h1 style="text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">業務委託基本契約書</h1>
  
  <p>発注者である <strong>{{client_company}}</strong>（以下「甲」という。）と、受注者である <strong>{{my_company}}</strong>（以下「乙」という。）は、以下の通り業務委託基本契約（以下「本契約」という。）を締結する。</p>

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第1条（目的および委託業務）</h3>
  <p>甲は、乙に対し、<strong>{{project_name}}</strong>に関する業務（以下「本件業務」という。）を委託し、乙はこれを受託する。</p>

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第2条（委託料および支払方法）</h3>
  <p>本件業務の委託料総額は、金 <strong>{{total_amount}}</strong> 円（消費税込み 金 {{tax_amount}} 円）とする。<br>
  支払条件：{{payment_terms}}</p>

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第3条（契約期間）</h3>
  <p>本契約の有効期間は <strong>{{start_date}}</strong> からとする。終了日を定める場合は <strong>{{end_date}}</strong> とし、定めない場合は個別業務の実施期間・納期を発注書等で定める。</p>

  <div style="margin-top: 50px; display: flex; justify-content: space-between;">
    <div style="width: 45%;">
      <p><strong>発注者（甲）</strong></p>
      <p>住所: {{client_address}}</p>
      <p>会社名: {{client_company}}</p>
      <p>代表者: {{client_rep}} 印</p>
    </div>
    <div style="width: 45%;">
      <p><strong>受注者（乙）</strong></p>
      <p>住所: {{my_address}}</p>
      <p>会社名: {{my_company}}</p>
      <p>代表者: {{my_rep}} 印</p>
    </div>
  </div>
</div>`,
    variables: [
      { key: 'client_company', label: '顧客会社名 (甲)', defaultValue: '' },
      { key: 'my_company', label: '自社会社名 (乙)', defaultValue: '' },
      { key: 'project_name', label: 'プロジェクト名', defaultValue: '' },
      { key: 'total_amount', label: '委託料総額 (円)', defaultValue: '' },
      { key: 'tax_amount', label: '消費税額 (円)', defaultValue: '' },
      { key: 'payment_terms', label: '支払条件', defaultValue: '' },
      { key: 'start_date', label: '契約開始日', defaultValue: '' },
      { key: 'end_date', label: '契約終了日（任意・期間を定める場合のみ）', defaultValue: '' },
      { key: 'client_address', label: '甲 住所', defaultValue: '' },
      { key: 'client_rep', label: '甲 代表者名', defaultValue: '' },
      { key: 'my_address', label: '乙 住所', defaultValue: '' },
      { key: 'my_rep', label: '乙 代表者名', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-proposal-01',
    type: 'proposal',
    title: 'AI経営変革 提案書 (標準ひな形)',
    description: 'クライアント向け課題解決型システム・顧問支援の提案書ひな形',
    htmlContent: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.8;">
  <div style="background: #0f172a; color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
    <p style="font-size: 14px; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Business Proposal</p>
    <h1 style="font-size: 24px; margin: 0; font-weight: 700;">{{proposal_title}}</h1>
    <p style="margin-top: 10px; color: #94a3b8; font-size: 14px;">宛先: {{client_company}} 御中 / 提案日: {{issue_date}}</p>
  </div>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; margin-top: 20px;">1. 現状の課題と経営インパクト</h3>
  <p>{{current_challenge}}</p>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; margin-top: 20px;">2. 提案ソリューション・システム概要</h3>
  <p>{{solution_overview}}</p>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; margin-top: 20px;">3. 期待される導入効果</h3>
  <p>{{expected_outcome}}</p>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; margin-top: 20px;">4. 費用お見積もり</h3>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-top: 10px;">
    <p style="margin: 0; font-size: 16px;"><strong>総額: {{total_amount}} 円（税別）</strong></p>
    <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">内訳: {{cost_breakdown}}</p>
  </div>

  <div style="margin-top: 40px; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 20px;">
    <p><strong>提案責任者:</strong> {{sender_name}}</p>
    <p style="color: #64748b; font-size: 13px;">{{sender_company}}</p>
    <p style="color: #64748b; font-size: 13px;">{{sender_address}}</p>
    <p style="color: #64748b; font-size: 13px;">代表取締役 {{sender_rep}}</p>
  </div>
</div>`,
    variables: [
      { key: 'proposal_title', label: '提案書タイトル', defaultValue: '' },
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'issue_date', label: '提案日付', defaultValue: '' },
      { key: 'current_challenge', label: '現状の課題', defaultValue: '' },
      { key: 'solution_overview', label: '提案ソリューション', defaultValue: '' },
      { key: 'expected_outcome', label: '期待される効果', defaultValue: '' },
      { key: 'total_amount', label: 'お見積もり総額 (円)', defaultValue: '' },
      { key: 'cost_breakdown', label: '費用内訳', defaultValue: '' },
      { key: 'sender_name', label: '提案責任者名', defaultValue: '' },
      { key: 'sender_company', label: '提案者組織名', defaultValue: '' },
      { key: 'sender_address', label: '提案者住所', defaultValue: '' },
      { key: 'sender_rep', label: '代表取締役', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-invoice-01',
    type: 'invoice',
    title: 'ご請求書 (標準ひな形)',
    description: '企業間取引・お仕事の請求書ひな形',
    htmlContent: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6;">
  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px;">
    <div>
      <h1 style="font-size: 26px; margin: 0; color: #0f172a;">御 請求 書</h1>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">請求書番号: {{invoice_number}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0; font-weight: bold;">発行日: {{issue_date}}</p>
      <p style="margin: 5px 0 0 0; color: #dc2626; font-weight: bold;">お支払い期限: {{due_date}}</p>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;">{{client_company}} 御中</h2>
    <p>平素は格別のお引き立てを賜り、厚く御礼申し上げます。<br>下記の通りご請求申し上げます。</p>
    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 15px;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">ご請求金額合計（税込）</p>
      <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #0f172a;">￥{{total_amount}}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
    <thead>
      <tr style="background: #0f172a; color: white;">
        <th style="padding: 10px; text-align: left;">摘要 / 品名</th>
        <th style="padding: 10px; text-align: center;">数量</th>
        <th style="padding: 10px; text-align: right;">単価 (円)</th>
        <th style="padding: 10px; text-align: right;">金額 (円)</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 10px;">{{item_name_1}}</td>
        <td style="padding: 12px 10px; text-align: center;">{{item_qty_1}}</td>
        <td style="padding: 12px 10px; text-align: right;">{{item_price_1}}</td>
        <td style="padding: 12px 10px; text-align: right;">{{item_amount_1}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 10px;">{{item_name_2}}</td>
        <td style="padding: 12px 10px; text-align: center;">{{item_qty_2}}</td>
        <td style="padding: 12px 10px; text-align: right;">{{item_price_2}}</td>
        <td style="padding: 12px 10px; text-align: right;">{{item_amount_2}}</td>
      </tr>
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
    <div style="width: 300px; font-size: 14px;">
      <div style="display: flex; justify-content: space-between; padding: 5px 0;">
        <span>小計:</span>
        <span>￥{{subtotal_amount}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0;">
        <span>消費税 (10%):</span>
        <span>￥{{tax_amount}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: bold; font-size: 16px;">
        <span>合計金額:</span>
        <span>￥{{total_amount}}</span>
      </div>
    </div>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #64748b;">
    <p><strong>【お振込先】</strong> {{bank_account_info}}</p>
    <p>※誠に恐れ入りますが、振込手数料は貴社ご負担にてお願い申し上げます。</p>
  </div>
</div>`,
    variables: [
      { key: 'invoice_number', label: '請求書番号', defaultValue: '' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
      { key: 'due_date', label: 'お支払い期限', defaultValue: '' },
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'total_amount', label: '合計金額 (税込)', defaultValue: '' },
      { key: 'subtotal_amount', label: '小計 (税抜)', defaultValue: '' },
      { key: 'tax_amount', label: '消費税額 (10%)', defaultValue: '' },
      { key: 'item_name_1', label: '品名 1', defaultValue: '' },
      { key: 'item_qty_1', label: '数量 1', defaultValue: '' },
      { key: 'item_price_1', label: '単価 1', defaultValue: '' },
      { key: 'item_amount_1', label: '金額 1', defaultValue: '' },
      { key: 'item_name_2', label: '品名 2', defaultValue: '' },
      { key: 'item_qty_2', label: '数量 2', defaultValue: '' },
      { key: 'item_price_2', label: '単価 2', defaultValue: '' },
      { key: 'item_amount_2', label: '金額 2', defaultValue: '' },
      { key: 'bank_account_info', label: '振込先口座情報', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-report-01',
    type: 'report',
    title: '経営診断レポート (標準ひな形)',
    description: '企業向け経営体力・デジタル化診断レポートのひな形',
    htmlContent: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.8;">
  <div style="border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <p style="color: #2563eb; font-weight: bold; font-size: 13px; margin: 0; text-transform: uppercase;">Diagnostic Report</p>
      <h1 style="font-size: 24px; margin: 5px 0 0 0; color: #0f172a;">経営体力・DX推進 診断レポート</h1>
    </div>
    <div style="text-align: right; font-size: 13px; color: #64748b;">
      <p style="margin: 0;">診断対象: <strong>{{client_company}}</strong></p>
      <p style="margin: 3px 0 0 0;">実施日: {{conducted_date}}</p>
    </div>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 30px; text-align: center;">
    <p style="margin: 0; font-size: 14px; color: #64748b;">総合経営スコア</p>
    <p style="font-size: 48px; font-weight: 900; color: #2563eb; margin: 10px 0;">{{overall_score}} <span style="font-size: 20px; color: #64748b;">/ 100点</span></p>
    <p style="margin: 0; font-size: 15px; font-weight: bold; color: #0f172a;">判定ランク: {{score_rank}}（{{rank_description}}）</p>
  </div>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; margin-top: 25px;">1. カテゴリ別評価サマリー</h3>
  <ul style="padding-left: 20px; color: #334155;">
    <li style="margin-bottom: 8px;"><strong>営業・パイプライン管理:</strong> {{score_sales}}点 - {{comment_sales}}</li>
    <li style="margin-bottom: 8px;"><strong>契約・請求管理:</strong> {{score_finance}}点 - {{comment_finance}}</li>
    <li style="margin-bottom: 8px;"><strong>AI・業務自動化度:</strong> {{score_automation}}点 - {{comment_automation}}</li>
  </ul>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 8px; margin-top: 25px;">2. 優先改善提案 (Action Items)</h3>
  <p>{{action_recommendation}}</p>

  <div style="margin-top: 40px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px;">
    <p style="margin: 0; font-weight: bold; color: #1e40af;">推奨導入プロダクト: {{recommended_product}}</p>
    <p style="margin: 5px 0 0 0; font-size: 14px; color: #1e3a8a;">上記課題を迅速に解決するため、当社の専門サポートパッケージの導入を強く推奨いたします。</p>
  </div>
</div>`,
    variables: [
      { key: 'client_company', label: '診断対象企業名', defaultValue: '' },
      { key: 'conducted_date', label: '診断実施日', defaultValue: '' },
      { key: 'overall_score', label: '総合スコア (0-100)', defaultValue: '' },
      { key: 'score_rank', label: '判定ランク', defaultValue: '' },
      { key: 'rank_description', label: 'ランク解説', defaultValue: '' },
      { key: 'score_sales', label: '営業スコア', defaultValue: '' },
      { key: 'comment_sales', label: '営業コメント', defaultValue: '' },
      { key: 'score_finance', label: '財務スコア', defaultValue: '' },
      { key: 'comment_finance', label: '財務コメント', defaultValue: '' },
      { key: 'score_automation', label: '自動化スコア', defaultValue: '' },
      { key: 'comment_automation', label: '自動化コメント', defaultValue: '' },
      { key: 'action_recommendation', label: '優先改善提案', defaultValue: '' },
      { key: 'recommended_product', label: '推奨プロダクト', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-estimate-01',
    type: 'proposal',
    title: '見積書（商談情報から作成）',
    description: '診断を行わず、商談のプラン・金額だけで作成する見積書',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.8">
  <h1 style="text-align:center">御見積書</h1>
  <p>{{client_company}} 御中</p>
  <p>下記のとおりお見積り申し上げます。</p>
  <h2>{{proposal_title}}</h2>
  <table style="width:100%; border-collapse:collapse">
    <tr><th style="text-align:left;border-bottom:1px solid #94a3b8">項目</th><th style="text-align:right;border-bottom:1px solid #94a3b8">金額</th></tr>
    <tr><td style="padding:10px 0">{{project_name}}</td><td style="text-align:right">初期費用 {{initial_fee}} 円</td></tr>
    <tr><td style="padding:10px 0">月額費用</td><td style="text-align:right">{{monthly_fee}} 円</td></tr>
  </table>
  <h2 style="text-align:right">合計 {{total_amount}} 円</h2>
  <p>発行日：{{issue_date}}　有効期限：{{due_date}}</p>
  <p>※記載内容をご確認のうえ、ご不明点があればお問い合わせください。</p>
</div>`,
    variables: [
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'proposal_title', label: '見積件名', defaultValue: '' },
      { key: 'project_name', label: '提案プラン・商談名', defaultValue: '' },
      { key: 'initial_fee', label: '初期費用', defaultValue: '' },
      { key: 'monthly_fee', label: '月額費用', defaultValue: '' },
      { key: 'total_amount', label: '合計金額', defaultValue: '' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
      { key: 'due_date', label: '有効期限', defaultValue: '' },
    ],
  },
];

const templateWorkflowOrder: Record<DocTemplateType, number> = { report: 0, proposal: 1, contract: 2, invoice: 3 };
const orderTemplatesByWorkflow = (items: DocTemplate[]) => [...items].sort((a, b) => templateWorkflowOrder[a.type] - templateWorkflowOrder[b.type]);

interface DocumentTemplateViewProps { initialCompanyId?: string; initialLeadId?: string; initialDealId?: string; initialDocumentType?: DocTemplateType; }

export const DocumentTemplateView: React.FC<DocumentTemplateViewProps> = ({ initialCompanyId, initialLeadId, initialDealId, initialDocumentType }) => {
  const [templates, setTemplates] = useState<DocTemplate[]>(DEFAULT_TEMPLATES);
  const [templateStatus, setTemplateStatus] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialDocumentType === 'invoice' ? 'tpl-invoice-01' : initialDealId ? 'tpl-estimate-01' : 'tpl-report-01');
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [companies, setCompanies] = useState<Array<{id:string;company_name:string}>>([]);
  const [contacts, setContacts] = useState<Array<{id:string;full_name:string;company_id?:string|null;email?:string|null;phone?:string|null;role_title?:string|null;line_user_id?:string|null}>>([]);
  const [deals, setDeals] = useState<Array<{id:string;proposal_plan_name:string;company_id?:string|null;lead_id?:string|null}>>([]);
  const [leads, setLeads] = useState<Array<{id:string;source?:string|null;status?:string|null;company_id?:string|null}>>([]);
  const [companyId, setCompanyId] = useState(initialCompanyId || '');
  const [leadId, setLeadId] = useState(initialLeadId || '');
  const [contactId, setContactId] = useState('');
  const [dealId, setDealId] = useState(initialDealId || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [hasStartedDocument, setHasStartedDocument] = useState(Boolean(initialCompanyId || initialLeadId || initialDealId));
  const autosavedDocumentIds = useRef<Record<string, string>>({});
  const autosaveQueues = useRef<Record<string, Promise<void>>>({});

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void Promise.all([
      supabase.from('companies').select('id,company_name').order('company_name'),
      supabase.from('contacts').select('id,full_name,company_id,email,phone,role_title').order('full_name'),
      supabase.from('deals').select('id,proposal_plan_name,company_id,lead_id').order('created_at',{ascending:false}),
      supabase.from('leads').select('id,source,status,company_id').order('created_at',{ascending:false}),
    ]).then(([companyResult,contactResult,dealResult,leadResult]) => {
      const loadedCompanies = companyResult.data || [];
      const loadedContacts = contactResult.data || [];
      const loadedDeals = dealResult.data || [];
      const loadedLeads = leadResult.data || [];
      if (!companyResult.error) setCompanies(loadedCompanies);
      if (!contactResult.error) setContacts(loadedContacts);
      if (!dealResult.error) setDeals(loadedDeals);
      if (!leadResult.error) setLeads(loadedLeads);
      if (!initialCompanyId && initialDealId) {
        const sourceDeal = loadedDeals.find((deal: { id: string; company_id?: string | null; lead_id?: string | null }) => deal.id === initialDealId);
        if (sourceDeal?.company_id) setCompanyId(sourceDeal.company_id);
        if (sourceDeal?.lead_id) setLeadId(sourceDeal.lead_id);
      } else if (!initialCompanyId && initialLeadId) {
        const sourceLead = loadedLeads.find((lead: { id: string; company_id?: string | null }) => lead.id === initialLeadId);
        if (sourceLead?.company_id) setCompanyId(sourceLead.company_id);
      }
    });
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data, error } = await supabase.from('customer_document_templates').select('*').order('created_at');
      if (error) { setTemplateStatus('テンプレート共有には最新のSupabase SQL適用が必要です。'); return; }
      if (data?.length) {
        const loadedTemplates = data.map((row:any)=>({
          id:row.template_key,
          type:row.document_type==='diagnosis_report'?'report':row.document_type,
          title:row.title,description:row.description||'',htmlContent:row.body_html||'',
          variables:Array.isArray(row.variables)?row.variables:[],
        })) as DocTemplate[];
        const loadedKeys = new Set(loadedTemplates.map((template)=>template.id));
        setTemplates(orderTemplatesByWorkflow([...loadedTemplates, ...DEFAULT_TEMPLATES.filter((template)=>!loadedKeys.has(template.id))]));
        setSelectedTemplateId(initialDocumentType ? (data.find((row:any)=>row.document_type===initialDocumentType)?.template_key || (initialDocumentType === 'invoice' ? 'tpl-invoice-01' : data[0].template_key)) : initialDealId ? 'tpl-estimate-01' : (data.find((row:any)=>row.document_type==='diagnosis_report')?.template_key || data[0].template_key));
        setTemplateStatus('テンプレートをSupabaseから読み込みました。');
        return;
      }
      const defaults=DEFAULT_TEMPLATES.map((template)=>({
        template_key:template.id,
        document_type:template.type==='report'?'diagnosis_report':template.type,
        title:template.title,description:template.description,
        body_html:template.htmlContent,variables:template.variables,
      }));
      const {data:seeded,error:seedError}=await supabase.from('customer_document_templates').insert(defaults).select('*');
      if (seedError) { setTemplateStatus('標準テンプレートを共有できませんでした。SQL・権限を確認してください。'); return; }
      if (seeded?.length) {
        const seededTemplates = seeded.map((row:any)=>({
          id:row.template_key,type:row.document_type==='diagnosis_report'?'report':row.document_type,
          title:row.title,description:row.description,htmlContent:row.body_html,
          variables:Array.isArray(row.variables)?row.variables:[],
        })) as DocTemplate[];
        setTemplates(seededTemplates);
        if (initialDocumentType) setSelectedTemplateId(seededTemplates.find((template)=>template.type===initialDocumentType)?.id || (initialDocumentType==='invoice'?'tpl-invoice-01':seededTemplates[0]?.id || ''));
      }
      setTemplateStatus('標準テンプレートをワークスペースに登録しました。');
    };
    void loadTemplates();
  }, []);


  // Pull CRM, deal, and latest diagnosis data into matching template variables.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || (!companyId && !leadId && !dealId && !contactId)) return;
    let cancelled = false;
    const populate = async () => {
      const [companyResult, leadResult, dealResult, contactResult] = await Promise.all([
        companyId ? supabase.from('companies').select('*').eq('id', companyId).maybeSingle() : Promise.resolve({data:null}),
        leadId ? supabase.from('leads').select('*').eq('id', leadId).maybeSingle() : Promise.resolve({data:null}),
        dealId ? supabase.from('deals').select('*').eq('id', dealId).maybeSingle() : Promise.resolve({data:null}),
        contactId ? supabase.from('contacts').select('*').eq('id', contactId).maybeSingle() : Promise.resolve({data:null}),
      ]);
      const lead = leadResult.data;
      const deal = dealResult.data;
      const contact = contactResult.data;
      const resolvedCompanyId = companyId || deal?.company_id || lead?.company_id || contact?.company_id || '';
      const company = companyResult.data || (resolvedCompanyId
        ? (await supabase.from('companies').select('*').eq('id', resolvedCompanyId).maybeSingle()).data
        : null);
      const customerResult = resolvedCompanyId ? await supabase.from('customers').select('contract_start_date').eq('company_id', resolvedCompanyId).maybeSingle() : { data: null };
      let diagnosis: any = null;
      if (leadId || resolvedCompanyId) {
        let diagnosisQuery = supabase.from('diagnoses').select('*').order('created_at', {ascending:false}).limit(1);
        diagnosisQuery = leadId ? diagnosisQuery.eq('lead_id', leadId) : diagnosisQuery.eq('company_id', resolvedCompanyId);
        const result = await diagnosisQuery.maybeSingle();
        diagnosis = result.data;
      }
      let report: any = null;
      if (diagnosis?.id) {
        const result = await supabase.from('ai_reports').select('*').eq('diagnosis_id', diagnosis.id).eq('is_latest', true).maybeSingle();
        report = result.data;
      }
      let productName = '';
      let product: any = null;
      if (deal?.product_id) {
        const result = await supabase.from('products').select('product_name,initial_fee,monthly_fee,description').eq('id', deal.product_id).maybeSingle();
        product = result.data;
        productName = product?.product_name || '';
      }
      if (cancelled) return;
      const score = diagnosis?.score;
      const categoryScores = diagnosis?.category_scores || {};
      const recommendations = report?.recommendations;
      const recommendationText = formatDocumentValue(recommendations);
      const challengeText = formatDocumentValue(report?.challenges);
      const today = todayJst();
      const quoteExpiry = addOneMonthDate();
      const invoiceDue = invoiceDueDate();
      const amount = Number(deal?.total_amount ?? 0);
      const initialFee = Number(deal?.initial_fee ?? product?.initial_fee ?? 0);
      const monthlyFee = Number(deal?.monthly_fee ?? product?.monthly_fee ?? 0);
      const tax = Math.round(amount / 11);
      const invoiceNumber = `INV-${today.replaceAll('-', '')}-${(deal?.id || crypto.randomUUID()).slice(0, 6).toUpperCase()}`;
      const values: Record<string, string> = {
        client_company: company?.company_name || '',
        client_name: contact?.full_name || company?.contact_name || '',
        client_address: company?.address || '',
        client_rep: contact?.role_title?.includes('代表') ? contact.full_name : '',
        start_date: customerResult.data?.contract_start_date ? formatDocumentDate(String(customerResult.data.contract_start_date).slice(0,10)) : '',
        end_date: '',
        my_company: '有限会社MST', my_address: '〒503-0981　岐阜県大垣市桧町127番地', my_rep: '大橋真人', sender_name: '大橋真人', sender_company: '有限会社MST',
        bank_account_info: 'ドコモSMTBネット銀行　法人第一支店　普通預金　2223730（口座名義：有限会社MST）',
        sender_address: '〒503-0981　岐阜県大垣市桧町127番地', sender_rep: '大橋真人',
        payment_terms: deal?.memo || '',
        solution_overview: product?.description || report?.summary || '',
        expected_outcome: recommendationText,
        cost_breakdown: [initialFee > 0 ? `初期費用 ${initialFee.toLocaleString('ja-JP')}円` : '', monthlyFee > 0 ? `月額費用 ${monthlyFee.toLocaleString('ja-JP')}円` : ''].filter(Boolean).join(' / '),
        proposal_title: deal?.proposal_plan_name || deal?.deal_name || 'お見積り',
        project_name: deal?.proposal_plan_name || deal?.deal_name || productName || 'サービス',
        total_amount: amount > 0 ? amount.toLocaleString('ja-JP') : '',
        subtotal_amount: amount > 0 ? Math.max(0, amount - tax).toLocaleString('ja-JP') : '',
        tax_amount: tax > 0 ? tax.toLocaleString('ja-JP') : '',
        initial_fee: initialFee > 0 ? initialFee.toLocaleString('ja-JP') : '',
        monthly_fee: monthlyFee > 0 ? monthlyFee.toLocaleString('ja-JP') : '',
        invoice_number: invoiceNumber,
        item_name_1: deal?.proposal_plan_name || deal?.deal_name || productName || 'サービス提供費',
        item_qty_1: '1', item_price_1: amount > 0 ? Math.max(0, amount - tax).toLocaleString('ja-JP') : '', item_amount_1: amount > 0 ? Math.max(0, amount - tax).toLocaleString('ja-JP') : '',
        item_name_2: 'なし', item_qty_2: '0', item_price_2: '', item_amount_2: '',
        issue_date: formatDocumentDate(today),
        conducted_date: formatDocumentDate(diagnosis?.conducted_at ? String(diagnosis.conducted_at).slice(0,10) : today),
        due_date: formatDocumentDate(selectedTemplateId === 'tpl-estimate-01' ? quoteExpiry : invoiceDue),
        overall_score: score == null ? '' : String(score),
        score_rank: score == null ? '' : score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
        rank_description: report?.summary || '',
        current_challenge: challengeText,
        action_recommendation: recommendationText,
        recommended_product: productName || '',
        score_sales: categoryScores.sales_marketing == null ? '' : String(categoryScores.sales_marketing),
        score_automation: categoryScores.operation == null ? '' : String(categoryScores.operation),
        comment_sales: report?.summary || '',
        comment_automation: recommendationText,
      };
      setVariableValues((prev) => ({...prev, ...values}));
    };
    void populate();
    return () => { cancelled = true; };
  }, [companyId, leadId, dealId, contactId, selectedTemplateId]);

  // Active template
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Variable inputs state
  const [variableValues, setVariableValues] = useState<Record<string, string>>(() => {
    const today = todayJst();
    const initial: Record<string, string> = {};
    (DEFAULT_TEMPLATES.find((template) => template.type === 'report') || DEFAULT_TEMPLATES[0]).variables.forEach((v) => {
      initial[v.key] = v.key === 'issue_date' || v.key === 'conducted_date' ? formatDocumentDate(today) : '';
    });
    return initial;
  });

  // Apply the saved organization profile even before the user selects a customer or deal.
  useEffect(() => {
    setVariableValues((prev) => ({
      ...prev,
      my_company: prev.my_company || '有限会社MST',
      my_address: prev.my_address || '〒503-0981　岐阜県大垣市桧町127番地',
      my_rep: prev.my_rep || '大橋真人',
      sender_name: prev.sender_name || '大橋真人',
      sender_company: prev.sender_company || '有限会社MST',
      bank_account_info: prev.bank_account_info || 'ドコモSMTBネット銀行　法人第一支店　普通預金　2223730（口座名義：有限会社MST）',
    }));
  }, [selectedTemplateId]);

  // When switching template, load its default variables
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const target = templates.find((t) => t.id === id);
    if (target) {
      const today = todayJst();
      const newVals: Record<string, string> = {};
      target.variables.forEach((v) => {
        const fallbackByKey: Record<string, string> = {
          issue_date: formatDocumentDate(today), conducted_date: formatDocumentDate(today),
          due_date: formatDocumentDate(target.id === 'tpl-estimate-01' ? addOneMonthDate() : target.type === 'invoice' ? invoiceDueDate() : ''),
          invoice_number: `INV-${today.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          item_qty_1: '1', item_price_1: '', item_amount_1: '', item_name_1: 'サービス提供費',
          item_qty_2: '0', item_price_2: '', item_amount_2: '', item_name_2: 'なし',
          total_amount: '', subtotal_amount: '', tax_amount: '', initial_fee: '', monthly_fee: '',
          my_company: '有限会社MST', my_address: '〒503-0981　岐阜県大垣市桧町127番地',
          my_rep: '大橋真人', sender_name: '大橋真人', sender_company: '有限会社MST',
          bank_account_info: 'ドコモSMTBネット銀行　法人第一支店　普通預金　2223730（口座名義：有限会社MST）',
        };
        newVals[v.key] = fallbackByKey[v.key] ?? '';
      });
      setVariableValues(newVals);
    }
    setIsEditingTemplate(false);
  };

  const handleVariableChange = (key: string, value: string) => {
    setHasStartedDocument(true);
    setVariableValues((prev) => ({ ...prev, [key]: value }));
  };

  // Perform deterministic template auto-population
  const missingVariables = currentTemplate.variables.filter((variable) => variable.key !== 'end_date' && !(variableValues[variable.key] || '').trim());

  const getPopulatedHtml = (): string => {
    let result = currentTemplate.htmlContent;
    if (currentTemplate.id === 'tpl-proposal-01') {
      result = result.replace('<p style="color: #64748b; font-size: 13px;">{{sender_company}}</p>', '<p style="color: #64748b; font-size: 13px;">{{sender_company}}</p><p style="color: #64748b; font-size: 13px;">{{sender_address}}</p><p style="color: #64748b; font-size: 13px;">代表取締役 {{sender_rep}}</p>');
    }
    if (currentTemplate.id === 'tpl-contract-01') {
      result = result.replace('本契約の有効期間は、<strong>{{start_date}}</strong> から <strong>{{end_date}}</strong> までとする。', '本契約の有効期間は <strong>{{start_date}}</strong> からとする。終了日を定める場合は <strong>{{end_date}}</strong> とし、定めない場合は個別業務の実施期間・納期を発注書等で定める。');
    }
    Object.entries(variableValues).forEach(([key, val]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, escapeHtml(val || ''));
    });
    return result;
  };

  const populatedHtml = getPopulatedHtml();

  useEffect(() => {
    if (!hasStartedDocument) return;
    setSaveMessage('変更を自動保存します…');
    const timer = window.setTimeout(() => {
      const templateId = currentTemplate.id;
      const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
      const payload = {
        document_type: documentType,
        title: currentTemplate.title,
        body_html: populatedHtml,
        company_id: companyId || null,
        contact_id: contactId || null,
        lead_id: leadId || null,
        deal_id: dealId || null,
      };
      const previousQueue = autosaveQueues.current[templateId] || Promise.resolve();
      const save = previousQueue.catch(() => undefined).then(async () => {
        const supabase = getSupabase();
        if (!supabase) {
          setSaveMessage('Supabase接続後に確認待ち書類として自動保存します。');
          return;
        }
        const existingId = autosavedDocumentIds.current[templateId];
        if (existingId) {
          const { data, error } = await supabase.from('customer_documents')
            .update(payload)
            .eq('id', existingId)
            .eq('status', 'awaiting_approval')
            .select('id')
            .maybeSingle();
          if (error || !data) {
            setSaveMessage(error ? `自動保存できませんでした: ${error.message}` : '確認待ち状態が解除されているため、自動更新を停止しました。');
            return;
          }
          setSaveMessage('確認待ち書類を自動更新しました。');
          return;
        }
        const { data, error } = await supabase.from('customer_documents')
          .insert({ ...payload, status: 'awaiting_approval' })
          .select('id')
          .single();
        if (error || !data?.id) {
          setSaveMessage(error ? `自動保存できませんでした: ${error.message}` : '自動保存先の書類IDを取得できませんでした。');
          return;
        }
        autosavedDocumentIds.current[templateId] = data.id;
        setSaveMessage('確認待ち書類として自動保存しました。');
      });
      autosaveQueues.current[templateId] = save;
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hasStartedDocument, currentTemplate.id, currentTemplate.title, currentTemplate.type, populatedHtml, companyId, contactId, leadId, dealId]);

  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('ポップアップがブロックされました。ブラウザの設定をご確認ください。');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${currentTemplate.title}</title>
          <style>
            body { margin: 0; padding: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${populatedHtml}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(populatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTemplateChanges = async (newHtml: string) => {
    const supabase=getSupabase();
    if(!supabase){setTemplateStatus('Supabase接続後にテンプレートを共有できます。');return;}
    const {error}=await supabase.from('customer_document_templates').update({body_html:newHtml}).eq('template_key',currentTemplate.id);
    if(error){setTemplateStatus(`テンプレートを保存できませんでした: ${error.message}`);return;}
    setTemplates((prev) => prev.map((t) => (t.id === currentTemplate.id ? { ...t, htmlContent: newHtml } : t)));
    setTemplateStatus('テンプレートを保存しました。');
    setIsEditingTemplate(false);
  };

  const [approvingAndSending, setApprovingAndSending] = useState(false);
  const [approveSendNotice, setApproveSendNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApproveAndSend = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setApproveSendNotice({ type: 'error', text: 'Supabaseに接続されていません。' });
      return;
    }

    setApprovingAndSending(true);
    setApproveSendNotice(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth.user?.id || null;

      // 1. 対象の連絡先を特定
      let targetContact = contacts.find((c) => c.id === contactId);
      if (!targetContact && companyId) {
        targetContact = contacts.find((c) => c.company_id === companyId);
      }

      const hasLine = Boolean(targetContact?.line_user_id);
      const hasEmail = Boolean(targetContact?.email);
      const channel: 'line' | 'email' = hasLine ? 'line' : 'email';
      const recipientAddress = hasLine ? targetContact?.line_user_id : targetContact?.email;

      // 2. 書類レコード（customer_documents）を承認（approved）として保存・更新
      const templateId = currentTemplate.id;
      const documentType = currentTemplate.type === 'report' ? 'diagnosis_report' : currentTemplate.type;
      const existingId = autosavedDocumentIds.current[templateId];

      const docPayload = {
        document_type: documentType,
        title: currentTemplate.title,
        body_html: populatedHtml,
        company_id: companyId || null,
        contact_id: targetContact?.id || contactId || null,
        lead_id: leadId || null,
        deal_id: dealId || null,
        status: 'approved',
      };

      let savedDocId = existingId;
      if (existingId) {
        const { error: updateDocErr } = await supabase.from('customer_documents').update(docPayload).eq('id', existingId);
        if (updateDocErr) throw updateDocErr;
      } else {
        const { data: newDoc, error: insertDocErr } = await supabase.from('customer_documents').insert(docPayload).select('id').single();
        if (insertDocErr) throw insertDocErr;
        savedDocId = newDoc?.id;
        if (savedDocId) autosavedDocumentIds.current[templateId] = savedDocId;
      }

      // 3. 契約書・請求書のステータスを連動更新
      if (currentTemplate.type === 'contract' && companyId) {
        await supabase.from('customer_contracts').update({ status: 'sent' }).eq('company_id', companyId).eq('status', 'draft');
      } else if (currentTemplate.type === 'invoice' && companyId) {
        await supabase.from('customer_invoices').update({ status: 'issued' }).eq('company_id', companyId).eq('status', 'draft');
      }

      // 4. 送信先情報がある場合、送信待ち（communication_outbox）へ登録
      if (recipientAddress && targetContact) {
        const subject = `【有限会社MST】${currentTemplate.title}のご送付`;
        const bodyText = `${targetContact.full_name || 'お客様'} 様\n\nお世話になっております。有限会社MSTの大橋真人です。\n${currentTemplate.title}をお送りいたします。ご確認のほどよろしくお願い申し上げます。\n\n--------------------------------------------------\n有限会社MST\n代表取締役: 大橋真人\n〒503-0981 岐阜県大垣市桧町127番地\n--------------------------------------------------`;
        const linePayload = {
          type: 'text',
          text: `【MST】${currentTemplate.title}のご送付\n\n${targetContact.full_name || 'お客様'} 様\nお世話になっております。有限会社MSTの大橋です。\n${currentTemplate.title}をお送りいたします。ご確認のほどよろしくお願い申し上げます。`,
        };

        const { data: outboxItem, error: outboxErr } = await supabase.from('communication_outbox').insert({
          owner_id: ownerId,
          channel,
          recipient_contact_id: targetContact.id,
          recipient_address: recipientAddress,
          subject: channel === 'email' ? subject : null,
          body_text: bodyText,
          line_message_payload: channel === 'line' ? linePayload : null,
          company_id: companyId || null,
          source_type: 'customer_document',
          source_id: savedDocId || null,
          status: 'queued',
          consent_confirmed_at: new Date().toISOString(),
          consent_basis: 'business_transaction',
        }).select('id').single();

        if (outboxErr) throw outboxErr;

        // 即時送信を試行
        if (outboxItem?.id) {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (token) {
            const sendRes = await fetch('/api/communications/send', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ outboxId: outboxItem.id }),
            }).catch(() => null);

            if (sendRes && sendRes.ok) {
              setApproveSendNotice({
                type: 'success',
                text: `✅ 書類を承認し、${targetContact.full_name || '担当者'}様宛て（${channel === 'line' ? 'LINE公式' : 'メール'}）へ即座に送信完了しました！`,
              });
              setSaveMessage('承認・送信完了');
              return;
            }
          }
        }

        setApproveSendNotice({
          type: 'success',
          text: `✅ 書類を承認し、送信待ち（Outbox）へ登録しました！送信先: ${targetContact.full_name || '担当者'}様（${channel === 'line' ? 'LINE公式' : 'メール'}）`,
        });
        setSaveMessage('承認済・送信待ち登録');
      } else {
        setApproveSendNotice({
          type: 'success',
          text: '✅ 書類を「承認済み（approved）」として保存しました。※連絡先に有効なメールまたはLINEが登録されていないため、送信用Outboxへのキューは保留されました。',
        });
        setSaveMessage('書類承認完了');
      }
    } catch (err: any) {
      setApproveSendNotice({
        type: 'error',
        text: `処理中にエラーが発生しました: ${err?.message || '不明なエラー'}`,
      });
    } finally {
      setApprovingAndSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/30">
              AIを使わない自動入力
            </span>
            <span className="text-xs text-slate-400">テンプレートに登録データを自動反映</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">書類テンプレート・PDF出力</h1>
          <p className="text-sm text-slate-400 mt-1">
            契約書、提案書、請求書、診断レポートのテンプレートに顧客・商談データを反映し、内容を確認してPDFとして印刷・保存できます。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleApproveAndSend}
            disabled={approvingAndSending}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {approvingAndSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>承認・送信処理中…</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4 text-emerald-200" />
                <span>1クリック承認＆送信依頼</span>
              </>
            )}
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>PDF印刷・プレビュー</span>
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3"><h2 className="font-semibold text-white">書類の関連先（任意）</h2><p className="mt-1 text-xs text-slate-400">会社を起点に選ぶと、担当者・リード・商談の候補が絞られます。元レコードから開いた場合は会社と起点レコードが固定されます。</p></div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-400">会社（顧客企業）<select value={companyId} disabled={Boolean(initialCompanyId || initialLeadId || initialDealId)} onChange={(e)=>{const nextCompanyId=e.target.value;if(nextCompanyId)setHasStartedDocument(true);setCompanyId(nextCompanyId);setContactId('');setLeadId('');setDealId('');}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white disabled:opacity-70"><option value="">未選択</option>{companies.map((company)=><option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label>
          <label className="text-xs text-slate-400">担当者<select value={contactId} onChange={(e)=>{const id=e.target.value;const contact=contacts.find((item)=>item.id===id);if(id)setHasStartedDocument(true);setContactId(id);if(contact?.company_id&&contact.company_id!==companyId){setCompanyId(contact.company_id);setLeadId('');setDealId('');}}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white"><option value="">未選択</option>{contacts.filter((contact)=>!companyId||contact.company_id===companyId||!contact.company_id).map((contact)=><option key={contact.id} value={contact.id}>{contact.full_name}</option>)}</select></label>
          <label className="text-xs text-slate-400">リード<select value={leadId} disabled={Boolean(initialLeadId || initialDealId)} onChange={(e)=>{const id=e.target.value;const lead=leads.find((item)=>item.id===id);if(id)setHasStartedDocument(true);setLeadId(id);if(lead?.company_id&&lead.company_id!==companyId){setCompanyId(lead.company_id);setContactId((current)=>contacts.find((item)=>item.id===current)?.company_id===lead.company_id?current:'');}setDealId((current)=>{const deal=deals.find((item)=>item.id===current);return id&&deal?.lead_id===id?current:'';});}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white disabled:opacity-70"><option value="">未選択</option>{leads.filter((lead)=>!companyId||lead.company_id===companyId||!lead.company_id).map((lead)=><option key={lead.id} value={lead.id}>{lead.source || 'リード'} · {lead.status || lead.id.slice(0,8)}</option>)}</select></label>
          <label className="text-xs text-slate-400">商談<select value={dealId} disabled={Boolean(initialDealId)} onChange={(e)=>{const id=e.target.value;const deal=deals.find((item)=>item.id===id);const linkedLead=leads.find((item)=>item.id===deal?.lead_id);if(id)setHasStartedDocument(true);setDealId(id);if(deal?.lead_id!==leadId)setLeadId(deal?.lead_id||'');const linkedCompanyId=deal?.company_id||linkedLead?.company_id;if(linkedCompanyId&&linkedCompanyId!==companyId){setCompanyId(linkedCompanyId);setContactId((current)=>contacts.find((item)=>item.id===current)?.company_id===linkedCompanyId?current:'');}}} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white disabled:opacity-70"><option value="">未選択</option>{deals.filter((deal)=>(!companyId||deal.company_id===companyId||!deal.company_id)&&(!leadId||deal.lead_id===leadId)).map((deal)=><option key={deal.id} value={deal.id}>{deal.proposal_plan_name}</option>)}</select></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-xs text-emerald-300">内容変更は自動で確認待ちに保存されます。</p>{saveMessage&&<p role="status" className="text-xs text-slate-300">{saveMessage}</p>}</div>
      </section>

      {templateStatus&&<p role="status" className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">{templateStatus}</p>}

      {/* Template Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {orderTemplatesByWorkflow(templates).map((tpl) => {
          const isSelected = tpl.id === selectedTemplateId;
          const icons = {
            contract: <FileCheck2 className="w-4 h-4 text-emerald-400" />,
            proposal: <FileText className="w-4 h-4 text-blue-400" />,
            invoice: <Receipt className="w-4 h-4 text-amber-400" />,
            report: <ClipboardCheck className="w-4 h-4 text-purple-400" />,
          };
          return (
            <button
              key={tpl.id}
              onClick={() => handleSelectTemplate(tpl.id)}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-slate-800/80">{icons[tpl.type]}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono uppercase">
                  {tpl.type}
                </span>
              </div>
              <div>
                <h3 className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {tpl.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{tpl.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Split: Left Form Inputs / Right Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form / Variable Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-sm text-white">データ流し込み変数</h2>
              </div>
              <button
                onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                  isEditingTemplate
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{isEditingTemplate ? 'フォームに戻る' : 'HTMLひな形編集'}</span>
              </button>
            </div>

            {isEditingTemplate ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  HTMLソースと変数タグ（例: <code className="text-cyan-400">{'{{variable_name}}'}</code>）を直接編集できます。
                </p>
                <textarea
                  defaultValue={currentTemplate.htmlContent}
                  id="raw-html-editor"
                  rows={18}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('raw-html-editor') as HTMLTextAreaElement;
                    if (el) handleSaveTemplateChanges(el.value);
                  }}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>ひな形HTMLを保存</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                <p className="text-xs text-slate-400">
                  顧客・商談情報と日付ルールを初期反映しています。内容を確認し、必要な箇所だけ修正してください。
                </p>
                {missingVariables.length > 0 && <div role="status" className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">自動入力できなかった項目が {missingVariables.length} 件あります。未登録の住所・自社情報・口座情報などを確認してください。<span className="mt-1 block text-amber-100/80">{missingVariables.map((variable) => variable.label).join('、')}</span></div>}
                {currentTemplate.variables.map((v) => (
                  <div key={v.key} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-300 flex items-center justify-between">
                      <span>{v.label}</span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        {`{{${v.key}}}`}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={variableValues[v.key] ?? ''}
                      onChange={(e) => handleVariableChange(v.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder={v.key === 'end_date' ? '任意（定める場合のみ入力）' : `${v.label}（未登録の場合は入力）`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>変数置換完了: 100% 確定</span>
            <button
              onClick={() => handleSelectTemplate(currentTemplate.id)}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>初期値に戻す</span>
            </button>
          </div>
        </div>

        {/* Right Live Preview Panel (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">リアルタイムプレビュー</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApproveAndSend}
                disabled={approvingAndSending}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
              >
                {approvingAndSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>送信処理中…</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-200" />
                    <span>この内容で承認して送信待ちへ登録</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCopyHtml}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピー完了!' : 'HTMLコピー'}</span>
              </button>
              <button
                onClick={handlePrintPdf}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>印刷 / PDF</span>
              </button>
            </div>
          </div>

          {approveSendNotice && (
            <div
              role="alert"
              className={`mb-3 p-3 rounded-xl border text-xs flex items-center justify-between ${
                approveSendNotice.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              }`}
            >
              <span>{approveSendNotice.text}</span>
              <button
                type="button"
                onClick={() => setApproveSendNotice(null)}
                className="ml-2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Rendered HTML Container */}
          <div className="flex-1 bg-white rounded-xl shadow-inner overflow-hidden min-h-[600px] max-h-[700px] overflow-y-auto border border-slate-700">
            <div dangerouslySetInnerHTML={{ __html: populatedHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
};
