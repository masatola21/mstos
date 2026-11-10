// 自社メディア「テンプレート記事」（HPのお役立ち情報に最初から入っていた5本）
// OSの「記事作成・HP公開」画面の「テンプレート記事を復元」ボタンで、
// mst_ai_acquisition_records に公開状態で登録されます。
// 登録後は通常の記事と同じく、OSのゴミ箱ボタンで削除できます（HPも自動で再デプロイ）。
// 新しい記事を作るときに不要になったら、OS側で削除してください。

export type MediaTemplateArticle = {
  id: string;
  title: string;
  payload: Record<string, string>;
};

export const MEDIA_TEMPLATE_ARTICLES: MediaTemplateArticle[] = [
  {
    "id": "article-template-profit-improvement-bottleneck",
    "title": "売上はあるのに手元に利益が残らない中小企業が最初に見直すべき3つの勘所",
    "payload": {
      "slug": "profit-improvement-bottleneck",
      "category": "経営改善・利益改善",
      "publishedDate": "2026.10.20",
      "metaTitle": "売上はあるのに手元に利益が残らない中小企業が最初に見直すべき3つの勘所",
      "metaDescription": "忙しく働いているのに月末や決算期にキャッシュが残らない。その根本原因は案件別の採算管理の欠如と、固定費のブラックボックス化にあります。利益体質に転換するための具体的手法を解説します。",
      "body": "中小企業の経営者の方から最も多くいただくご相談の一つが、「売上は前年並み、あるいは伸びているのに、なぜか手元に資金が残らない」という悩みです。\n\nこの現象が起きる最大の原因は、「粗利の低い（または赤字の）案件を、忙しさの中で見過ごしてしまっていること」にあります。全社ベースの損益計算書だけを見ていると、利益が出ている優良案件の黒字が、実は手間ばかりかかって赤字になっている案件の損失で相殺されているケースが非常に多いのです。\n\n利益が残る会社へ転換するための第1歩は、すべての案件・取引先ごとに「直接原価」と「実稼働工数」を記録し、案件別粗利率を可視化することです。これを行うだけで、どの業務を効率化すべきか、あるいはどの案件の価格改定・取引見直しを行うべきかが一目瞭然になります。\n\nMSTでは、スプレッドシートや専用ツールを用いて、経営者がリアルタイムに案件別採算を把握できる仕組みづくりと、利益率改善の顧問支援を提供しています。",
      "bgGradient": "from-blue-900 to-slate-900",
      "icon": "trending-up",
      "relatedServiceName": "経営戦略・利益改善顧問",
      "relatedServiceHref": "/services/strategy",
      "isTemplate": "true"
    }
  },
  {
    "id": "article-template-eliminating-individual-dependence",
    "title": "「あの人しか分からない」を解消する：中小企業の業務属人化を脱却する業務フロー標準化手順",
    "payload": {
      "slug": "eliminating-individual-dependence",
      "category": "業務改善・業務効率化",
      "publishedDate": "2026.10.15",
      "metaTitle": "「あの人しか分からない」を解消する：中小企業の業務属人化を脱却する業務フロー標準化手順",
      "metaDescription": "担当者が休むと業務が停滞する、新人教育に多大な時間がかかる。属人化の恐怖を克服するための、業務プロセスの可視化と身の丈に合ったマニュアル作成の進め方。",
      "body": "「この業務は〇〇さんしか分からない」「急に休まれたら現場がストップする」。多くの小規模事業者で、特定のベテラン社員への業務の属人化が深刻な経営リスクとなっています。\n\n属人化が発生する原因は「マニュアルがないから」だけではありません。真の原因は「業務の全体フローと判断基準が可視化されていないこと」にあります。手順だけを文字にしても、実際の現場で起こる例外パターンや判断の理由が共有されていなければ、結局その人に聞かなければ解決しないからです。\n\n解決の鍵は、業務を「インプット」「判断基準」「アウトプット」に分解し、誰でも80点以上の品質で対応できる仕組みを作ることです。最初から分厚いマニュアルを作る必要はありません。まずはスマホで作業動画を撮る、チェックリストを1枚作ることから始めます。\n\nMSTでは、現場のヒアリングから業務フロー図の作成、誰でも回せる標準化マニュアルの設計までを一貫して支援しています。",
      "bgGradient": "from-slate-800 to-slate-950",
      "icon": "users",
      "relatedServiceName": "業務改善・IT・DX・AI顧問",
      "relatedServiceHref": "/services/it-dx",
      "isTemplate": "true"
    }
  },
  {
    "id": "article-template-gas-and-ai-practical-automation",
    "title": "高額なシステム開発は不要：Google Workspace × 生成AIで実現する反復業務の自動化手法",
    "payload": {
      "slug": "gas-and-ai-practical-automation",
      "category": "IT・DX・AI活用",
      "publishedDate": "2026.10.10",
      "metaTitle": "高額なシステム開発は不要：Google Workspace × 生成AIで実現する反復業務の自動化手法",
      "metaDescription": "数百万円の基幹システムを導入しなくても、日々の二重入力や集計、メール送信は自動化できます。小規模事業者に最適な身の丈の自動化・AI活用事例。",
      "body": "「業務を自動化したいが、大手のシステム開発会社に見積もりを取ったら数百万円と言われて諦めた」。中小企業経営者からよく伺うお話です。\n\nしかし、日常のルーチンワークの多くは、Googleスプレッドシート、Gmail、GoogleフォームをGoogle Apps Script（GAS）で連携させるだけで、驚くほど簡単に自動化できます。さらに最近では、ChatGPTやClaudeなどの生成AI APIを組み合わせることで、問い合わせメールの一次返信ドラフト作成や、議事録の要約まで自動で行えるようになっています。\n\n身の丈に合った自動化の秘訣は、「最初から100点を目指さないこと」です。まずは毎日30分かかっている請求書転記やレポート作成をスクリプトで自動化し、浮いた時間で次の改善を進める。このスモールスタートこそが、失敗しない業務DXの鉄則です。\n\nMSTでは、専用Webアプリの開発はもちろん、既存ツールを活かした低コストかつ超高速なGAS・AI自動化の実装を自社直接開発で承っています。",
      "bgGradient": "from-brand-900 to-slate-900",
      "icon": "cpu",
      "relatedServiceName": "システム構築・業務自動化",
      "relatedServiceHref": "/services/system",
      "isTemplate": "true"
    }
  },
  {
    "id": "article-template-b2b-line-acquisition-funnel",
    "title": "紹介頼みの営業から脱却する：公式LINEとWeb導線を連携させた見込み客の自動育成法",
    "payload": {
      "slug": "b2b-line-acquisition-funnel",
      "category": "マーケティング・集客",
      "publishedDate": "2026.10.05",
      "metaTitle": "紹介頼みの営業から脱却する：公式LINEとWeb導線を連携させた見込み客の自動育成法",
      "metaDescription": "HPを公開しただけで問い合わせが来る時代は終わりました。無料診断や資料請求をフックにLINEへ誘導し、信頼関係を構築して商談へつなげる最新のBtoB導線設計。",
      "body": "「営業は人脈と紹介頼みで、来月の新規見込み客が読めない」。この状態は、経営において常に先が見えない不安をもたらします。\n\nWebサイトを作っても、訪れたユーザーの95%以上は「今すぐ相談」のフォームを入力せずに離脱してしまいます。そこで不可欠になるのが、心理的ハードルの低い「3分無料診断」や「実務ガイドブックの無料ダウンロード」です。\n\nそこから公式LINEやステップメールへ誘導し、定期的に経営課題の解決に役立つ情報を配信することで、見込み客の信頼（ナーチャリング）を獲得します。そして相手の課題が顕在化した瞬間に「相談してみよう」と指名される導線を構築できるのです。\n\nMSTのマーケティング支援では、LP制作からLINE公式アカウントの設計、自動診断フォームの構築までを一体でプロデュースしています。",
      "bgGradient": "from-emerald-950 to-slate-900",
      "icon": "message-square",
      "relatedServiceName": "マーケティング・集客導線構築",
      "relatedServiceHref": "/services/marketing",
      "isTemplate": "true"
    }
  },
  {
    "id": "article-template-senior-support-turnkey-business",
    "title": "「新しい事業を、ゼロから作らない」：急成長するシニア生活支援・介護保険外サービス参入の鉄則",
    "payload": {
      "slug": "senior-support-turnkey-business",
      "category": "新規事業・事業づくり",
      "publishedDate": "2026.09.28",
      "metaTitle": "「新しい事業を、ゼロから作らない」：急成長するシニア生活支援・介護保険外サービス参入の鉄則",
      "metaDescription": "超高齢社会でニーズが急拡大する介護保険外サービス。なぜ資格不要・低初期費用で始められるのか。自社直営「アシスタ大垣」の現場データから見る成功のポイント。",
      "body": "既存事業とは別に「第2の収益の柱」を作りたいと考えたとき、市場が縮小している業界への参入は極めてハイリスクです。一方で、団塊の世代が75歳以上の後期高齢者となり、シニアの生活支援需要は今後20年以上にわたって拡大し続けます。\n\n公的な介護保険サービスは厳しい人員基準や許認可が必要ですが、病院への付き添い、電球交換、草むしり、大掃除といった「介護保険外の生活支援」は特別な資格がなくても開業可能です。\n\nただし、ゼロからチラシを作り、利用規約を弁護士に依頼し、顧客カルテシステムを組むのには多大な時間と試行錯誤がかかります。そこで有効なのが、自社で直営実証されたパッケージをそのまま活用することです。\n\nMSTでは、直営事業「アシスタ大垣」で成果が出ている営業スクリプト・Web基盤・業務管理ツールをすべてセットにした「開業パッケージ」を提供しています。",
      "bgGradient": "from-amber-950 to-slate-900",
      "icon": "compass",
      "relatedServiceName": "介護保険外サービス開業パッケージ",
      "relatedServiceHref": "/services/care-package",
      "isTemplate": "true"
    }
  }
];
