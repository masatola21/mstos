// 公式HP「商品・ツール」ページに最初から載っていた4件（テンプレート）。
// OSの「集客戦略・SNS・メディア」→「自社HP・連携設定」にある
// 「商品・ツール掲載」の「テンプレート商品を復元」ボタンで、公開状態で登録されます。
// 登録後は通常の掲載と同じく、OSで編集・削除できます（HPも自動で再デプロイ）。

export type HpProductStatusType = 'available' | 'developing' | 'planned';

export const HP_STATUS_OPTIONS: { value: HpProductStatusType; label: string }[] = [
  { value: 'available', label: '現在提供中' },
  { value: 'developing', label: '開発中' },
  { value: 'planned', label: '将来提供予定' },
];

export type HpTemplateProduct = {
  id: string;
  title: string;
  payload: Record<string, string>;
};

export const HP_TEMPLATE_PRODUCTS: HpTemplateProduct[] = [
  {
    id: 'hpproduct-template-care-package-docs',
    title: '介護保険外サービス開業 実務運営規約・同意書一式',
    payload: {
      category: '法務・運営ドキュメント',
      statusType: 'available',
      statusLabel: '現在提供中',
      desc: '生活支援・介護保険外サービスを提供する際に必要な利用規約、免責事項、重要事項説明書、事故対応マニュアルの実務テンプレート一式。',
      price: '開業パッケージにて提供中',
      href: '/services/care-package',
      sortOrder: '1',
    },
  },
  {
    id: 'hpproduct-template-task-inventory-checklist',
    title: '中小企業向け 業務棚卸し・属人化解消チェックリスト',
    payload: {
      category: 'テンプレート / ガイド',
      statusType: 'developing',
      statusLabel: '開発中',
      desc: '社内のどの業務が誰に依存しているかを1枚で可視化し、標準化の優先度を判定できるエクセル＆スプレッドシート形式のチェックシート。',
      price: '無償配布予定（一部有料版あり）',
      href: '',
      sortOrder: '2',
    },
  },
  {
    id: 'hpproduct-template-profit-management-sheet',
    title: '案件別 採算・粗利管理スプレッドシート（自動計算GAS付き）',
    payload: {
      category: 'GAS / 業務ツール',
      statusType: 'developing',
      statusLabel: '開発中',
      desc: '工数と直接原価を入力するだけで、案件別・取引先別の限界利益と営業利益率を自動集計・グラフ化する管理テンプレート。',
      price: '販売予定',
      href: '',
      sortOrder: '3',
    },
  },
  {
    id: 'hpproduct-template-ai-prompt-collection',
    title: 'ChatGPT・生成AI 実務導入プロンプトテンプレート集',
    payload: {
      category: 'AI活用テンプレート',
      statusType: 'planned',
      statusLabel: '将来提供予定',
      desc: '議事録要約、問い合わせメール一次返信、営業提案書ドラフト、社内マニュアル作成など、中小企業実務で即使える厳選プロンプト集。',
      price: '販売予定',
      href: '',
      sortOrder: '4',
    },
  },
];
