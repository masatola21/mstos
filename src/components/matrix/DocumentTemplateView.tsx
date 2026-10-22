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
  FileCode,
  ExternalLink,
  Link2,
  Calculator,
  BarChart3
} from 'lucide-react';

export type DocTemplateType = 'contract' | 'proposal' | 'invoice' | 'report' | 'estimate' | 'monthly_report';

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
    title: '経営の仕組み化 × 利益改善 伴走ご提案書',
    description: '戦略と実行の両面から会社の可能性を広げ、次の一手を打てる経営へ導く伴走提案書',
    htmlContent: `<div style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; padding: 40px; color: #1e293b; max-width: 820px; margin: 0 auto; line-height: 1.8;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 36px; border-radius: 14px; margin-bottom: 35px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
    <p style="font-size: 13px; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px 0; font-weight: bold;">Business Improvement Proposal</p>
    <h1 style="font-size: 26px; margin: 0 0 10px 0; font-weight: 800; line-height: 1.4;">{{proposal_title}}</h1>
    <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 16px 0;">会社の可能性を広げ、経営者が次の一手を打てる経営へ</p>
    <div style="border-top: 1px solid #334155; padding-top: 14px; display: flex; justify-content: space-between; font-size: 13px; color: #94a3b8;">
      <span>宛先: <strong style="color: white;">{{client_company}}</strong> 御中</span>
      <span>提案日: {{issue_date}}</span>
    </div>
  </div>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 10px; margin: 30px 0 12px 0; color: #0f172a; font-weight: bold;">
    1. 診断結果に基づく貴社の現状課題・ボトルネック
  </h3>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
    <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.8;">{{current_challenge}}</p>
  </div>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 10px; margin: 30px 0 12px 0; color: #0f172a; font-weight: bold;">
    2. 本プランで実現する「未来」（期待される成果）
  </h3>
  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
    <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.8;">{{expected_outcome}}</p>
  </div>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 10px; margin: 30px 0 12px 0; color: #0f172a; font-weight: bold;">
    3. 具体的な支援内容と進め方（MSTアプローチ）
  </h3>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
    <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #1e3a8a;">【支援プラン概要】</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.8;">{{solution_overview}}</p>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
        <strong style="color: #2563eb;">01 課題を把握</strong><br><span style="color: #64748b; font-size: 11px;">時間ロス・原因整理</span>
      </div>
      <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
        <strong style="color: #2563eb;">02 改善策設計</strong><br><span style="color: #64748b; font-size: 11px;">優先順位・手段選定</span>
      </div>
      <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
        <strong style="color: #2563eb;">03 実行・構築</strong><br><span style="color: #64748b; font-size: 11px;">自動化・仕組み実装</span>
      </div>
      <div style="background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
        <strong style="color: #2563eb;">04 効果確認と次へ</strong><br><span style="color: #64748b; font-size: 11px;">次の改善へ継続伴走</span>
      </div>
    </div>
  </div>

  <h3 style="font-size: 18px; border-left: 4px solid #2563eb; padding-left: 10px; margin: 30px 0 12px 0; color: #0f172a; font-weight: bold;">
    4. 費用お見積もり
  </h3>
  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 22px; margin-bottom: 25px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
      <span style="font-size: 16px; font-weight: bold; color: #0f172a;">総額（税別）</span>
      <span style="font-size: 26px; font-weight: 800; color: #1e3a8a;">￥{{total_amount}} 円</span>
    </div>
    <p style="margin: 0; font-size: 13px; color: #475569;"><strong>内訳:</strong> {{cost_breakdown}}</p>
    <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">※お支払い条件: {{payment_terms}}</p>
  </div>

  <div style="margin-top: 35px; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #475569;">
    <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">提案責任者: {{sender_name}}</p>
    <p style="margin: 0 0 2px 0;">{{sender_company}}</p>
    <p style="margin: 0 0 2px 0;">{{sender_address}}</p>
    <p style="margin: 0;">代表取締役 {{sender_rep}}</p>
  </div>
</div>`,
    variables: [
      { key: 'proposal_title', label: '提案書タイトル', defaultValue: '' },
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'issue_date', label: '提案日付', defaultValue: '' },
      { key: 'current_challenge', label: '現状の課題・ボトルネック', defaultValue: '' },
      { key: 'solution_overview', label: '提案ソリューション・進め方', defaultValue: '' },
      { key: 'expected_outcome', label: '期待される未来の成果', defaultValue: '' },
      { key: 'total_amount', label: 'お見積もり総額 (円)', defaultValue: '' },
      { key: 'cost_breakdown', label: '費用内訳', defaultValue: '' },
      { key: 'payment_terms', label: '支払条件', defaultValue: '' },
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
    title: '経営の仕組み化 × 利益改善 診断レポート',
    description: 'ボトルネックを特定し、会社と経営者の未来像および継続改善ロードマップを提示するレポート',
    htmlContent: `<div style="font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', sans-serif; padding: 40px; color: #1e293b; max-width: 820px; margin: 0 auto; line-height: 1.8;">
  <div style="border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <p style="color: #2563eb; font-weight: bold; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Management Diagnostic Report</p>
      <h1 style="font-size: 26px; margin: 6px 0 0 0; color: #0f172a; font-weight: 800;">経営の仕組み化 × 利益改善 診断レポート</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">会社の可能性を広げ、経営者が次の一手を打てる経営へ</p>
    </div>
    <div style="text-align: right; font-size: 13px; color: #64748b;">
      <p style="margin: 0;">診断対象: <strong style="color: #0f172a; font-size: 15px;">{{client_company}}</strong> 御中</p>
      <p style="margin: 3px 0 0 0;">診断実施日: {{conducted_date}}</p>
      <p style="margin: 3px 0 0 0; font-size: 11px;">診断パートナー: 有限会社MST</p>
    </div>
  </div>

  <div style="background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%); border: 2px solid #fecdd3; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span style="background: #e11d48; color: white; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px;">KEY BOTTLENECK</span>
      <span style="font-size: 13px; font-weight: bold; color: #9f1239;">現在、貴社の成長・利益を止めている最優先ボトルネック</span>
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #881337; margin: 0 0 10px 0;">{{primary_bottleneck}}</h2>
    <p style="font-size: 13px; color: #4c0519; margin: 0; line-height: 1.7;">{{bottleneck_impact}}</p>
  </div>

  <h3 style="font-size: 17px; font-weight: 700; border-left: 4px solid #2563eb; padding-left: 10px; margin: 30px 0 15px 0; color: #0f172a;">
    1. ボトルネック解消後に手に入る「未来」（Before & After）
  </h3>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 25px;">
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;">
      <p style="font-weight: bold; font-size: 14px; color: #1e3a8a; margin: 0 0 8px 0;">🏢 【会社の未来】</p>
      <div style="font-size: 12px; margin-bottom: 6px; color: #dc2626;"><strong>現状（Before）:</strong> {{company_before}}</div>
      <div style="font-size: 12px; color: #059669; font-weight: bold;"><strong>改善後（After）:</strong> {{company_after}}</div>
    </div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;">
      <p style="font-weight: bold; font-size: 14px; color: #1e3a8a; margin: 0 0 8px 0;">👤 【経営者の未来】</p>
      <div style="font-size: 12px; margin-bottom: 6px; color: #dc2626;"><strong>現状（Before）:</strong> {{ceo_before}}</div>
      <div style="font-size: 12px; color: #059669; font-weight: bold;"><strong>改善後（After）:</strong> {{ceo_after}}</div>
    </div>
  </div>

  <h3 style="font-size: 17px; font-weight: 700; border-left: 4px solid #2563eb; padding-left: 10px; margin: 30px 0 15px 0; color: #0f172a;">
    2. 継続的な改善ロードマップ（ボトルネック連鎖の解消）
  </h3>
  <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0;">※経営改善は単発で終わらせず、1つのボトルネックが解消すると現れる「次の急所」を先回りして解決し続けることで利益が最大化します。</p>
  <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin-bottom: 25px; font-size: 13px; line-height: 1.8;">
    <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #cbd5e1;">
      <strong style="color: #2563eb;">Phase 1（まず着手）:</strong> {{phase1_action}}
    </div>
    <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #cbd5e1;">
      <strong style="color: #0d9488;">Phase 2（次への展開）:</strong> {{phase2_action}}
    </div>
    <div>
      <strong style="color: #7c3aed;">Phase 3（完成形・次の一手）:</strong> {{phase3_action}}
    </div>
  </div>

  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 22px; margin-top: 30px;">
    <p style="font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin: 0 0 4px 0;">RECOMMENDED SOLUTION</p>
    <h4 style="font-size: 16px; font-weight: 800; color: #1e3a8a; margin: 0 0 8px 0;">推奨伴走プラン: {{recommended_product}}</h4>
    <p style="font-size: 13px; color: #1e40af; margin: 0; line-height: 1.7;">{{action_recommendation}}</p>
  </div>
</div>`,
    variables: [
      { key: 'client_company', label: '診断対象企業名', defaultValue: '' },
      { key: 'conducted_date', label: '診断実施日', defaultValue: '' },
      { key: 'primary_bottleneck', label: '最優先ボトルネック', defaultValue: '' },
      { key: 'bottleneck_impact', label: 'ボトルネックによる経営損失・影響', defaultValue: '' },
      { key: 'company_before', label: '会社の現状 (Before)', defaultValue: '' },
      { key: 'company_after', label: '会社の改善後 (After)', defaultValue: '' },
      { key: 'ceo_before', label: '経営者の現状 (Before)', defaultValue: '' },
      { key: 'ceo_after', label: '経営者の改善後 (After)', defaultValue: '' },
      { key: 'phase1_action', label: 'Phase 1 施策', defaultValue: '' },
      { key: 'phase2_action', label: 'Phase 2 施策', defaultValue: '' },
      { key: 'phase3_action', label: 'Phase 3 施策', defaultValue: '' },
      { key: 'recommended_product', label: '推奨伴走サービス', defaultValue: '' },
      { key: 'action_recommendation', label: '推奨アクション詳細', defaultValue: '' },
    ],
  },
  {
    id: 'tpl-estimate-01',
    type: 'estimate',
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
  {
    id: 'tpl-monthly-report-01',
    type: 'monthly_report',
    title: '月次業務報告書（伴走支援レポート）',
    description: '月次の業務改善実績・成果指標・稼働削減・次月方針をまとめた報告書ひな形',
    htmlContent: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.8;">
  <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 32px; border-radius: 12px; margin-bottom: 30px;">
    <p style="font-size: 12px; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: bold;">Monthly Advisory & Implementation Report</p>
    <h1 style="font-size: 24px; margin: 0 0 10px 0; font-weight: 800;">{{report_title}}</h1>
    <p style="font-size: 13px; color: #c7d2fe; margin: 0;">対象期間: {{target_month}} ｜ 宛先: {{client_company}} 御中</p>
  </div>

  <div style="margin-bottom: 24px; padding: 20px; background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 6px;">
    <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #1e293b;">📌 今月の支援サマリー</h3>
    <p style="margin: 0; font-size: 13px; color: #475569;">{{monthly_summary}}</p>
  </div>

  <h3 style="font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 28px; color: #0f172a;">1. 主な実施実績・自動化実装</h3>
  <div style="padding: 12px 0; font-size: 13px; color: #334155; white-space: pre-wrap;">{{accomplishments}}</div>

  <h3 style="font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 28px; color: #0f172a;">2. 成果指標・創出時間（KPI）</h3>
  <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px;">
    <tr style="background: #f1f5f9;"><th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left;">指標項目</th><th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">当月実績 / 創出効果</th></tr>
    <tr><td style="padding: 10px; border: 1px solid #cbd5e1;">月間手作業削減時間</td><td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #4338ca;">{{hours_saved}} 時間</td></tr>
    <tr><td style="padding: 10px; border: 1px solid #cbd5e1;">自動化・導線KPI進捗</td><td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">{{metrics_kpi}}</td></tr>
  </table>

  <h3 style="font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 28px; color: #0f172a;">3. 次月のアクションプラン</h3>
  <div style="padding: 12px 0; font-size: 13px; color: #334155; white-space: pre-wrap;">{{next_actions}}</div>

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; display: flex; justify-content: space-between;">
    <div>発行日: {{issue_date}}</div>
    <div>{{sender_company}}　担当: {{sender_name}}</div>
  </div>
</div>`,
    variables: [
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'report_title', label: '報告書タイトル', defaultValue: '' },
      { key: 'target_month', label: '対象年月', defaultValue: '' },
      { key: 'monthly_summary', label: '当月サマリー', defaultValue: '' },
      { key: 'accomplishments', label: '主な実施実績', defaultValue: '' },
      { key: 'hours_saved', label: '月間創出時間（h）', defaultValue: '' },
      { key: 'metrics_kpi', label: 'KPI実績・成果', defaultValue: '' },
      { key: 'next_actions', label: '次月アクション', defaultValue: '' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
    ],
  },
];

const getTemplateDefaultValues = (templateId: string, today: string = todayJst()): Record<string, string> => {
  const common: Record<string, string> = {
    client_company: '株式会社サンプル',
    client_name: '山田 太郎',
    client_address: '東京都千代田区丸の内1-1-1',
    client_rep: '代表取締役 山田 太郎',
    my_company: '有限会社MST',
    my_address: '〒503-0981　岐阜県大垣市桧町127番地',
    my_rep: '大橋真人',
    sender_name: '大橋真人',
    sender_company: '有限会社MST',
    sender_address: '〒503-0981　岐阜県大垣市桧町127番地',
    sender_rep: '大橋真人',
    bank_account_info: 'ドコモSMTBネット銀行　法人第一支店　普通預金　2223730（口座名義：有限会社MST）',
    issue_date: formatDocumentDate(today),
    conducted_date: formatDocumentDate(today),
    due_date: formatDocumentDate(addOneMonthDate(today)),
  };

  if (templateId === 'tpl-report-01') {
    return {
      ...common,
      primary_bottleneck: '経営者自身の現場拘束と事務手作業の二重入力',
      bottleneck_impact: '請求・見積の手作業や顧客対応の遅れにより、月間約25時間の経営リソースが現場に奪われ、売上につながる次の一手が後回しになっています。',
      company_before: '手作業や属人化により、売上はあるのに手元に利益が残らず、仕事が特定の人に集中している',
      company_after: '業務が仕組みで回り、限られた人員でもミスなく自動連携し、売上だけでなく利益がしっかり残る会社へ',
      ceo_before: '日々の火消しや業務処理に追われ、会社の改善や戦略を考える時間が奪われている',
      ceo_after: '現場から解放され、本来向き合うべき「経営判断」「人材育成」「次の一手（新規事業）」に集中できる',
      phase1_action: '【業務・時間の急所解消】毎月の請求・見積・顧客情報の重複入力を自動化し、月20時間以上の経営時間を即座に創出',
      phase2_action: '【売上・集客の導線構築】LINE・メール・CRMを連携し、集客から問い合わせ・商談・顧客フォローが自動でつながる流れを構築',
      phase3_action: '【経営の自走化・新規事業】経営戦略・利益改善顧問の定期伴走により、新たな収益源の創出と自走組織を実現',
      recommended_product: '業務改善・IT・DX顧問 ＋ 業務自動化パッケージ',
      action_recommendation: 'まずはPhase 1の業務改善・自動化から小さく着手し、成果を確認しながら主軸の経営顧問へと展開することを推奨いたします。',
    };
  }

  if (templateId === 'tpl-proposal-01') {
    return {
      ...common,
      proposal_title: '経営の仕組み化 × 利益改善 伴走ご提案書',
      current_challenge: '売上はあるものの手元に利益が残りにくく、手作業や二重入力に時間を奪われ、改善を進めたいが日々の業務に追われて優先順位が決まらない状態です。',
      solution_overview: '経営戦略・利益改善顧問を主軸に、業務自動化（GAS・ツール連携）と集客導線（LINE・CRM連携）を組み合わせ、戦略と現場実装の両面から利益体質へ変革します。',
      expected_outcome: '現場の手作業を月20時間以上削減して利益が残る体制をつくり、経営者が現場作業から解放されて「次の一手」を選べる経営へ導きます。',
      total_amount: '350,000',
      cost_breakdown: '初期費用 150,000円（仕組み構築） / 月額費用 200,000円（継続伴走顧問）',
      payment_terms: '月末締め・翌月末日払い（銀行振込）',
    };
  }

  if (templateId === 'tpl-monthly-report-01') {
    return {
      ...common,
      report_title: '月次業務改善・伴走支援レポート',
      target_month: `${today.slice(0, 4)}年${today.slice(5, 7)}月度`,
      monthly_summary: '今月は請求書発行および顧客面談調整の自動化ラインを本番稼働させ、二重入力作業の削減を達成しました。',
      accomplishments: '・LINE友だち登録後の自動アンケート配信およびCRM連携稼働\n・請求書発行および送付ステータス自動更新の実装\n・定期経営ミーティング（月2回）の実施とボトルネックの優先順位付け',
      hours_saved: '24',
      metrics_kpi: '商談化率 18%向上 / 問い合わせ対応リードタイム 65%短縮',
      next_actions: '・次月は見直し後の業務フローにおける関係者定着状況の確認\n・定期請求の自動集計レポートの構築',
    };
  }

  return common;
};

const templateWorkflowOrder: Record<DocTemplateType, number> = { report: 0, proposal: 1, estimate: 2, contract: 3, invoice: 4, monthly_report: 5 };
const orderTemplatesByWorkflow = (items: DocTemplate[]) => [...items].sort((a, b) => templateWorkflowOrder[a.type] - templateWorkflowOrder[b.type]);

interface DocumentTemplateViewProps { initialCompanyId?: string; initialLeadId?: string; initialDealId?: string; initialDocumentType?: DocTemplateType; }

export const DocumentTemplateView: React.FC<DocumentTemplateViewProps> = ({ initialCompanyId, initialLeadId, initialDealId, initialDocumentType }) => {
  const [templates, setTemplates] = useState<DocTemplate[]>(DEFAULT_TEMPLATES);
  const [templateStatus, setTemplateStatus] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialDocumentType === 'invoice' ? 'tpl-invoice-01' : initialDealId ? 'tpl-estimate-01' : 'tpl-report-01');
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedApplyUrl, setCopiedApplyUrl] = useState<boolean>(false);
  const [companies, setCompanies] = useState<Array<{id:string;company_name:string}>>([]);
  const [contacts, setContacts] = useState<Array<{id:string;full_name:string;company_id?:string|null;email?:string|null;phone?:string|null;role_title?:string|null}>>([]);
  const [deals, setDeals] = useState<Array<{id:string;proposal_plan_name:string;company_id?:string|null;lead_id?:string|null}>>([]);
  const [leads, setLeads] = useState<Array<{id:string;source?:string|null;status?:string|null;company_id?:string|null}>>([]);
  const [companyId, setCompanyId] = useState(initialCompanyId || '');
  const [leadId, setLeadId] = useState(initialLeadId || '');
  const [contactId, setContactId] = useState('');
  const [dealId, setDealId] = useState(initialDealId || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [hasStartedDocument, setHasStartedDocument] = useState<boolean>(false);
  const [isSavingDocument, setIsSavingDocument] = useState<boolean>(false);
  const [savedDocIds, setSavedDocIds] = useState<Record<string, string>>({});
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
        // 最新コードの DEFAULT_TEMPLATES (新レポート・提案書) を常に最優先し、DB側の未更新レコードで先祖返りしないようにする
        const defaultMap = new Map(DEFAULT_TEMPLATES.map((t) => [t.id, t]));
        const loadedTemplates = data.map((row:any)=> {
          const def = defaultMap.get(row.template_key);
          if (def) return def; // 最新の雛形を優先
          return {
            id:row.template_key,
            type:row.document_type==='diagnosis_report'?'report':row.document_type,
            title:row.title,description:row.description||'',htmlContent:row.body_html||'',
            variables:Array.isArray(row.variables)?row.variables:[],
          };
        }) as DocTemplate[];
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
        primary_bottleneck: challengeText || '経営者自身の現場拘束と事務手作業の二重入力',
        bottleneck_impact: report?.summary || '請求・見積の手作業や顧客対応の遅れにより、月間約25時間の経営リソースが現場に奪われ、売上につながる次の一手が後回しになっています。',
        company_before: '手作業や属人化により、売上はあるのに手元に利益が残らず、仕事が特定の人に集中している',
        company_after: '業務が仕組みで回り、限られた人員でもミスなく自動連携し、売上だけでなく利益がしっかり残る会社へ',
        ceo_before: '日々の火消しや業務処理に追われ、会社の改善や戦略を考える時間が奪われている',
        ceo_after: '現場から解放され、本来向き合うべき「経営判断」「人材育成」「次の一手（新規事業）」に集中できる',
        phase1_action: '【業務・時間の急所解消】毎月の請求・見積・顧客情報の重複入力を自動化し、月20時間以上の経営時間を即座に創出',
        phase2_action: '【売上・集客の導線構築】LINE・メール・CRMを連携し、集客から問い合わせ・商談・顧客フォローが自動でつながる流れを構築',
        phase3_action: '【経営の自走化・新規事業】経営戦略・利益改善顧問の定期伴走により、新たな収益源の創出と自走組織を実現',
        current_challenge: challengeText || '手作業や二重入力に時間を奪われ、改善を着手したいが日々の業務に追われて優先順位が決まらない状態です。',
        solution_overview: product?.description || '経営戦略・利益改善顧問および業務自動化パッケージにより、手作業の撲滅と利益の残る仕組み化を同時に進めます。',
        expected_outcome: recommendationText || '現場の手作業が自動化され、月20時間以上の余白を創出。経営者が次の一手を選べる経営体質へ変革します。',
        action_recommendation: recommendationText || 'まずはPhase 1の業務改善・自動化から小さく着手し、成果を確認しながら主軸の経営顧問へと展開することを推奨いたします。',
        recommended_product: productName || '業務改善・IT・DX顧問 ＋ 業務自動化パッケージ',
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
    const activeId = initialDocumentType === 'invoice' ? 'tpl-invoice-01' : initialDealId ? 'tpl-estimate-01' : 'tpl-report-01';
    return getTemplateDefaultValues(activeId, today);
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
    const today = todayJst();
    const defaults = getTemplateDefaultValues(id, today);
    setVariableValues((prev) => ({
      ...defaults,
      ...prev,
      ...defaults,
      client_company: prev.client_company || defaults.client_company || '',
      issue_date: formatDocumentDate(today),
    }));
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

    const currentDocId = savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id];
    const applyUrl = currentDocId
      ? `${window.location.origin}/apply/${currentDocId}`
      : 'javascript:alert("書類の申込URLを発行中です。数秒お待ちください。");';
    result = result.replace(/{{apply_url}}/g, applyUrl);

    // 提案書または見積書の場合、末尾にWeb申込ボタンを確実に付与
    if (['proposal', 'report', 'estimate'].includes(currentTemplate.type) || currentTemplate.id === 'tpl-estimate-01') {
      if (!result.includes('web-apply-box')) {
        const ctaHtml = `<div class="web-apply-box" style="margin-top: 40px; padding: 24px; border: 2px solid #10b981; border-radius: 12px; background: #f0fdf4; text-align: center;">
  <p style="font-weight: bold; font-size: 16px; color: #065f46; margin: 0 0 6px 0;">【Web申込・オンライン即時成約】</p>
  <p style="font-size: 13px; color: #047857; margin: 0 0 16px 0;">上記のお見積・提案内容にご承諾いただける場合は、Web上でワンタップで申し込み・ご成約いただけます。</p>
  <a href="${applyUrl}" ${currentDocId ? 'target="_blank" rel="noopener noreferrer"' : ''} style="display: inline-block; background: #059669; color: #ffffff; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 15px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.3);">👉 この内容で申し込む</a>
</div>`;
        const lastDivIndex = result.lastIndexOf('</div>');
        if (lastDivIndex !== -1) {
          result = result.slice(0, lastDivIndex) + ctaHtml + '\n</div>' + result.slice(lastDivIndex + 6);
        }
      }
    }

    return result;
  };

  const populatedHtml = getPopulatedHtml();

  useEffect(() => {
    const templateId = currentTemplate.id;
    const existingId = autosavedDocumentIds.current[templateId];
    // 手動で保存したことがある書類のみ、入力内容の変更を自動更新（勝手に新規作成しない）
    if (!hasStartedDocument || !existingId) return;

    setSaveMessage('変更内容を更新中…');
    const timer = window.setTimeout(() => {
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
        if (!supabase) return;
        const { data, error } = await supabase.from('customer_documents')
          .update(payload)
          .eq('id', existingId)
          .eq('status', 'awaiting_approval')
          .select('id')
          .maybeSingle();
        if (!error && data) {
          setSaveMessage('保存済み書類の内容を自動更新しました。');
        }
      });
      autosaveQueues.current[templateId] = save;
    }, 800);
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

  const handleManualSave = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setSaveMessage('Supabase接続後に確認待ち書類として保存できます。');
      return;
    }
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
    setIsSavingDocument(true);
    setSaveMessage('書類を保存しています…');
    try {
      const existingId = autosavedDocumentIds.current[templateId];
      if (existingId) {
        const { error } = await supabase.from('customer_documents')
          .update(payload)
          .eq('id', existingId);
        if (error) throw error;
        setSavedDocIds((prev) => ({ ...prev, [templateId]: existingId }));
        setSaveMessage('確認待ち書類を更新しました。');
      } else {
        const { data, error } = await supabase.from('customer_documents')
          .insert({ ...payload, status: 'awaiting_approval' })
          .select('id')
          .single();
        if (error || !data?.id) throw error || new Error('書類IDを取得できませんでした。');
        autosavedDocumentIds.current[templateId] = data.id;
        setSavedDocIds((prev) => ({ ...prev, [templateId]: data.id }));
        setHasStartedDocument(true);
        setSaveMessage('確認待ち書類として保存しました。');
      }
    } catch (e: any) {
      setSaveMessage(`保存できませんでした: ${e?.message || 'エラーが発生しました'}`);
    } finally {
      setIsSavingDocument(false);
    }
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

        <div className="flex flex-wrap items-center gap-2.5">
          {(savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]) && (
            <>
              <button
                type="button"
                onClick={() => {
                  const docId = savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id];
                  if (!docId) return;
                  const url = `${window.location.origin}/apply/${docId}`;
                  navigator.clipboard.writeText(url);
                  setCopiedApplyUrl(true);
                  setTimeout(() => setCopiedApplyUrl(false), 2500);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                title="顧客に送信するワンタップ申込用URLをコピーします"
              >
                <Link2 className="w-4 h-4" />
                <span>{copiedApplyUrl ? '申込URLをコピーしました！' : 'Web申込URLをコピー'}</span>
              </button>

              <a
                href={`/apply/${savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all"
                title="顧客向けWeb申込画面を別タブでプレビュー確認します"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">申込画面を開く</span>
              </a>
            </>
          )}

          <button
            type="button"
            onClick={handleManualSave}
            disabled={isSavingDocument}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            title="現在の内容で確認待ち書類として保存します"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingDocument ? '保存中…' : (savedDocIds[currentTemplate.id] || autosavedDocumentIds.current[currentTemplate.id]) ? '書類を上書き保存' : '確認待ちとして保存'}</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {orderTemplatesByWorkflow(templates).map((tpl) => {
          const isSelected = tpl.id === selectedTemplateId;
          const icons: Record<DocTemplateType, React.ReactNode> = {
            contract: <FileCheck2 className="w-4 h-4 text-emerald-400" />,
            proposal: <FileText className="w-4 h-4 text-blue-400" />,
            estimate: <Calculator className="w-4 h-4 text-cyan-400" />,
            invoice: <Receipt className="w-4 h-4 text-amber-400" />,
            report: <ClipboardCheck className="w-4 h-4 text-purple-400" />,
            monthly_report: <BarChart3 className="w-4 h-4 text-indigo-400" />,
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
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">リアルタイムプレビュー</h2>
            </div>
            <div className="flex items-center gap-2">
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

          {/* Rendered HTML Container */}
          <div className="flex-1 bg-white rounded-xl shadow-inner overflow-hidden min-h-[600px] max-h-[700px] overflow-y-auto border border-slate-700">
            <div dangerouslySetInnerHTML={{ __html: populatedHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
};
