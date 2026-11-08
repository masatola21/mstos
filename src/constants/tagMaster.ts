export interface MasterTag {
  id: string;
  name: string;
  category: 'inflow' | 'action' | 'crm_status' | 'special';
  categoryLabel: string;
  color: string;
  description: string;
  isExitConditionDefault?: boolean;
}

export const UNIFIED_TAG_MASTER: MasterTag[] = [
  // 流入・選択タグ (LINEウェルカム・キーワード・流入経路)
  {
    id: 'tag_line_welcome',
    name: 'LINE友だち追加',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#10b981',
    description: 'LINE公式アカウントに友だち登録した際に自動付与',
  },
  {
    id: 'tag_choice_diagnosis',
    name: '選択:診断',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#059669',
    description: 'ウェルカムまたはキーワードで「診断」を選択した顧客',
  },
  {
    id: 'tag_choice_consult',
    name: '選択:個別相談',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#6366f1',
    description: 'ウェルカムまたはキーワードで「個別相談」を選択した顧客',
  },
  {
    id: 'tag_choice_care',
    name: 'care:開業相談',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#0284c7',
    description: '介護保険外サービス開業・事業展開を選択した顧客',
  },
  {
    id: 'tag_interest_pricing',
    name: '関心:料金',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#f59e0b',
    description: '料金・費用について問い合わせた顧客',
  },
  {
    id: 'tag_inbound_material',
    name: '資料請求',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#8b5cf6',
    description: '会社概要・サービス資料を請求した見込み客',
  },
  {
    id: 'tag_web_inquiry',
    name: 'Web問い合わせ',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#3b82f6',
    description: '自社ホームページやフォームから問い合わせた顧客',
  },
  // ラウンド6: 動的流入計測タグ（UTMパラメータ・認知経路からの自動付与）
  {
    id: 'tag_inflow_sns',
    name: '流入:SNS',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#6366f1',
    description: 'SNSプロフィールや投稿リンク（utm_source=sns）経由での流入',
  },
  {
    id: 'tag_inflow_hp_blog',
    name: '流入:HPブログ',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#10b981',
    description: '公式HPコラムや解説記事（utm_source=hp_blog）経由での流入',
  },
  {
    id: 'tag_inflow_line',
    name: '流入:LINE',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#059669',
    description: 'LINE公式配信やリッチメニュー（utm_source=line）経由での流入',
  },
  {
    id: 'tag_inflow_email',
    name: '流入:メール',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#0284c7',
    description: 'メルマガ・営業個別メール（utm_source=email）経由での流入',
  },
  {
    id: 'tag_inflow_material',
    name: '流入:資料',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#d97706',
    description: '配布PDF資料や印刷物QRコード（utm_source=material）経由での流入',
  },
  {
    id: 'tag_inflow_threads',
    name: '流入:Threads',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#0f172a',
    description: 'Threads投稿・プロフィール（utm_source=threads）経由での流入',
  },
  {
    id: 'tag_inflow_facebook',
    name: '流入:Facebook',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#1d4ed8',
    description: 'Facebook投稿・グループ（utm_source=facebook）経由での流入',
  },
  {
    id: 'tag_inflow_linkedin',
    name: '流入:LinkedIn',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#0284c7',
    description: 'LinkedIn投稿・プロフィール（utm_source=linkedin）経由での流入',
  },
  {
    id: 'tag_inflow_instagram',
    name: '流入:Instagram',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#db2777',
    description: 'Instagramプロフ・ストーリーズ（utm_source=instagram）経由での流入',
  },
  {
    id: 'tag_inflow_x',
    name: '流入:X',
    category: 'inflow',
    categoryLabel: '流入・選択',
    color: '#0f172a',
    description: 'X（旧Twitter）投稿・固定ポスト（utm_source=x）経由での流入',
  },

  // 行動・進捗ステータス (フォーム回答・面談予約・進捗)
  {
    id: 'tag_diagnosis_completed',
    name: '診断受検済み',
    category: 'action',
    categoryLabel: '行動・進捗',
    color: '#10b981',
    description: '3分無料経営診断フォームに回答完了（未受検リマインド自動停止条件）',
    isExitConditionDefault: true,
  },
  {
    id: 'tag_report_sent',
    name: '診断レポート送付済',
    category: 'action',
    categoryLabel: '行動・進捗',
    color: '#14b8a6',
    description: '経営改善ロードマップ（レポート）が作成・送付された状態',
  },
  {
    id: 'tag_booking_completed',
    name: '個別相談予約済み',
    category: 'action',
    categoryLabel: '行動・進捗',
    color: '#8b5cf6',
    description: 'TimeRex等で個別相談・面談確定時に手動で付与（予約促進リマインド自動停止）',
    isExitConditionDefault: true,
  },
  {
    id: 'tag_meeting_finished',
    name: '相談実施済み',
    category: 'action',
    categoryLabel: '行動・進捗',
    color: '#a855f7',
    description: '30分の個別相談・面談を実施完了',
    isExitConditionDefault: true,
  },
  {
    id: 'tag_proposal_presented',
    name: '提案書提示済み',
    category: 'action',
    categoryLabel: '行動・進捗',
    color: '#ec4899',
    description: '改善支援または開業支援の具体提案書を提出',
  },

  // 顧客ステータス / CRM連動 (営業フェーズ・成約・除外)
  {
    id: 'tag_deal_won',
    name: '成約・顧問契約',
    category: 'crm_status',
    categoryLabel: 'CRM顧客ステータス',
    color: '#f59e0b',
    description: '成約・契約締結完了（全営業・追客シナリオから即時完全除外）',
    isExitConditionDefault: true,
  },
  {
    id: 'tag_existing_client',
    name: '既存クライアント',
    category: 'crm_status',
    categoryLabel: 'CRM顧客ステータス',
    color: '#eab308',
    description: 'すでに支援中のクライアント企業',
    isExitConditionDefault: true,
  },
  {
    id: 'tag_hot_prospect',
    name: '見込み客(Hot)',
    category: 'crm_status',
    categoryLabel: 'CRM顧客ステータス',
    color: '#ef4444',
    description: '直近での導入・開業意欲が高い優先フォロー対象',
  },
  {
    id: 'tag_optout',
    name: '配信停止・オプトアウト',
    category: 'crm_status',
    categoryLabel: 'CRM顧客ステータス',
    color: '#64748b',
    description: 'メール・LINE配信の停止を希望した顧客（自動配信完全停止）',
    isExitConditionDefault: true,
  },
];

export const TAG_CATEGORIES = [
  { key: 'all', label: 'すべて' },
  { key: 'inflow', label: '📌 流入・選択' },
  { key: 'action', label: '🚀 行動・進捗' },
  { key: 'crm_status', label: '💼 CRMステータス・停止条件' },
] as const;

export function getTagByName(name: string): MasterTag | undefined {
  return UNIFIED_TAG_MASTER.find((t) => t.name === name);
}

export function getDefaultExitTags(): MasterTag[] {
  return UNIFIED_TAG_MASTER.filter((t) => t.isExitConditionDefault);
}
