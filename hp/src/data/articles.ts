export interface Article {
  slug: string;
  title: string;
  category: '経営改善・利益改善' | '業務改善・業務効率化' | 'マーケティング・集客' | 'IT・DX・AI活用' | '新規事業・事業づくり';
  categorySlug: 'management' | 'operations' | 'marketing' | 'it-dx' | 'new-business';
  publishedAt: string;
  summary: string;
  content: string[];
  thumbnailTheme: {
    bgGradient: string;
    icon: string;
    accentColor: string;
  };
  relatedService: {
    name: string;
    href: string;
  };
}

export const ARTICLES: Article[] = [
  {
    slug: 'profit-improvement-bottleneck',
    title: '売上はあるのに手元に利益が残らない中小企業が最初に見直すべき3つの勘所',
    category: '経営改善・利益改善',
    categorySlug: 'management',
    publishedAt: '2026.10.20',
    summary: '忙しく働いているのに月末や決算期にキャッシュが残らない。その根本原因は案件別の採算管理の欠如と、固定費のブラックボックス化にあります。利益体質に転換するための具体的手法を解説します。',
    thumbnailTheme: {
      bgGradient: 'from-blue-900 to-slate-900',
      icon: 'trending-up',
      accentColor: 'text-brand-300',
    },
    relatedService: {
      name: '経営戦略・利益改善顧問',
      href: '/services/strategy',
    },
    content: [
      '中小企業の経営者の方から最も多くいただくご相談の一つが、「売上は前年並み、あるいは伸びているのに、なぜか手元に資金が残らない」という悩みです。',
      'この現象が起きる最大の原因は、「粗利の低い（または赤字の）案件を、忙しさの中で見過ごしてしまっていること」にあります。全社ベースの損益計算書だけを見ていると、利益が出ている優良案件の黒字が、実は手間ばかりかかって赤字になっている案件の損失で相殺されているケースが非常に多いのです。',
      '利益が残る会社へ転換するための第1歩は、すべての案件・取引先ごとに「直接原価」と「実稼働工数」を記録し、案件別粗利率を可視化することです。これを行うだけで、どの業務を効率化すべきか、あるいはどの案件の価格改定・取引見直しを行うべきかが一目瞭然になります。',
      'MSTでは、スプレッドシートや専用ツールを用いて、経営者がリアルタイムに案件別採算を把握できる仕組みづくりと、利益率改善の顧問支援を提供しています。',
    ],
  },
  {
    slug: 'eliminating-individual-dependence',
    title: '「あの人しか分からない」を解消する：中小企業の業務属人化を脱却する業務フロー標準化手順',
    category: '業務改善・業務効率化',
    categorySlug: 'operations',
    publishedAt: '2026.10.15',
    summary: '担当者が休むと業務が停滞する、新人教育に多大な時間がかかる。属人化の恐怖を克服するための、業務プロセスの可視化と身の丈に合ったマニュアル作成の進め方。',
    thumbnailTheme: {
      bgGradient: 'from-slate-900 to-teal-950',
      icon: 'users',
      accentColor: 'text-teal-300',
    },
    relatedService: {
      name: '業務改善・IT・DX・AI顧問',
      href: '/services/it-dx',
    },
    content: [
      '「担当者が急に休むと、どこに何があるか分からず業務がストップしてしまう」「何年もいるベテランの頭の中にしか手順がない」。こうした属人化は、会社にとって最大の事業継続リスクです。',
      'しかし、分厚いマニュアルを作ろうとしても、現場は日々の業務に追われて作成が進まず、仮に完成しても誰も読まない「形骸化したマニュアル」になりがちです。',
      '属人化を解消する最も効果的な方法は、「完璧な文書」を目指すのではなく、まず業務の「入力・処理・出力」の3点だけを箇条書きで洗い出すことです。さらに、クラウドツールやGoogleフォームを挟むことで、「そのツールを通さないと次の工程に進めない仕組み（強制フロー化）」を作ることが重要です。',
      'MSTでは、現場の業務棚卸しから、誰でも同じ品質で仕事が完了する標準フローの設計と定着までを伴走支援しています。',
    ],
  },
  {
    slug: 'gas-and-ai-practical-automation',
    title: '高価なシステムは不要！Google Workspace × GAS × 生成AIで始める反復業務の自動化手法',
    category: 'IT・DX・AI活用',
    categorySlug: 'it-dx',
    publishedAt: '2026.10.10',
    summary: '数百万円の開発費用をかけなくても、すでに導入しているGoogle Workspaceや身近な自動化ツールで毎日の転記やメール送信は自動化できます。実例を交えてご紹介。',
    thumbnailTheme: {
      bgGradient: 'from-brand-950 to-blue-900',
      icon: 'cpu',
      accentColor: 'text-brand-300',
    },
    relatedService: {
      name: 'システム構築・業務自動化',
      href: '/services/system',
    },
    content: [
      '「DXやAIを進めたいが、数百万円もする専用システムを導入する予算はない」。多くの中小企業が直面するこの課題ですが、実は莫大な投資は必要ありません。',
      'すでに社内で使っているGoogleスプレッドシート、Gmail、Googleフォームに、Google Apps Script（GAS）と生成AIのAPIを組み合わせるだけで、日常の「請求書の下書き作成」「フォーム回答の自動転記」「リマインドメールの自動送信」などは驚くほど低コストで自動化できます。',
      '重要なのは、ツールを導入すること自体ではなく、「社内のどの反復作業が時間を奪っているのか」を正確に特定し、そこにピンポイントで小さな自動化を適用することです。',
      '有限会社MSTでは、大企業向けのパッケージを売りつけるのではなく、貴社の業務にジャストフィットする完全内製の自動化スクリプトやWebツールをスモールスタートで構築しています。',
    ],
  },
  {
    slug: 'b2b-line-acquisition-funnel',
    title: '紹介頼みの営業から脱却する：公式LINEとWeb導線を連携させた見込み客の自動育成法',
    category: 'マーケティング・集客',
    categorySlug: 'marketing',
    publishedAt: '2026.10.05',
    summary: 'HPを公開しただけで問い合わせが来る時代は終わりました。無料診断や資料請求をフックにLINEへ誘導し、信頼関係を構築して商談へつなげる最新のBtoB導線設計。',
    thumbnailTheme: {
      bgGradient: 'from-emerald-950 to-slate-900',
      icon: 'message-square',
      accentColor: 'text-emerald-300',
    },
    relatedService: {
      name: 'マーケティング・集客導線構築',
      href: '/services/marketing',
    },
    content: [
      '「営業は人脈と紹介頼みで、来月の新規見込み客が読めない」。この状態は、経営において常に先が見えない不安をもたらします。',
      'Webサイトを作っても、訪れたユーザーの95%以上は「今すぐ相談」のフォームを入力せずに離脱してしまいます。そこで不可欠になるのが、心理的ハードルの低い「3分無料診断」や「実務ガイドブックの無料ダウンロード」です。',
      'そこから公式LINEやステップメールへ誘導し、定期的に経営課題の解決に役立つ情報を配信することで、見込み客の信頼（ナーチャリング）を獲得します。そして相手の課題が顕在化した瞬間に「相談してみよう」と指名される導線を構築できるのです。',
      'MSTのマーケティング支援では、LP制作からLINE公式アカウントの設計、自動診断フォームの構築までを一体でプロデュースしています。',
    ],
  },
  {
    slug: 'senior-support-turnkey-business',
    title: '「新しい事業を、ゼロから作らない」：急成長するシニア生活支援・介護保険外サービス参入の鉄則',
    category: '新規事業・事業づくり',
    categorySlug: 'new-business',
    publishedAt: '2026.09.28',
    summary: '超高齢社会でニーズが急拡大する介護保険外サービス。なぜ資格不要・低初期費用で始められるのか。自社直営「アシスタ大垣」の現場データから見る成功のポイント。',
    thumbnailTheme: {
      bgGradient: 'from-amber-950 to-slate-900',
      icon: 'compass',
      accentColor: 'text-amber-300',
    },
    relatedService: {
      name: '介護保険外サービス開業パッケージ',
      href: '/services/care-package',
    },
    content: [
      '既存事業とは別に「第2の収益の柱」を作りたいと考えたとき、市場が縮小している業界への参入は極めてハイリスクです。一方で、団塊の世代が75歳以上の後期高齢者となり、シニアの生活支援需要は今後20年以上にわたって拡大し続けます。',
      '公的な介護保険サービスは厳しい人員基準や許認可が必要ですが、病院への付き添い、電球交換、草むしり、大掃除といった「介護保険外の生活支援」は特別な資格がなくても開業可能です。',
      'ただし、ゼロからチラシを作り、利用規約を弁護士に依頼し、顧客カルテシステムを組むのには多大な時間と試行錯誤がかかります。そこで有効なのが、自社で直営実証されたパッケージをそのまま活用することです。',
      'MSTでは、直営事業「アシスタ大垣」で成果が出ている営業スクリプト・Web基盤・業務管理ツールをすべてセットにした「開業パッケージ」を提供しています。',
    ],
  },
];
