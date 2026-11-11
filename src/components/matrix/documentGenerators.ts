import { 
  todayJst 
} from '../../utils/date';
import {
  getEndOfNextMonthDate,
  getOneMonthLaterDate,
  calculateMilestoneAmounts,
  calculateInstallmentAmounts,
} from '../../utils/billingUtils';

export type DocTemplateType = 'contract' | 'proposal' | 'invoice' | 'report' | 'estimate' | 'monthly_report';
export type PaymentMode = 'lump_sum' | 'retainer' | 'milestone' | 'installments_3' | 'installments_6' | 'hybrid_setup_retainer';
export type InvoiceSubtype = 'lump_sum' | 'retainer' | 'deposit' | 'completion' | 'installment' | 'hybrid_setup_retainer';

export interface DocTemplate {
  id: string;
  type: DocTemplateType;
  stepNum: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  htmlContent: string;
  variables: { key: string; label: string; defaultValue: string }[];
}

const formatDocumentDate = (value: string) => value ? value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日') : '';

export function normalizeTemplateId(id?: string): string {
  if (!id) return 'tpl-proposal-report';
  if (id.includes('report') && id.includes('monthly')) return 'tpl-monthly-report-01';
  if (id.includes('report') || id.includes('proposal')) return 'tpl-proposal-report';
  if (id.includes('estimate')) return 'tpl-unified-estimate';
  if (id.includes('contract')) return 'tpl-unified-contract';
  if (id.includes('invoice')) return 'tpl-unified-invoice';
  return id;
}

// 1. 提案・診断レポート統合版 HTML
export function getProposalReportHtml(): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.8;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #2563eb; padding-bottom:16px; margin-bottom:28px;">
    <div>
      <span style="background:#2563eb; color:white; font-size:11px; font-weight:bold; padding:3px 10px; border-radius:4px; letter-spacing:0.5px;">経営診断 & 業務改善ソリューション提案</span>
      <h1 style="margin:8px 0 0 0; font-size:24px; color:#0f172a; font-weight:800;">経営改善・業務自動化 提案書（診断レポート）</h1>
      <p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">案件名: {{proposal_title}}</p>
    </div>
    <div style="text-align:right; font-size:12px; color:#475569; white-space:nowrap; line-height:1.6;">
      <p style="margin:0;"><span style="color:#64748b;">発行日:</span> <strong style="color:#0f172a;">{{issue_date}}</strong></p>
      <p style="margin:3px 0 0 0; color:#1e40af; font-weight:bold;">
        <span style="color:#64748b; font-weight:normal;">有効期限:</span> {{due_date}} <span style="font-size:11px; color:#2563eb; background:#eff6ff; border:1px solid #bfdbfe; border-radius:3px; padding:1px 6px; margin-left:4px; font-weight:normal; display:inline-block;">発行日より1ヶ月間</span>
      </p>
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; margin-bottom:28px;">
    <div>
      <p style="font-size:18px; margin:0; font-weight:bold; color:#0f172a;">{{client_company}}</p>
      <p style="font-size:14px; margin:4px 0 0 0; color:#475569;">ご担当: {{client_name}} 様</p>
    </div>
    <div style="text-align:right; font-size:12px; color:#475569; line-height:1.6;">
      <p style="margin:0; font-weight:bold; color:#0f172a;">{{sender_company}}</p>
      <p style="margin:2px 0 0 0;">代表取締役 {{sender_rep}}</p>
      <p style="margin:2px 0 0 0;">{{sender_address}}</p>
    </div>
  </div>

  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:28px;">
    <h3 style="margin:0 0 10px 0; font-size:14px; color:#1e3a8a; font-weight:bold; display:flex; align-items:center; gap:6px;">
      1. 現状の経営・業務診断結果（抽出されたボトルネック）
    </h3>
    <div style="background:white; border-left:4px solid #ef4444; padding:12px 16px; border-radius:4px; margin-bottom:12px;">
      <p style="margin:0; font-size:12px; font-weight:bold; color:#991b1b;">【特定された主要課題】</p>
      <p style="margin:4px 0 0 0; font-size:13px; color:#334155;">{{current_challenge}}</p>
    </div>
    <p style="margin:0; font-size:13px; color:#475569;">
      手作業やツール間の二重入力、属人化した顧客フォローが経営者・中核メンバーの時間を圧迫しており、売上・利益を伸ばすための戦略的な意思決定時間が削られている状態です。
    </p>
  </div>

  <div style="margin-bottom:28px;">
    <h3 style="margin:0 0 12px 0; font-size:14px; color:#1e3a8a; font-weight:bold; border-left:4px solid #2563eb; padding-left:8px;">
      2. 改善ソリューション方針（仕組み化と自走化）
    </h3>
    <p style="margin:0 0 12px 0; font-size:13px; color:#334155; line-height:1.7;">
      {{solution_overview}}
    </p>
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:14px 18px;">
      <p style="margin:0; font-size:12px; font-weight:bold; color:#1e40af;">【推奨パッケージ】</p>
      <p style="margin:4px 0 0 0; font-size:15px; font-weight:bold; color:#1e3a8a;">{{recommended_product}}</p>
    </div>
  </div>

  <div style="margin-bottom:28px;">
    <h3 style="margin:0 0 14px 0; font-size:14px; color:#1e3a8a; font-weight:bold; border-left:4px solid #2563eb; padding-left:8px;">
      3. 3段階 実行ロードマップ
    </h3>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px;">
        <span style="background:#16a34a; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:3px;">Phase 1: 即効改善</span>
        <p style="margin:6px 0 0 0; font-size:13px; font-weight:bold; color:#166534;">{{phase1_action}}</p>
      </div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px;">
        <span style="background:#475569; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:3px;">Phase 2: 自動導線構築</span>
        <p style="margin:6px 0 0 0; font-size:13px; font-weight:bold; color:#334155;">{{phase2_action}}</p>
      </div>
      <div style="background:#fdf4ff; border:1px solid #f5d0fe; border-radius:8px; padding:12px 16px;">
        <span style="background:#9333ea; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:3px;">Phase 3: 経営自走化</span>
        <p style="margin:6px 0 0 0; font-size:13px; font-weight:bold; color:#86198f;">{{phase3_action}}</p>
      </div>
    </div>
  </div>

  <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px 20px; margin-bottom:28px;">
    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
      <span style="font-size:14px; font-weight:bold; color:#0f172a;">4. 概算費用お見積り</span>
      <span style="font-size:22px; font-weight:800; color:#1e3a8a;">総額 ￥{{total_amount}} 円（税込）</span>
    </div>
    <div style="font-size:12px; color:#64748b; line-height:1.6;">
      <p style="margin:0;">内訳: {{cost_breakdown}}（税抜小計 ¥{{subtotal_amount}} 円 ＋ 消費税10% ¥{{tax_amount}} 円）</p>
      <p style="margin:4px 0 0 0;">お支払い条件: 毎月末日締め翌月末日振込（一括・分割・手付相談可）</p>
    </div>
  </div>

  <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px; margin-bottom:24px;">
    <p style="margin:0; font-size:12px; font-weight:bold; color:#166534;">【期待される定量的成果】</p>
    <p style="margin:4px 0 0 0; font-size:13px; color:#14532d; font-weight:500;">{{expected_outcome}}</p>
  </div>
</div>`;
}

// 2. 御見積書（支払条件可変） HTML
export function getEstimateHtml(mode: PaymentMode): string {
  const isRetainer = mode === 'retainer';
  const isMilestone = mode === 'milestone';
  const isInstallments = mode === 'installments_3' || mode === 'installments_6';
  const isHybrid = mode === 'hybrid_setup_retainer';

  let tableContent = '';
  let highlightBanner = '';

  if (isHybrid) {
    highlightBanner = `<div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; gap:20px;">
      <div style="flex:1; border-right:1px solid #cbd5e1; padding-right:16px;">
        <span style="font-size:12px; color:#475569; font-weight:bold;">① 初期システム構築費用（一時金）</span><br>
        <span style="font-size:24px; font-weight:800; color:#1e3a8a;">￥{{initial_fee}} 円</span> <span style="font-size:11px; color:#64748b;">(税込 ¥{{initial_fee_tax_included}} 円)</span>
      </div>
      <div style="flex:1; text-align:right;">
        <span style="font-size:12px; color:#475569; font-weight:bold;">② 月額経営顧問・伴走支援（継続月額）</span><br>
        <span style="font-size:24px; font-weight:800; color:#059669;">月々 ￥{{monthly_fee}} 円</span> <span style="font-size:11px; color:#64748b;">(税込 ¥{{monthly_fee_tax_included}} 円/月)</span>
      </div>
    </div>`;

    tableContent = `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">
        <strong>{{project_name}} 初期システム構築・仕組み化導入費</strong><br>
        <span style="color:#64748b; font-size:11px;">要件定義・設計・開発構築・初期設定一式（一時金）</span>
      </td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">契約締結月の翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; white-space:nowrap;">¥{{initial_fee}} 円</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">
        <strong>{{project_name}} 月額経営改善・DX顧問支援（継続伴走）</strong><br>
        <span style="color:#64748b; font-size:11px;">月次定例・改善指導・保守運用サポート（最低6ヶ月契約・自動更新）</span>
      </td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">毎月末日締め翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; color:#059669; white-space:nowrap;">月額 ¥{{monthly_fee}} 円</td>
    </tr>`;
  } else if (isRetainer) {
    highlightBanner = `<div>
      <span style="font-size:14px; color:#475569; font-weight:bold;">月額顧問料（税込）</span><br>
      <span style="font-size:26px; font-weight:800; color:#1e3a8a;">月々 ￥{{monthly_fee}} 円</span>
    </div>
    <div style="text-align:right;">
      <span style="font-size:12px; color:#64748b; font-weight:bold;">初期構築費用（税込）</span><br>
      <span style="font-size:20px; font-weight:800; color:#059669;">￥{{initial_fee}} 円</span>
    </div>`;

    tableContent = `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">{{project_name}} 初期導入・仕組み化構築費</td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">契約締結翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; white-space:nowrap;">¥{{initial_fee}} 円</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">{{project_name}} 月額経営顧問・業務改善伴走支援</td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">毎月末日締め翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; white-space:nowrap;">月額 ¥{{monthly_fee}} 円</td>
    </tr>`;
  } else if (isMilestone) {
    highlightBanner = `<div style="display:flex; justify-content:space-between; align-items:baseline; width:100%;">
      <span style="font-size:14px; color:#475569; font-weight:bold;">御見積合計金額（税込）</span>
      <span style="font-size:28px; font-weight:800; color:#1e3a8a;">￥{{total_amount}} 円</span>
    </div>`;

    tableContent = `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">
        <strong>① 着手金（手付金 {{deposit_rate}}%）</strong><br>
        <span style="color:#64748b; font-size:11px;">{{project_name}} 構築着手時お支払い分</span>
      </td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">契約締結月の翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; white-space:nowrap;">¥{{deposit_subtotal}} 円</td>
    </tr>
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">
        <strong>② 導入後残金（検収完了時 {{completion_rate}}%）</strong><br>
        <span style="color:#64748b; font-size:11px;">システム本番稼働・納品検収後お支払い分</span>
      </td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">導入検収月の翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; white-space:nowrap;">¥{{completion_subtotal}} 円</td>
    </tr>`;
  } else if (isInstallments) {
    highlightBanner = `<div>
      <span style="font-size:14px; color:#475569; font-weight:bold;">御見積総額（税込）</span><br>
      <span style="font-size:28px; font-weight:800; color:#1e3a8a;">￥{{total_amount}} 円</span>
    </div>
    <div style="text-align:right;">
      <span style="font-size:12px; color:#64748b; font-weight:bold;">各回お支払い額（全{{installment_count}}回）</span><br>
      <span style="font-size:22px; font-weight:800; color:#059669;">月々 ￥{{installment_amount}} 円（税込）</span>
    </div>`;

    tableContent = `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">{{project_name}} 分割業務委託費（全{{installment_count}}回均等）</td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">毎月末日締め翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; color:#059669; white-space:nowrap;">¥{{installment_amount}} 円 / 回</td>
    </tr>`;
  } else {
    // lump_sum
    highlightBanner = `<div style="display:flex; justify-content:space-between; align-items:baseline; width:100%;">
      <span style="font-size:14px; color:#475569; font-weight:bold;">御見積合計金額（税込）</span>
      <span style="font-size:28px; font-weight:800; color:#1e3a8a;">￥{{total_amount}} 円</span>
    </div>`;

    tableContent = `<tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 10px;">{{project_name}} 一括業務委託費</td>
      <td style="padding:12px 10px; text-align:center; color:#2563eb; font-weight:bold; white-space:nowrap;">契約締結月の翌月末日</td>
      <td style="padding:12px 10px; text-align:right; font-weight:bold; white-space:nowrap;">¥{{subtotal_amount}} 円</td>
    </tr>`;
  }

  const totalsBox = isHybrid ? `
    <div style="width:340px; font-size:13px;">
      <div style="display:flex; justify-content:space-between; padding:3px 0;">
        <span style="color:#64748b;">初期構築費用（税抜）:</span>
        <span style="font-weight:bold;">¥{{initial_fee}} 円</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:3px 0;">
        <span style="color:#64748b;">初月顧問料（税抜）:</span>
        <span style="font-weight:bold;">¥{{monthly_fee}} 円</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-top:1px solid #cbd5e1;">
        <span style="color:#64748b;">消費税（10%）:</span>
        <span style="font-weight:bold;">¥{{tax_amount}} 円</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px; font-weight:bold; color:#0f172a; border-bottom:1px solid #cbd5e1;">
        <span>初回お支払い合計（税込）:</span>
        <span style="color:#1e3a8a;">¥{{total_amount}} 円</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:12px; color:#059669; font-weight:bold;">
        <span>2ヶ月目以降の月額費用:</span>
        <span>月々 ¥{{monthly_fee_tax_included}} 円（税込）</span>
      </div>
    </div>` : `
    <div style="width:280px; font-size:13px;">
      <div style="display:flex; justify-content:space-between; padding:4px 0;">
        <span style="color:#64748b;">小計（税抜）:</span>
        <span style="font-weight:bold;">¥{{subtotal_amount}} 円</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #cbd5e1;">
        <span style="color:#64748b;">消費税（10%）:</span>
        <span style="font-weight:bold;">¥{{tax_amount}} 円</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:15px; font-weight:bold; color:#0f172a;">
        <span>税込合計:</span>
        <span style="color:#1e3a8a;">¥{{total_amount}} 円</span>
      </div>
    </div>`;

  return `<div style="font-family: Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.8">
  <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #0f172a; padding-bottom:14px; margin-bottom:24px; gap:16px;">
    <div>
      <h1 style="margin:0; font-size:26px; color:#0f172a; font-weight:800; letter-spacing:2px;">御 見 積 書</h1>
    </div>
    <div style="text-align:right; font-size:12px; color:#475569; white-space:nowrap; line-height:1.6;">
      <p style="margin:0;"><span style="color:#64748b;">発行日:</span> <strong style="color:#0f172a;">{{issue_date}}</strong></p>
      <p style="margin:3px 0 0 0; color:#1e40af; font-weight:bold;">
        <span style="color:#64748b; font-weight:normal;">有効期限:</span> {{due_date}} <span style="font-size:11px; color:#2563eb; background:#eff6ff; border:1px solid #bfdbfe; border-radius:3px; padding:1px 6px; margin-left:4px; font-weight:normal; display:inline-block;">発行日より1ヶ月間</span>
      </p>
    </div>
  </div>
  <p style="font-size:16px; margin:0 0 16px 0;"><strong>{{client_company}}</strong> 御中</p>
  <p style="font-size:13px; color:#475569; margin:0 0 20px 0;">下記のとおりお見積り申し上げます。</p>
  
  <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px 20px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:baseline;">
    ${highlightBanner}
  </div>

  <h3 style="font-size:15px; border-left:4px solid #2563eb; padding-left:8px; margin:0 0 12px 0; color:#0f172a;">件名: {{proposal_title}}</h3>
  
  <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:13px;">
    <thead>
      <tr style="background:#0f172a; color:white;">
        <th style="padding:10px; text-align:left;">項目 / 内容</th>
        <th style="padding:10px; text-align:center; width:200px; white-space:nowrap;">お支払い期日</th>
        <th style="padding:10px; text-align:right; width:160px; white-space:nowrap;">金額（税抜）</th>
      </tr>
    </thead>
    <tbody>
      ${tableContent}
    </tbody>
  </table>

  <div style="display:flex; justify-content:flex-end; margin-bottom:30px;">
    ${totalsBox}
  </div>

  <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:12px; color:#1e40af;">
    <strong>お支払い条件:</strong> {{payment_terms}}
  </div>

  <div style="border-top:1px solid #e2e8f0; padding-top:16px; font-size:12px; color:#64748b;">
    <p style="margin:0 0 4px 0;"><strong>発行元:</strong> 有限会社MST（代表: 大橋真人）</p>
    <p style="margin:0 0 4px 0;">所在地: 〒503-0981 岐阜県大垣市桧町127番地</p>
    <p style="margin:0;">振込先: ドコモSMTBネット銀行 法人第一支店 普通 2223730（口座名義：有限会社MST）</p>
  </div>
</div>`;
}

// 3. 業務委託基本契約書（条項可変） HTML
export function getContractHtml(mode: PaymentMode): string {
  const isRetainer = mode === 'retainer';
  const isMilestone = mode === 'milestone';
  const isInstallments = mode === 'installments_3' || mode === 'installments_6';
  const isHybrid = mode === 'hybrid_setup_retainer';

  let article2Clause = '';

  if (isHybrid) {
    article2Clause = `<h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第2条（委託料および支払方法・初期構築および月額顧問）</h3>
  <p>甲は乙に対し、本件業務の対価として、以下の初期構築費用および月額顧問料を、乙の指定する銀行口座に振込送金して支払うものとする（振込手数料は甲の負担とする）。<br>
  <strong>1. 初期構築費用（スポット一時金）：</strong><br>
  金 <strong>{{initial_fee}}</strong> 円（税抜 / 消費税10% 金 {{initial_fee_tax}} 円 / 税込合計 金 {{initial_fee_tax_included}} 円）<br>
  支払期日：本契約締結月の<strong>翌月末日振込</strong><br>
  <strong>2. 月額顧問料（継続伴走支援）：</strong><br>
  月額 金 <strong>{{monthly_fee}}</strong> 円（税抜 / 消費税10% 金 {{monthly_fee_tax}} 円 / 税込月額 金 {{monthly_fee_tax_included}} 円）<br>
  支払期日：毎月末日締め、<strong>翌月末日振込</strong><br>
  <strong>3. 契約期間および自動更新：</strong><br>
  本契約の有効期間は、<strong>契約締結日より最低6ヶ月間</strong>とする。期間満了の1ヶ月前までに甲または乙から書面による別段の申し出がない限り、本契約は同一条件にて1ヶ月間自動更新され、以後も同様とする。</p>`;
  } else if (isRetainer) {
    article2Clause = `<h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第2条（顧問料および支払方法）</h3>
  <p>1. 本件業務の月額顧問料は、金 <strong>{{monthly_fee}}</strong> 円（税抜 / 消費税10% 金 {{tax_amount}} 円 / 税込合計 金 {{total_amount}} 円）とする。<br>
  2. 甲は乙に対し、毎月末日締めの翌月末日までに、乙の指定する銀行口座へ振込送金して支払うものとする。振込手数料は甲の負担とする。<br>
  3. 継続的な改善および自走組織化の観点より、<strong>契約締結日より最低6ヶ月間</strong>を最低契約期間とし、満了1ヶ月前までに申し出がない場合は同一条件で6ヶ月間自動更新とする。</p>`;
  } else if (isMilestone) {
    article2Clause = `<h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第2条（委託料および支払方法・手付残金）</h3>
  <p>本件業務の委託料総額は、金 <strong>{{subtotal_amount}}</strong> 円（税抜 / 消費税10% 金 {{tax_amount}} 円 / 税込合計 金 {{total_amount}} 円）とし、以下の2段階に分けて乙の指定口座へ振込送金して支払う。<br>
  <strong>① 着手金（手付金{{deposit_rate}}%）：</strong> 金 <strong>{{deposit_subtotal}}</strong> 円（税込 金 {{deposit_total}} 円）を本契約締結月の翌月末日までに支払う。<br>
  <strong>② 導入後残金（検収時{{completion_rate}}%）：</strong> 金 <strong>{{completion_subtotal}}</strong> 円（税込 金 {{completion_total}} 円）を本件システムの稼働および納品検収完了月の翌月末日までに支払う。<br>
  ※振込手数料は甲の負担とする。</p>`;
  } else if (isInstallments) {
    article2Clause = `<h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第2条（委託料および分割支払方法）</h3>
  <p>1. 本件業務の委託料総額は、金 <strong>{{subtotal_amount}}</strong> 円（税抜 / 消費税10% 金 {{tax_amount}} 円 / 税込合計 金 {{total_amount}} 円）とする。<br>
  2. 甲は乙に対し、<strong>全 {{installment_count}} 回の均等分割払い</strong>にて、各回 金 <strong>{{installment_amount}}</strong> 円（税込）を毎月末日までに乙の指定口座へ振込送金して支払う。<br>
  <strong>3.【期限の利益喪失条項】</strong> 甲が分割代金の支払を1回でも遅滞したときは、甲は当然に期限の利益を失い、乙に対し直ちに残代金全額を一括して支払わなければならない。<br>
  ※振込手数料は甲の負担とする。</p>`;
  } else {
    // lump_sum
    article2Clause = `<h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第2条（委託料および支払方法）</h3>
  <p>1. 本件業務の委託料は、金 <strong>{{subtotal_amount}}</strong> 円（税抜 / 消費税10% 金 {{tax_amount}} 円 / 税込合計 金 {{total_amount}} 円）とする。<br>
  2. 甲は乙に対し、本契約締結月の<strong>翌月末日までに一括</strong>にて、乙の指定する銀行口座へ振込送金して支払うものとする。振込手数料は甲の負担とする。<br>
  支払条件：{{payment_terms}}</p>`;
  }

  return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.8;">
  <h1 style="text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">業務委託基本契約書</h1>
  
  <p>発注者である <strong>{{client_company}}</strong>（以下「甲」という。）と、受注者である <strong>{{my_company}}</strong>（以下「乙」という。）は、以下の通り業務委託基本契約（以下「本契約」という。）を締結する。</p>

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第1条（目的および委託業務）</h3>
  <p>甲は、乙に対し、<strong>{{project_name}}</strong>に関する業務（以下「本件業務」という。）を委託し、乙はこれを受託する。</p>

  ${article2Clause}

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第3条（契約期間）</h3>
  <p>本契約の有効期間は <strong>{{start_date}}</strong> からとする。終了日を定める場合は <strong>{{end_date}}</strong> とし、定めない場合は個別業務の実施期間・納期を発注書等で定める。</p>

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第4条（秘密保持および信義則）</h3>
  <p>甲および乙は、本契約の履行に関して知り得た相手方の営業上・技術上の一切の秘密情報を、相手方の事前の書面による承諾なしに第三者に開示または漏洩してはならない。</p>

  <h3 style="margin-top: 20px; font-size: 16px; border-left: 4px solid #2563eb; padding-left: 8px;">第5条（管轄裁判所）</h3>
  <p>本契約に関して甲乙間に紛争が生じた場合は、乙の所在地を管轄する地方裁判所（岐阜地方裁判所大垣支部）を第一審の専属的合意管轄裁判所とする。</p>

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
</div>`;
}

// 4. 御請求書（種別・期日可変） HTML
export function getInvoiceHtml(subtype: InvoiceSubtype): string {
  let badgeText = '御請求書';
  let badgeColor = '#0f172a';
  let highlightTitle = 'ご請求金額合計（税込）';
  let highlightAmount = '{{total_amount}}';
  let itemDescription = '{{project_name}} 業務委託料';
  let subtotalAmount = '{{subtotal_amount}}';
  let taxAmount = '{{tax_amount}}';
  let totalAmount = '{{total_amount}}';
  let noteExtra = '';
  const isHybrid = subtype === 'hybrid_setup_retainer';

  if (isHybrid) {
    badgeText = '初期構築 ＋ 初月顧問料 合算';
    badgeColor = '#4f46e5';
    highlightTitle = '合算ご請求金額合計（税込）';
    highlightAmount = '{{total_amount}}';
    subtotalAmount = '{{subtotal_amount}}';
    taxAmount = '{{tax_amount}}';
    totalAmount = '{{total_amount}}';
    noteExtra = '<p>※初期システム構築費用および初月度顧問支援料の合算請求となります。<br>※2ヶ月目以降は月額顧問料（月々 ¥{{monthly_fee_tax_included}} 円 税込）のみの定期請求となります。</p>';
  } else if (subtype === 'retainer') {
    badgeText = '月額顧問料分';
    badgeColor = '#0284c7';
    itemDescription = '{{project_name}} 月額顧問料（{{billing_month}}分）';
    subtotalAmount = '{{monthly_fee}}';
  } else if (subtype === 'deposit') {
    badgeText = '着手金・手付金 50%';
    badgeColor = '#2563eb';
    highlightTitle = '着手金ご請求金額（税込）';
    highlightAmount = '{{deposit_total}}';
    itemDescription = '{{project_name}} 業務着手金（手付金 {{deposit_rate}}% 分）<br><span style="color:#64748b; font-size:12px;">委託総額 ¥{{total_project_amount}} 円の50%</span>';
    subtotalAmount = '{{deposit_subtotal}}';
    taxAmount = '{{deposit_tax}}';
    totalAmount = '{{deposit_total}}';
    noteExtra = '<p>※残金（{{completion_rate}}%）は、本番導入・検収完了後に別途ご請求申し上げます。</p>';
  } else if (subtype === 'completion') {
    badgeText = '導入完了・残金 50%';
    badgeColor = '#059669';
    highlightTitle = '残金ご請求金額（税込）';
    highlightAmount = '{{completion_total}}';
    itemDescription = '{{project_name}} 導入完了・検収後残金（{{completion_rate}}% 分）<br><span style="color:#64748b; font-size:12px;">委託総額 ¥{{total_project_amount}} 円の50%</span>';
    subtotalAmount = '{{completion_subtotal}}';
    taxAmount = '{{completion_tax}}';
    totalAmount = '{{completion_total}}';
    noteExtra = '<p>※本番稼働・納品検収の完了に伴う残金のご請求となります。</p>';
  } else if (subtype === 'installment') {
    badgeText = '分割払い';
    badgeColor = '#7c3aed';
    highlightTitle = '分割ご請求金額（税込）';
    highlightAmount = '{{installment_total}}';
    itemDescription = '{{project_name}} 分割業務委託料（第{{installment_number}}回 / 全{{installment_count}}回）';
    subtotalAmount = '{{installment_subtotal}}';
    taxAmount = '{{installment_tax}}';
    totalAmount = '{{installment_total}}';
    noteExtra = '<p>※全{{installment_count}}回中、第{{installment_number}}回目のお支払い分となります。</p>';
  }

  const tableRowsHtml = isHybrid ? `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 10px;">
        <strong>{{project_name}} 初期システム構築・導入設定費（一時金）</strong><br>
        <span style="color:#64748b; font-size:12px;">要件定義・自動化ワークフロー開発・初期設定導入分</span>
      </td>
      <td style="padding: 12px 10px; text-align: right; font-weight: bold;">¥{{initial_fee}}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 10px;">
        <strong>{{project_name}} 月額経営改善・DX顧問支援料（{{billing_month}}分）</strong><br>
        <span style="color:#64748b; font-size:12px;">定期月次定例・業務改善伴走・運用保守サポート分</span>
      </td>
      <td style="padding: 12px 10px; text-align: right; font-weight: bold; color: #059669;">¥{{monthly_fee}}</td>
    </tr>` : `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 10px;">${itemDescription}</td>
      <td style="padding: 12px 10px; text-align: right; font-weight: bold;">¥${subtotalAmount}</td>
    </tr>`;

  const breakdownBox = isHybrid ? `
    <div style="width: 320px; font-size: 13px;">
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span style="color: #64748b;">初期構築費用（税抜）:</span>
        <span style="font-weight: bold;">￥{{initial_fee}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span style="color: #64748b;">当月度顧問料（税抜）:</span>
        <span style="font-weight: bold;">￥{{monthly_fee}}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #e2e8f0;">
        <span>税抜小計:</span>
        <span>￥${subtotalAmount}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
        <span>消費税（10%）:</span>
        <span>￥${taxAmount}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: bold; font-size: 16px;">
        <span>合算ご請求金額合計:</span>
        <span style="color: #1e3a8a;">￥${totalAmount}</span>
      </div>
    </div>` : `
    <div style="width: 300px; font-size: 14px;">
      <div style="display: flex; justify-content: space-between; padding: 5px 0;">
        <span>小計（税抜）:</span>
        <span>￥${subtotalAmount}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0;">
        <span>消費税（10%）:</span>
        <span>￥${taxAmount}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: bold; font-size: 16px;">
        <span>ご請求金額合計:</span>
        <span style="color: #1e3a8a;">￥${totalAmount}</span>
      </div>
    </div>`;

  return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6;">
  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px;">
    <div>
      <span style="background: ${badgeColor}; color: white; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px;">${badgeText}</span>
      <h1 style="font-size: 26px; margin: 6px 0 0 0; color: #0f172a;">御 請 求 書</h1>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">請求書番号: {{invoice_number}}</p>
    </div>
    <div style="text-align: right; white-space: nowrap; line-height: 1.6; font-size: 12px; color: #475569;">
      <p style="margin: 0;"><span style="color: #64748b;">発行日:</span> <strong style="color: #0f172a;">{{issue_date}}</strong></p>
      <p style="margin: 3px 0 0 0; color: #dc2626; font-weight: bold;">
        <span style="color: #64748b; font-weight: normal;">お支払い期限:</span> {{due_date}} <span style="font-size: 11px; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 3px; padding: 1px 6px; margin-left: 4px; font-weight: 600; display: inline-block;">翌月末日</span>
      </p>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;">{{client_company}} 御中</h2>
    <p>平素は格別のお引き立てを賜り、厚く御礼申し上げます。<br>下記の通りご請求申し上げます。内容をご確認の上、期日までにお振込みをお願い申し上げます。</p>
    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 15px;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">${highlightTitle}</p>
      <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #1e3a8a;">￥${highlightAmount}</p>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
    <thead>
      <tr style="background: #0f172a; color: white;">
        <th style="padding: 10px; text-align: left;">品名 / 項目</th>
        <th style="padding: 10px; text-align: right;">金額（税抜）</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
    ${breakdownBox}
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #64748b;">
    <p><strong>【お振込先】</strong> {{bank_account_info}}</p>
    ${noteExtra}
    <p>※振込手数料は貴社ご負担にてお願い申し上げます。</p>
  </div>
</div>`;
}

// 5. 月次業務報告書 HTML
export function getMonthlyReportHtml(): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.8;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:24px;">
    <div>
      <span style="background:#0284c7; color:white; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:4px;">月次定例報告</span>
      <h1 style="margin:6px 0 0 0; font-size:22px; color:#0f172a;">{{report_title}}</h1>
      <p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">対象年月: {{target_month}}</p>
    </div>
    <div style="text-align:right; font-size:12px; color:#64748b;">
      <p style="margin:0;">発行日: {{issue_date}}</p>
      <p style="margin:2px 0 0 0; font-weight:bold; color:#0f172a;">有限会社MST（大橋真人）</p>
    </div>
  </div>

  <p style="font-size:16px; margin:0 0 20px 0;"><strong>{{client_company}}</strong> 御中</p>

  <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
    <h3 style="margin:0 0 8px 0; font-size:14px; color:#0369a1; font-weight:bold;">1. 当月サマリー</h3>
    <p style="margin:0; font-size:13px; color:#0c4a6e;">{{monthly_summary}}</p>
  </div>

  <div style="margin-bottom:24px;">
    <h3 style="margin:0 0 10px 0; font-size:14px; color:#0f172a; font-weight:bold; border-left:4px solid #0284c7; padding-left:8px;">2. 主な実施実績</h3>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; font-size:13px; color:#334155; white-space:pre-wrap;">{{accomplishments}}</div>
  </div>

  <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px 18px;">
      <h4 style="margin:0 0 4px 0; font-size:12px; color:#166534; font-weight:bold;">創出時間（削減効果）</h4>
      <p style="margin:0; font-size:22px; font-weight:bold; color:#15803d;">約 {{hours_saved}} 時間 / 月</p>
    </div>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px;">
      <h4 style="margin:0 0 4px 0; font-size:12px; color:#475569; font-weight:bold;">KPI・成果指標</h4>
      <p style="margin:0; font-size:13px; color:#1e293b;">{{metrics_kpi}}</p>
    </div>
  </div>

  <div style="margin-bottom:24px;">
    <h3 style="margin:0 0 10px 0; font-size:14px; color:#0f172a; font-weight:bold; border-left:4px solid #0284c7; padding-left:8px;">3. 次月アクション計画</h3>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; font-size:13px; color:#334155; white-space:pre-wrap;">{{next_actions}}</div>
  </div>

  <div style="border-top:1px solid #e2e8f0; padding-top:16px; font-size:12px; color:#64748b;">
    <p style="margin:0;">有限会社MST ｜ 〒503-0981 岐阜県大垣市桧町127番地 ｜ 代表取締役 大橋真人</p>
  </div>
</div>`;
}

export function getDynamicTemplateHtml(templateId: string, paymentMode: PaymentMode, invoiceSubtype: InvoiceSubtype): string {
  const normId = normalizeTemplateId(templateId);
  if (normId === 'tpl-proposal-report') return getProposalReportHtml();
  if (normId === 'tpl-unified-estimate') return getEstimateHtml(paymentMode);
  if (normId === 'tpl-unified-contract') return getContractHtml(paymentMode);
  if (normId === 'tpl-unified-invoice') return getInvoiceHtml(invoiceSubtype);
  if (normId === 'tpl-monthly-report-01') return getMonthlyReportHtml();
  return getEstimateHtml(paymentMode);
}

export const CORE_TEMPLATES: DocTemplate[] = [
  {
    id: 'tpl-proposal-report',
    type: 'proposal',
    stepNum: 'STEP 1',
    title: '提案・診断レポート',
    subtitle: '現状診断・課題分析・解決策・3段階ロードマップを1枚に統合',
    description: '経営診断結果と業務自動化ソリューション、費用見積、Web申込を凝縮した総合提案書',
    badge: 'レポート＋提案統合',
    htmlContent: getProposalReportHtml(),
    variables: [
      { key: 'proposal_title', label: '提案件名', defaultValue: '経営の仕組み化 × 利益改善 伴走ご提案書' },
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'client_name', label: '宛先担当者名', defaultValue: '' },
      { key: 'current_challenge', label: '現状課題・診断結果', defaultValue: '' },
      { key: 'solution_overview', label: '改善ソリューション方針', defaultValue: '' },
      { key: 'recommended_product', label: '推奨パッケージ名', defaultValue: '業務改善・IT・DX顧問 ＋ 業務自動化パッケージ' },
      { key: 'phase1_action', label: 'Phase 1 実行内容', defaultValue: '【急所解消】請求・見積・顧客情報の重複入力を自動化し月20時間創出' },
      { key: 'phase2_action', label: 'Phase 2 実行内容', defaultValue: '【自動導線】LINE・メール・CRM連携で反響から商談まで自動化' },
      { key: 'phase3_action', label: 'Phase 3 実行内容', defaultValue: '【自走化】経営戦略・利益改善顧問の定期伴走で自走組織を実現' },
      { key: 'cost_breakdown', label: '費用内訳サマリー', defaultValue: '初期費用 150,000円 / 月額費用 200,000円' },
      { key: 'subtotal_amount', label: '小計 (税抜・円)', defaultValue: '350,000' },
      { key: 'tax_amount', label: '消費税額 (10%・円)', defaultValue: '35,000' },
      { key: 'total_amount', label: '概算総額 (税込・円)', defaultValue: '385,000' },
      { key: 'expected_outcome', label: '期待される定量的成果', defaultValue: '現場の手作業を月20時間以上削減し、経営者が「次の一手」に集中できる経営体質へ変革' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
      { key: 'due_date', label: '有効期限', defaultValue: '' },
      { key: 'sender_company', label: '自社会社名', defaultValue: '有限会社MST' },
      { key: 'sender_rep', label: '代表者名', defaultValue: '大橋真人' },
      { key: 'sender_address', label: '所在地', defaultValue: '〒503-0981 岐阜県大垣市桧町127番地' },
    ],
  },
  {
    id: 'tpl-unified-estimate',
    type: 'estimate',
    stepNum: 'STEP 2',
    title: '御見積書',
    subtitle: '一括・月額顧問・手付残金・分割を内部で即時切り替え',
    description: '一括払い・月額顧問・手付残金50%・均等分割払いの条件・金額・表を内部で切り替え可能な統合御見積書',
    badge: '支払条件可変',
    htmlContent: getEstimateHtml('lump_sum'),
    variables: [
      { key: 'proposal_title', label: '見積件名', defaultValue: '業務改善・自動化システム構築 御見積書' },
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'project_name', label: '案件・プラン名', defaultValue: '業務改善・自動化システム構築' },
      { key: 'subtotal_amount', label: '小計 (税抜・円)', defaultValue: '300,000' },
      { key: 'tax_amount', label: '消費税額 (10%・円)', defaultValue: '30,000' },
      { key: 'total_amount', label: '税込合計金額 (円)', defaultValue: '330,000' },
      { key: 'payment_terms', label: '支払条件', defaultValue: '契約締結月の翌月末日振込' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
      { key: 'due_date', label: '有効期限（発行日より1ヶ月間）', defaultValue: '' },
      { key: 'initial_fee', label: '初期費用 (税抜・円)', defaultValue: '0' },
      { key: 'monthly_fee', label: '月額費用 (税抜・円)', defaultValue: '0' },
      { key: 'deposit_rate', label: '手付金比率 (%)', defaultValue: '50' },
      { key: 'deposit_subtotal', label: '手付金 (税抜・円)', defaultValue: '150,000' },
      { key: 'completion_rate', label: '残金比率 (%)', defaultValue: '50' },
      { key: 'completion_subtotal', label: '残金 (税抜・円)', defaultValue: '150,000' },
      { key: 'installment_count', label: '分割回数', defaultValue: '3' },
      { key: 'installment_amount', label: '各回支払額 (税込・円)', defaultValue: '110,000' },
    ],
  },
  {
    id: 'tpl-unified-contract',
    type: 'contract',
    stepNum: 'STEP 3',
    title: '業務委託基本契約書',
    subtitle: '一括・顧問・手付残金・分割（期限の利益喪失条項）に対応',
    description: '一括払い・月額顧問（最低6ヶ月）・手付残金50%・分割払いの契約条項を内部で即時切り替え可能な統合契約書',
    badge: '契約条項可変',
    htmlContent: getContractHtml('lump_sum'),
    variables: [
      { key: 'client_company', label: '顧客会社名 (甲)', defaultValue: '' },
      { key: 'client_rep', label: '甲 代表者名', defaultValue: '' },
      { key: 'client_address', label: '甲 住所', defaultValue: '' },
      { key: 'my_company', label: '自社会社名 (乙)', defaultValue: '有限会社MST' },
      { key: 'my_rep', label: '乙 代表者名', defaultValue: '大橋真人' },
      { key: 'my_address', label: '乙 住所', defaultValue: '〒503-0981 岐阜県大垣市桧町127番地' },
      { key: 'project_name', label: '委託業務名', defaultValue: '業務改善・自動化システム構築および伴走支援' },
      { key: 'subtotal_amount', label: '委託料小計 (税抜・円)', defaultValue: '300,000' },
      { key: 'tax_amount', label: '消費税額 (10%・円)', defaultValue: '30,000' },
      { key: 'total_amount', label: '税込委託料 (円)', defaultValue: '330,000' },
      { key: 'payment_terms', label: '支払条件', defaultValue: '契約締結月の翌月末日振込' },
      { key: 'start_date', label: '契約開始日', defaultValue: '' },
      { key: 'end_date', label: '契約終了日（任意）', defaultValue: '' },
      { key: 'monthly_fee', label: '月額顧問料 (税抜・円)', defaultValue: '100,000' },
      { key: 'deposit_rate', label: '手付金比率 (%)', defaultValue: '50' },
      { key: 'deposit_subtotal', label: '手付金小計 (税抜・円)', defaultValue: '150,000' },
      { key: 'deposit_total', label: '手付金税込 (円)', defaultValue: '165,000' },
      { key: 'completion_rate', label: '残金比率 (%)', defaultValue: '50' },
      { key: 'completion_subtotal', label: '残金小計 (税抜・円)', defaultValue: '150,000' },
      { key: 'completion_total', label: '残金税込 (円)', defaultValue: '165,000' },
      { key: 'installment_count', label: '分割回数', defaultValue: '3' },
      { key: 'installment_amount', label: '各回支払額 (税込・円)', defaultValue: '110,000' },
    ],
  },
  {
    id: 'tpl-unified-invoice',
    type: 'invoice',
    stepNum: 'STEP 4',
    title: '御請求書',
    subtitle: '通常一括・月額顧問・着手金・導入残金・分割請求に対応',
    description: '通常一括・月額顧問料・着手金50%・導入後残金50%・分割払いを内部で即時切り替え可能な統合御請求書',
    badge: '期日翌月末日統一',
    htmlContent: getInvoiceHtml('lump_sum'),
    variables: [
      { key: 'invoice_number', label: '請求書番号', defaultValue: '' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
      { key: 'due_date', label: 'お支払い期限（翌月末日）', defaultValue: '' },
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'project_name', label: '件名・プロジェクト名', defaultValue: '業務改善・自動化システム構築' },
      { key: 'bank_account_info', label: '振込先口座情報', defaultValue: 'ドコモSMTBネット銀行 法人第一支店 普通 2223730（口座名義：有限会社MST）' },
      { key: 'subtotal_amount', label: '小計 (税抜・円)', defaultValue: '300,000' },
      { key: 'tax_amount', label: '消費税額 (10%・円)', defaultValue: '30,000' },
      { key: 'total_amount', label: 'ご請求金額合計 (税込・円)', defaultValue: '330,000' },
      { key: 'billing_month', label: '顧問料対象年月', defaultValue: '' },
      { key: 'monthly_fee', label: '月額費用 (税抜・円)', defaultValue: '100,000' },
      { key: 'deposit_rate', label: '手付金比率 (%)', defaultValue: '50' },
      { key: 'deposit_subtotal', label: '着手金小計 (税抜・円)', defaultValue: '150,000' },
      { key: 'deposit_tax', label: '着手金消費税 (10%・円)', defaultValue: '15,000' },
      { key: 'deposit_total', label: '着手金合計 (税込・円)', defaultValue: '165,000' },
      { key: 'completion_rate', label: '残金比率 (%)', defaultValue: '50' },
      { key: 'completion_subtotal', label: '残金小計 (税抜・円)', defaultValue: '150,000' },
      { key: 'completion_tax', label: '残金消費税 (10%・円)', defaultValue: '15,000' },
      { key: 'completion_total', label: '残金合計 (税込・円)', defaultValue: '165,000' },
      { key: 'installment_number', label: '今回分割回数 (第○回)', defaultValue: '1' },
      { key: 'installment_count', label: '全分割回数 (全○回)', defaultValue: '3' },
      { key: 'installment_subtotal', label: '分割小計 (税抜・円)', defaultValue: '100,000' },
      { key: 'installment_tax', label: '分割消費税 (10%・円)', defaultValue: '10,000' },
      { key: 'installment_total', label: '分割ご請求金額 (税込・円)', defaultValue: '110,000' },
      { key: 'total_project_amount', label: '委託総額 (税抜・円)', defaultValue: '300,000' },
    ],
  },
  {
    id: 'tpl-monthly-report-01',
    type: 'monthly_report',
    stepNum: 'STEP 5',
    title: '月次業務報告書',
    subtitle: '月次定例・伴走支援の成果指標と翌月アクション報告',
    description: '月次定例ミーティングで活用する業務進捗・成果指標・来月アクションの報告ひな形',
    badge: '伴走支援',
    htmlContent: getMonthlyReportHtml(),
    variables: [
      { key: 'client_company', label: '宛先企業名', defaultValue: '' },
      { key: 'report_title', label: '報告書タイトル', defaultValue: '月次業務改善・伴走支援レポート' },
      { key: 'target_month', label: '対象年月', defaultValue: '' },
      { key: 'monthly_summary', label: '当月サマリー', defaultValue: '' },
      { key: 'accomplishments', label: '主な実施実績', defaultValue: '' },
      { key: 'hours_saved', label: '月間創出時間（h）', defaultValue: '20' },
      { key: 'metrics_kpi', label: 'KPI実績・成果', defaultValue: '' },
      { key: 'next_actions', label: '次月アクション', defaultValue: '' },
      { key: 'issue_date', label: '発行日', defaultValue: '' },
    ],
  },
];

export const getTemplateDefaultValues = (
  templateId: string, 
  today: string = todayJst(),
  paymentMode: PaymentMode = 'lump_sum',
  invoiceSubtype: InvoiceSubtype = 'lump_sum'
): Record<string, string> => {
  const normId = normalizeTemplateId(templateId);
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
    due_date: formatDocumentDate(normId === 'tpl-proposal-report' || normId === 'tpl-unified-estimate' ? getOneMonthLaterDate(today) : getEndOfNextMonthDate(today)),
    subtotal_amount: '300,000',
    tax_amount: '30,000',
    total_amount: '330,000',
    project_name: '業務改善・自動化システム構築',
    proposal_title: '業務改善・自動化システム構築 御見積書',
    payment_terms: '契約締結月の翌月末日振込',
    total_project_amount: '300,000',
    deposit_rate: '50',
    deposit_subtotal: '150,000',
    deposit_tax: '15,000',
    deposit_total: '165,000',
    completion_rate: '50',
    completion_subtotal: '150,000',
    completion_tax: '15,000',
    completion_total: '165,000',
    installment_number: '1',
    installment_count: '3',
    installment_subtotal: '100,000',
    installment_tax: '10,000',
    installment_total: '110,000',
    initial_fee: '300,000',
    initial_fee_tax: '30,000',
    initial_fee_tax_included: '330,000',
    monthly_fee: '100,000',
    monthly_fee_tax: '10,000',
    monthly_fee_tax_included: '110,000',
    billing_month: `${today.slice(0, 4)}年${today.slice(5, 7)}月分`,
  };

  if (paymentMode === 'hybrid_setup_retainer' || invoiceSubtype === 'hybrid_setup_retainer') {
    common.initial_fee = '300,000';
    common.initial_fee_tax = '30,000';
    common.initial_fee_tax_included = '330,000';
    common.monthly_fee = '100,000';
    common.monthly_fee_tax = '10,000';
    common.monthly_fee_tax_included = '110,000';
    common.subtotal_amount = '400,000';
    common.tax_amount = '40,000';
    common.total_amount = '440,000';
    common.payment_terms = '初期構築費：契約締結月の翌月末日振込 ／ 月額顧問料：毎月末日締め翌月末日振込（最低6ヶ月契約）';
  }

  if (normId === 'tpl-proposal-report') {
    return {
      ...common,
      proposal_title: '経営の仕組み化 × 利益改善 伴走ご提案書',
      current_challenge: '売上はあるものの手元に利益が残りにくく、手作業や二重入力に時間を奪われ、改善を進めたいが日々の業務に追われて優先順位が決まらない状態です。',
      solution_overview: '経営戦略・利益改善顧問を主軸に、業務自動化（GAS・ツール連携）と集客導線（LINE・CRM連携）を組み合わせ、戦略と現場実装の両面から利益体質へ変革します。',
      recommended_product: '業務改善・IT・DX顧問 ＋ 業務自動化パッケージ',
      phase1_action: '【急所解消】請求・見積・顧客情報の重複入力を自動化し、月20時間以上の経営時間を即座に創出',
      phase2_action: '【自動導線】LINE・メール・CRMを連携し、集客から商談・顧客フォローが自動でつながる流れを構築',
      phase3_action: '【自走化】経営戦略・利益改善顧問の定期伴走により、新たな収益源の創出と自走組織を実現',
      cost_breakdown: '初期構築費 150,000円 / 月額顧問料 200,000円',
      subtotal_amount: '350,000',
      tax_amount: '35,000',
      total_amount: '385,000',
      expected_outcome: '現場の手作業を月20時間以上削減して利益が残る体制をつくり、経営者が「次の一手」に集中できる経営体質へ導きます。',
    };
  }

  if (normId === 'tpl-monthly-report-01') {
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
