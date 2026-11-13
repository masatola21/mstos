/**
 * 提案書のひな型(tpl-proposal-report)。章の構成は src/constants/proposalChapters.ts に従う。
 *
 *   表紙 → 診断パート(D0〜D5。D6は社内用なので載せない) → 提案パート(P1〜P7) → 末尾
 *
 * - 型(構築 / 伴走 / 構築+伴走)で、P2〜P5 の見出しと項目が切り替わる。
 * - 金額・期間・サービス名・支払い条件は、人が入力した値だけを使う。初期値は空。
 *   必須の項目が空のままだと、書類に「【未入力】」と出る(承認前に気づけるようにする)。
 * - 数値の効果(「月20時間削減」など)や、Phase の固定文は入れない。
 */

import {
  PROPOSAL_KIND_LABELS,
  PROPOSAL_VALID_DAYS,
  getChapter,
  type ProposalKind,
  type ProposalPaymentMode,
} from '../../constants/proposalChapters';

export const PROPOSAL_DOCUMENT_TITLE = '経営・業務改善 ご提案書';

export interface ProposalVariable { key: string; label: string; defaultValue: string }

/** 変数の一覧(画面の入力欄の順)。初期値は、発行者情報以外すべて空。 */
export const PROPOSAL_VARIABLES: ProposalVariable[] = [
  { key: 'proposal_title', label: '案件名', defaultValue: '' },
  { key: 'client_company', label: '宛先企業名', defaultValue: '' },
  { key: 'client_name', label: '宛先担当者名', defaultValue: '' },
  { key: 'issue_date', label: '発行日', defaultValue: '' },
  { key: 'due_date', label: '有効期限(発行日から自動計算)', defaultValue: '' },
  // 診断パート(診断レポートから自動で入る。直してもよい)
  { key: 'd0_summary', label: 'D0 結論サマリー', defaultValue: '' },
  { key: 'd1_premise', label: 'D1 診断の前提', defaultValue: '' },
  { key: 'd2_current', label: 'D2 現状整理', defaultValue: '' },
  { key: 'd3_bottleneck', label: 'D3 特定された急所と根拠', defaultValue: '' },
  { key: 'd4_impact', label: 'D4 放置した場合の影響', defaultValue: '' },
  { key: 'd5_direction', label: 'D5 改善の方向性', defaultValue: '' },
  // 提案パート
  { key: 'p_meeting_notes', label: '商談メモ(AIの下書きの材料。書類には載りません)', defaultValue: '' },
  { key: 'p1_policy', label: 'P1 提案の方針', defaultValue: '' },
  { key: 'p2_service_name', label: 'P2 サービス名', defaultValue: '' },
  { key: 'p2_deliverables', label: 'P2 成果物の一覧(構築)', defaultValue: '' },
  { key: 'p2_monthly_support', label: 'P2 月次の支援内容(定例の回数・相談範囲)(伴走)', defaultValue: '' },
  { key: 'p3_roadmap', label: 'P3 ロードマップ(期間・成果物)', defaultValue: '' },
  { key: 'p3_metrics', label: 'P3 確認指標', defaultValue: '' },
  { key: 'p4_initial_fee', label: 'P4 初期費用(税抜・円)', defaultValue: '' },
  { key: 'p4_monthly_fee', label: 'P4 月額(税抜・円)', defaultValue: '' },
  { key: 'p4_discount', label: 'P4 値引き(税抜・円)', defaultValue: '' },
  { key: 'p4_subtotal', label: 'P4 小計(税抜・円。自動計算)', defaultValue: '' },
  { key: 'p4_tax', label: 'P4 消費税(10%・円。自動計算)', defaultValue: '' },
  { key: 'p4_total', label: 'P4 合計(税込・円。自動計算)', defaultValue: '' },
  { key: 'p5_requests', label: 'P5 お客様にお願いすること', defaultValue: '' },
  { key: 'p5_prerequisites', label: 'P5 前提・条件', defaultValue: '' },
  { key: 'p5_exclusions', label: 'P5 対象外', defaultValue: '' },
  { key: 'p6_payment_terms', label: 'P6 お支払い条件', defaultValue: '' },
  { key: 'p6_contract_period', label: 'P6 契約期間(伴走・構築+伴走)', defaultValue: '' },
  { key: 'sender_company', label: '発行者 会社名', defaultValue: '有限会社MST' },
  { key: 'sender_rep', label: '発行者 代表者名', defaultValue: '大橋真人' },
  { key: 'sender_address', label: '発行者 所在地', defaultValue: '〒503-0981 岐阜県大垣市桧町127番地' },
];

/** 長い文章の欄(画面では複数行の入力欄にする) */
export const MULTILINE_KEYS: ReadonlySet<string> = new Set([
  'd0_summary', 'd1_premise', 'd2_current', 'd3_bottleneck', 'd4_impact', 'd5_direction',
  'p_meeting_notes', 'p1_policy', 'p2_deliverables', 'p2_monthly_support', 'p3_roadmap', 'p3_metrics',
  'p5_requests', 'p5_prerequisites', 'p5_exclusions', 'p6_payment_terms',
]);

/** AIで下書きを作れる欄 → 章(サーバーの /api/proposals/draft-chapter に渡す) */
export const DRAFTABLE_KEYS: Readonly<Record<string, 'P1' | 'P3'>> = {
  p1_policy: 'P1',
  p3_roadmap: 'P3',
};

/** 型ごとに、空のままだと「【未入力】」と出す項目(仕様書 §3 の「承認不可」の章) */
export function requiredKeysFor(kind: ProposalKind): string[] {
  const common = ['d0_summary', 'd5_direction', 'p1_policy', 'p2_service_name', 'p3_roadmap', 'p4_subtotal', 'p4_tax', 'p4_total', 'p6_payment_terms', 'client_company'];
  if (kind === 'spot_build') return [...common, 'p2_deliverables', 'p4_initial_fee'];
  if (kind === 'retainer') return [...common, 'p2_monthly_support', 'p4_monthly_fee', 'p6_contract_period'];
  return [...common, 'p2_deliverables', 'p2_monthly_support', 'p4_initial_fee', 'p4_monthly_fee', 'p6_contract_period'];
}

export const PROPOSAL_MISSING_MARK = '【未入力】';

/** 空のときに代わりに出す文(仕様書 §3「空欄・不足のとき」) */
const EMPTY_FALLBACK: Record<string, string> = {
  d1_premise: '未回答',
  d2_current: '要ヒアリング',
  d3_bottleneck: '要ヒアリング',
  d4_impact: '（該当なし）',
  p3_metrics: '（商談で確認のうえ記載します）',
  p4_discount: '0',
  // P5 は空でも成立する(仕様書: 共通文で補う)。見出しだけが残らないよう代替文を出す
  p5_requests: '（個別の記載はありません）',
  p5_prerequisites: '（個別の記載はありません）',
  p5_exclusions: '（個別の記載はありません）',
};

/** 画面で値を埋めるときに、空の項目へ入れる文字を返す */
export function proposalEmptyText(key: string, kind: ProposalKind): string {
  if (requiredKeysFor(kind).includes(key)) return PROPOSAL_MISSING_MARK;
  return EMPTY_FALLBACK[key] ?? '';
}

/** 支払い方式ごとの、お支払い条件の初期文(担当者が直せる) */
export function defaultPaymentTermsFor(mode: ProposalPaymentMode): string {
  switch (mode) {
    case 'lump_sum': return '契約締結月の翌月末日振込(一括払い)';
    case 'installments_3': return '毎月末日締め翌月末日振込(全3回均等分割)';
    case 'installments_6': return '毎月末日締め翌月末日振込(全6回均等分割)';
    case 'milestone': return '着手金(50%):契約締結後翌月末日振込 ／ 残金(50%):導入検収月翌月末日振込';
    case 'retainer': return '毎月末日締め翌月末日振込(月額)';
    case 'hybrid_setup_retainer': return '初期費用:契約締結月の翌月末日振込 ／ 月額:毎月末日締め翌月末日振込';
  }
}

// ─── HTML ───────────────────────────────────────────────────

const text = (key: string) =>
  `<div style="white-space:pre-wrap; font-size:13px; color:#334155; line-height:1.8;">{{${key}}}</div>`;

const heading = (label: string) =>
  `<h3 style="margin:0 0 10px 0; font-size:15px; color:#1e3a8a; font-weight:bold; border-left:4px solid #2563eb; padding-left:8px;">${label}</h3>`;

const section = (label: string, body: string) =>
  `<div style="margin-bottom:26px;">\n${heading(label)}\n${body}\n</div>`;

const sub = (label: string) =>
  `<p style="margin:12px 0 4px 0; font-size:12px; font-weight:bold; color:#475569;">${label}</p>`;

const partTitle = (label: string) =>
  `<h2 style="margin:36px 0 18px 0; padding-bottom:6px; font-size:17px; color:#0f172a; border-bottom:2px solid #cbd5e1;">${label}</h2>`;

const row = (label: string, key: string, strong = false) =>
  `<tr><td style="padding:6px 0; color:#64748b; border-bottom:1px solid #e2e8f0;">${label}</td><td style="padding:6px 0; text-align:right; border-bottom:1px solid #e2e8f0;${strong ? ' font-weight:800; font-size:17px; color:#1e3a8a;' : ''}">¥{{${key}}}</td></tr>`;

function p2Body(kind: ProposalKind): string {
  const service = `${sub('サービス名')}${text('p2_service_name')}`;
  if (kind === 'spot_build') return `${service}${sub('成果物')}${text('p2_deliverables')}`;
  if (kind === 'retainer') return `${service}${sub('月次の支援内容(定例の回数、相談範囲)')}${text('p2_monthly_support')}`;
  return `${service}${sub('構築の成果物')}${text('p2_deliverables')}${sub('月次の支援内容(定例の回数、相談範囲)')}${text('p2_monthly_support')}`;
}

const P3_LABEL: Record<ProposalKind, string> = {
  spot_build: '構築のスケジュール',
  retainer: 'フェーズごとの重点テーマ',
  hybrid: '構築期間から伴走への移行',
};

function p4Rows(kind: ProposalKind): string {
  const rows: string[] = [];
  if (kind !== 'retainer') rows.push(row('初期費用', 'p4_initial_fee'));
  if (kind !== 'spot_build') rows.push(row('月額', 'p4_monthly_fee'));
  rows.push(row('値引き', 'p4_discount'));
  rows.push(row('小計(税抜)', 'p4_subtotal'));
  rows.push(row('消費税(10%)', 'p4_tax'));
  rows.push(row('合計(税込)', 'p4_total', true));
  return rows.join('\n');
}

const P5_LABEL: Record<ProposalKind, string> = {
  spot_build: '前提・条件(検収条件、保守の範囲など)',
  retainer: '前提・条件(契約期間、最低期間、解約条件など)',
  hybrid: '前提・条件(検収条件、保守の範囲、契約期間、最低期間、解約条件など)',
};

/** 提案書のHTML。型で P2〜P5 の項目が変わる。{{変数}} は画面側で埋める。 */
export function getProposalReportHtml(kind: ProposalKind = 'spot_build'): string {
  const t = (id: string) => getChapter(id)!.title;
  const needsPeriod = kind !== 'spot_build';

  return `<div style="font-family: Arial, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.8;">
  <div style="border-bottom:3px solid #2563eb; padding-bottom:14px; margin-bottom:24px;">
    <h1 style="margin:0; font-size:26px; line-height:1.3; color:#0f172a; font-weight:800; white-space:nowrap;">${PROPOSAL_DOCUMENT_TITLE}</h1>
    <p style="margin:6px 0 0 0; font-size:14px; color:#475569;">案件名: {{proposal_title}}</p>
    <div style="display:flex; flex-wrap:wrap; gap:4px 24px; margin-top:10px; font-size:12px; color:#475569;">
      <span><span style="color:#64748b;">発行日:</span> <strong style="color:#0f172a;">{{issue_date}}</strong></span>
      <span><span style="color:#64748b;">有効期限:</span> <strong style="color:#0f172a;">{{due_date}}</strong>(発行日から${PROPOSAL_VALID_DAYS}日間)</span>
    </div>
  </div>

  <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; margin-bottom:8px;">
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

  ${partTitle('診断の結果')}
  ${section(t('D0'), text('d0_summary'))}
  ${section(t('D1'), text('d1_premise'))}
  ${section(t('D2'), text('d2_current'))}
  ${section(t('D3'), text('d3_bottleneck'))}
  ${section(t('D4'), text('d4_impact'))}
  ${section(t('D5'), text('d5_direction'))}

  ${partTitle(`ご提案(${PROPOSAL_KIND_LABELS[kind]})`)}
  ${section(t('P1'), text('p1_policy'))}
  ${section(t('P2'), p2Body(kind))}
  ${section(t('P3'), `${sub(P3_LABEL[kind])}${text('p3_roadmap')}${sub('確認指標')}${text('p3_metrics')}`)}
  ${section(t('P4'), `<table style="width:100%; border-collapse:collapse; font-size:13px;">\n${p4Rows(kind)}\n</table>`)}
  ${section(t('P5'), `<p style="margin:0 0 8px 0; font-size:12px; color:#64748b;">ご提案内容は、以下の前提・対象外にもとづきます。前提と異なる場合は、内容や費用を見直すことがあります。</p>${sub('お客様にお願いすること')}${text('p5_requests')}${sub(P5_LABEL[kind])}${text('p5_prerequisites')}${sub('対象外')}${text('p5_exclusions')}`)}
  ${section(t('P6'), `${sub('お支払い条件')}${text('p6_payment_terms')}${needsPeriod ? `${sub('契約期間')}${text('p6_contract_period')}` : ''}`)}
  ${section(t('P7'), `<p style="margin:0 0 12px 0; font-size:13px; color:#334155;">ご提案内容にご同意いただける場合は、下のボタンからお申し込みください。内容のご確認やご相談も、お気軽にご連絡ください。</p>
  <div class="web-apply-box" style="padding:20px; border:2px solid #10b981; border-radius:12px; background:#f0fdf4; text-align:center;">
    <p style="font-weight:bold; font-size:15px; color:#065f46; margin:0 0 6px 0;">Webでのお申し込み</p>
    <p style="font-size:12px; color:#047857; margin:0 0 14px 0;">内容をご確認のうえ、同意いただいた記録が残ります。</p>
    <a href="{{apply_url}}" style="display:inline-block; background:#059669; color:#ffffff; padding:12px 32px; border-radius:8px; font-weight:bold; font-size:15px; text-decoration:none;">この内容で申し込む</a>
  </div>`)}

  <div style="margin-top:32px; padding-top:14px; border-top:1px solid #cbd5e1; font-size:11px; color:#64748b; line-height:1.7;">
    <p style="margin:0;">有効期限: {{due_date}}(この日を過ぎた場合は、内容を改めてご確認ください)</p>
    <p style="margin:4px 0 0 0;">本書は、診断フォームへのご回答と、商談でお伺いした内容にもとづく提案です。効果をお約束するものではありません。</p>
    <p style="margin:4px 0 0 0;">発行者: {{sender_company}} 代表取締役 {{sender_rep}} / {{sender_address}}</p>
  </div>
</div>`;
}

/** 本文中の {{変数}} の一覧(テスト・検証用) */
export function placeholdersIn(html: string): string[] {
  return Array.from(new Set(Array.from(html.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1])));
}
