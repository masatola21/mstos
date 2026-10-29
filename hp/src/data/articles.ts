import { supabase } from '../lib/supabase';

export interface Article {
  id?: string;
  slug: string;
  title: string;
  category: '経営改善・利益改善' | '業務改善・業務効率化' | 'マーケティング・集客' | 'IT・DX・AI活用' | '新規事業・事業づくり' | string;
  categorySlug: 'management' | 'operations' | 'marketing' | 'it-dx' | 'new-business' | string;
  publishedAt: string;
  summary: string;
  content: string[];
  thumbnailTheme?: {
    bgGradient: string;
    icon: string;
    accentColor: string;
  };
  relatedService?: {
    name: string;
    href: string;
  };
}

export const CATEGORY_MAP: Record<string, { name: Article['category']; slug: Article['categorySlug'] }> = {
  management: { name: '経営改善・利益改善', slug: 'management' },
  operations: { name: '業務改善・業務効率化', slug: 'operations' },
  marketing: { name: 'マーケティング・集客', slug: 'marketing' },
  'it-dx': { name: 'IT・DX・AI活用', slug: 'it-dx' },
  'new-business': { name: '新規事業・事業づくり', slug: 'new-business' },
};

// 既存の基本記事データ（フォールバック用）
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
      bgGradient: 'from-slate-800 to-slate-950',
      icon: 'users',
      accentColor: 'text-slate-300',
    },
    relatedService: {
      name: '業務改善・IT・DX・AI顧問',
      href: '/services/it-dx',
    },
    content: [
      '「この業務は〇〇さんしか分からない」「急に休まれたら現場がストップする」。多くの小規模事業者で、特定のベテラン社員への業務の属人化が深刻な経営リスクとなっています。',
      '属人化が発生する原因は「マニュアルがないから」だけではありません。真の原因は「業務の全体フローと判断基準が可視化されていないこと」にあります。手順だけを文字にしても、実際の現場で起こる例外パターンや判断の理由が共有されていなければ、結局その人に聞かなければ解決しないからです。',
      '解決の鍵は、業務を「インプット」「判断基準」「アウトプット」に分解し、誰でも80点以上の品質で対応できる仕組みを作ることです。最初から分厚いマニュアルを作る必要はありません。まずはスマホで作業動画を撮る、チェックリストを1枚作ることから始めます。',
      'MSTでは、現場のヒアリングから業務フロー図の作成、誰でも回せる標準化マニュアルの設計までを一貫して支援しています。',
    ],
  },
  {
    slug: 'gas-and-ai-practical-automation',
    title: '高額なシステム開発は不要：Google Workspace × 生成AIで実現する反復業務の自動化手法',
    category: 'IT・DX・AI活用',
    categorySlug: 'it-dx',
    publishedAt: '2026.10.10',
    summary: '数百万円の基幹システムを導入しなくても、日々の二重入力や集計、メール送信は自動化できます。小規模事業者に最適な身の丈の自動化・AI活用事例。',
    thumbnailTheme: {
      bgGradient: 'from-brand-900 to-slate-900',
      icon: 'cpu',
      accentColor: 'text-brand-300',
    },
    relatedService: {
      name: 'システム構築・業務自動化',
      href: '/services/system',
    },
    content: [
      '「業務を自動化したいが、大手のシステム開発会社に見積もりを取ったら数百万円と言われて諦めた」。中小企業経営者からよく伺うお話です。',
      'しかし、日常のルーチンワークの多くは、Googleスプレッドシート、Gmail、GoogleフォームをGoogle Apps Script（GAS）で連携させるだけで、驚くほど簡単に自動化できます。さらに最近では、ChatGPTやClaudeなどの生成AI APIを組み合わせることで、問い合わせメールの一次返信ドラフト作成や、議事録の要約まで自動で行えるようになっています。',
      '身の丈に合った自動化の秘訣は、「最初から100点を目指さないこと」です。まずは毎日30分かかっている請求書転記やレポート作成をスクリプトで自動化し、浮いた時間で次の改善を進める。このスモールスタートこそが、失敗しない業務DXの鉄則です。',
      'MSTでは、専用Webアプリの開発はもちろん、既存ツールを活かした低コストかつ超高速なGAS・AI自動化の実装を自社直接開発で承っています。',
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

/**
 * Supabase（mstosのAI集客運用）から公開中の最新記事を取得する
 * 接続できない場合や記事がない場合は既存の ARTICLES を安全に返す
 */
export async function getLiveArticles(): Promise<Article[]> {
  try {
    if (!supabase) return ARTICLES;

    const { data, error } = await supabase
      .from('mst_ai_acquisition_records')
      .select('*')
      .eq('record_type', 'article')
      .order('updated_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return ARTICLES;
    }

    // Supabaseから取得した記事を Article 型に変換
    const remoteArticles: Article[] = data
      .filter((row: any) => {
        const payload = row.payload || {};
        const status = row.status || payload.publishStatus || '';
        return ['公開', 'published', '公開済み'].includes(status);
      })
      .map((row: any) => {
        const p = row.payload || {};
        const slug = p.slug || row.id || `article-${row.created_at?.slice(0, 10)}`;
        const category = p.category || '経営改善・利益改善';
        const categorySlug =
          Object.values(CATEGORY_MAP).find((c) => c.name === category)?.slug || 'management';

        // 本文を行単位の配列に変換
        const rawBody = p.body || p.content || '';
        const contentLines = rawBody
          .split(/\n\n+|\r\n\r\n+/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        return {
          id: row.id,
          slug,
          title: row.title || p.metaTitle || '無題の記事',
          category,
          categorySlug,
          publishedAt: p.publishedDate || row.created_at?.slice(0, 10)?.replace(/-/g, '.') || '2026.10.29',
          summary: p.metaDescription || p.excerpt || p.summary || '',
          content: contentLines.length > 0 ? contentLines : [p.body || ''],
          thumbnailTheme: {
            bgGradient: p.bgGradient || 'from-brand-900 to-slate-900',
            icon: p.icon || 'file-text',
            accentColor: 'text-brand-300',
          },
          relatedService: p.relatedServiceName
            ? {
                name: p.relatedServiceName,
                href: p.relatedServiceHref || '/services',
              }
            : {
                name: '経営戦略・利益改善顧問',
                href: '/services/strategy',
              },
        };
      });

    // リモート記事があれば既存記事とマージ（スラッグ重複を排除）
    if (remoteArticles.length > 0) {
      const mergedMap = new Map<string, Article>();
      // 1. まず静的記事をセット
      for (const a of ARTICLES) {
        mergedMap.set(a.slug, a);
      }
      // 2. Supabase記事で上書きまたは追加
      for (const r of remoteArticles) {
        mergedMap.set(r.slug, r);
      }
      return Array.from(mergedMap.values());
    }

    return ARTICLES;
  } catch (err) {
    console.warn('Failed to load articles from Supabase, falling back to static:', err);
    return ARTICLES;
  }
}
