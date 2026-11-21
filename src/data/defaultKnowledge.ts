import type { KnowledgeItem } from '../types/ai-president';

export const DEFAULT_KNOWLEDGE_SEED_VERSION = '2026-11-21-mst-v2';

/**
 * 全AIに共通前提として常時共有する「有限会社MST ＆ 経営OS」の軽量コアプロフィール
 */
export const MST_CORE_BUSINESS_PROFILE = `・会社名: 有限会社MST（代表取締役: 大橋真人 / 設立: 2005年 / 所在地: 岐阜県大垣市）
・事業の軸: 「経営の仕組み化 × 利益改善」。代表自身も実店舗サロン経営や介護保険外生活支援サービス「アシスタ大垣」等を直営し、戦略設計から現場で機能する仕組み構築・定着まで伴走する。
・MSTの最大の強み・原点:
  1) これまで自社で「自分のため」に本気で試行錯誤し、実際に機能させてきた仕組みと実業ノウハウそのものを提供できること。
  2) お客様と「一緒に会社を成長させていく」対等な伴走姿勢。
  3) 「この領域（経営の仕組み化・利益改善・現場実装）では必ず役に立てる」という強い確信と熱い想い。
・主力4サービス:
  1) 経営戦略・利益改善顧問（案件別粗利・採算可視化、利益構造改善、経営と現場の一体支援）
  2) 業務改善・IT・DX・AI顧問（業務棚卸し・標準化・属人化解消、身の丈DX・生成AI定着）
  3) システム構築・業務自動化（スプレッドシート/GAS・専用Webアプリ・API連携の直結開発）
  4) マーケティング・集客導線構築（HP/LP・LINE公式・メールによる獲得〜育成〜商談導線設計）
・関連支援・専門商品: 新規事業立ち上げ支援／介護保険外サービス開業パッケージ（直営ノウハウ＋専用LP）／各種実務テンプレート
・重点5業種: 工事業、店舗サービス業、清掃・保守業、介護・福祉業、専門請負業（その他中小企業・個人事業主全般）
・この経営OSの役割: 問い合わせ・診断→商談→提案書・契約・請求・タスク管理・LINE/メール配信・公式HP連携を一元管理し、実データに基づき意思決定と実行を支援する社内基盤。`;

const BASE_TIMESTAMP = 1760000000000;

const COMPANY_PROFILE_CONTENT_V1 = `■ 会社基本情報
・会社名: 有限会社MST（MST Co., Ltd.）
・代表者: 代表取締役 大橋 真人
・設立: 平成17年（2005年）6月16日 / 資本金: 3,000,000円
・所在地: 〒503-0981 岐阜県大垣市桧町127番地
・連絡先: contact@mstcorp.info

■ 代表の実務背景と支援スタンス
代表自身がWeb事業起業、スクール運営、自動車流通、M&Aによる事業承継、実店舗サロン経営、介護保険外生活支援サービス「アシスタ大垣」の直営など、多様な現場で事業立ち上げと経営改善を実践。
・コア方針: 「経営の仕組み化 × 利益改善」
・基本スタンス: すべてをシステム化するのではなく、人が担うべきことと仕組みで効率化すべきことを見極め、中小企業が無理なく運用・自走できる形に落とし込む。`;

export const DEFAULT_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: 'mst-default-company-profile',
    title: '有限会社MST 会社概要・代表方針・強み（公式HPベース）',
    category: 'business',
    tags: ['MST', '会社概要', '代表方針', '強み', '公式HP'],
    knowledgeAccess: { scope: 'all', roleIds: [] },
    createdAt: BASE_TIMESTAMP,
    updatedAt: BASE_TIMESTAMP,
    content: `${COMPANY_PROFILE_CONTENT_V1}

■ 有限会社MSTの最大の強み・原点
1. これまで自社で「自分のため」に実践・検証してきた仕組みそのもの
・外部の理論や評論ではなく、自社グループ・直営現場（Web、店舗サロン、介護保険外サービス等）を実際に成長させるために「自分のため」に作り込み、使い倒してきた営業・業務・数値・AI活用の仕組みをそのまま提供できること。
2. お客様と「一緒に会社を成長させていく」伴走姿勢
・一方的にやり方を押し付けるのではなく、経営者と同じ目線に立ち、試行錯誤しながら一緒に会社を成長させていくパートナーであること。
3. 「この領域では必ず役に立てる」という熱い想いと確信
・経営の仕組み化・利益改善・現場のDX/AI定着という領域において、実体験に裏打ちされた「必ずお役に立てる」という強い情熱と責任感を持って向き合うこと。`,
  },
  {
    id: 'mst-default-services-overview',
    title: 'MST 主力4サービスと導入ステップ（公式HP・LPベース）',
    category: 'product',
    tags: ['主力サービス', '顧問', 'システム構築', 'マーケティング', '公式HP'],
    knowledgeAccess: { scope: 'all', roleIds: [] },
    createdAt: BASE_TIMESTAMP + 1000,
    updatedAt: BASE_TIMESTAMP + 1000,
    content: `■ 主力4サービス
01. 経営戦略・利益改善顧問（経営・粗利改善）
・社長の右腕として案件別・現場別の粗利管理や採算構造を可視化し、経営面と現場改善を一体で伴走する総合型顧問。
02. 業務改善・IT・DX・AI顧問（属人化・業務標準化）
・業務の棚卸し・標準化と、Google Workspace・身の丈クラウドツール・生成AIの実務定着を継続支援。
03. システム構築・業務自動化（手作業・二重転記の削減）
・スプレッドシート/GAS、専用Webアプリ、API連携を内製で直接実装。使われない機能を作らず小さく速く構築。
04. マーケティング戦略・集客導線構築（自社集客・LINE自動化）
・ターゲット言語化、HP/LP、LINEステップ配信、メール育成、商談導線を設計・構築しポータル/紹介依存から脱却。

■ 契約・提供上の重要ルール
・「助言・設計中心の顧問」と「具体的な開発・制作作業（構築）」は対象範囲と費用を明確に区分して提案する。
・導入の標準ステップ: (1)3分無料診断・ヒアリング → (2)ボトルネック特定 → (3)改善方針・ロードマップ提案 → (4)顧問または構築着手 → (5)現場定着・月次自走化。`,
  },
  {
    id: 'mst-default-care-and-newbiz',
    title: '新規事業支援・介護保険外開業パッケージ・商品テンプレート（LPベース）',
    category: 'product',
    tags: ['新規事業', '介護保険外', '開業パッケージ', 'アシスタ大垣', 'LP'],
    knowledgeAccess: { scope: 'all', roleIds: [] },
    createdAt: BASE_TIMESTAMP + 2000,
    updatedAt: BASE_TIMESTAMP + 2000,
    content: `■ 関連サービス・専門商品
05. 新規事業の企画・立ち上げ・仕組み化支援
・既存リソースを活かした第2の収益の柱づくりを6ステップ（市場・顧客整理→商品設計→収益/BEP設計→集客販売導線→運営マニュアル→システム化）で伴走。

06. 介護保険外サービス開業パッケージ（専用LP: https://business.mstcorp.info/）
・直営事業「アシスタ大垣」の実証ノウハウを凝縮した独立開業支援の専門商品（一般顧問とは別体系）。
・4つの柱: (1)事業設計・料金表・利用規約/同意書等の法的実務基盤、(2)実績あるWeb・LP・チラシ・ケアマネ向け営業スクリプト、(3)顧客カルテ・受付・請求統合システム、(4)代表による開業運営伴走サポート。

■ 公式HP掲載の商品・ツール群
・介護保険外サービス開業 実務運営規約・同意書一式（提供中）
・中小企業向け 業務棚卸し・属人化解消チェックリスト（開発中）
・案件別 採算・粗利管理スプレッドシート（自動計算GAS付き／開発中）
・ChatGPT・生成AI 実務導入プロンプトテンプレート集（提供予定）`,
  },
  {
    id: 'mst-default-target-industries',
    title: '重点5業種別の課題とMST解決策（公式HP・営業標準）',
    category: 'customer',
    tags: ['重点5業種', '工事業', '店舗サービス業', '清掃・保守業', '介護・福祉業', '専門請負業'],
    knowledgeAccess: { scope: 'all', roleIds: [] },
    createdAt: BASE_TIMESTAMP + 3000,
    updatedAt: BASE_TIMESTAMP + 3000,
    content: `■ 重点5業種（公式HP基準）と代表的な課題・解決方針
1. 工事業（建設・設備・リフォーム等）
・課題: 案件別粗利が月末まで見えない／材料費・外注費・工数の分散／見積〜請求の二重入力。
・解決: 案件別原価・粗利のリアルタイム可視化と見積〜請求データ連携。

2. 店舗サービス業（エステ・美容・整体・ジム等）
・課題: ポータル手数料が重い／LINEフォロー未整備／店舗・スタッフ別採算の属人化。
・解決: 自社Web・LINE自動追客導線の構築とリピート率・LTV改善（代表直営サロンの実体験ベース）。

3. 清掃・保守業（ビル清掃・メンテ・設備点検）
・課題: 定期契約とスポット配置が煩雑／現場別採算不明／紙報告と請求のタイムラグ。
・解決: 定期契約・人員稼働の一元管理とスマホ作業報告→請求連動。

4. 介護・福祉業（訪問系・生活支援）
・課題: シフト・稼働逼迫／事務作業過多／制度改正に左右されない第2の収益の柱不足。
・解決: 業務標準化・効率化と介護保険外生活支援パッケージでの新規柱づくり。

5. 専門請負業（造園・害虫駆除・特殊清掃等）
・課題: 見積・原価計算の社長依存／手順の属人化／保守・点検履歴の未継承。
・解決: 見積・原価ロジック標準化と顧客・案件台帳の一元管理。`,
  },
  {
    id: 'mst-default-os-workflow',
    title: 'MST経営OS 機能構成と業務フロー（OS運用前提）',
    category: 'business',
    tags: ['経営OS', 'CRM', '診断', '提案書', 'LINE', 'メール', 'HP連携'],
    knowledgeAccess: { scope: 'all', roleIds: [] },
    createdAt: BASE_TIMESTAMP + 4000,
    updatedAt: BASE_TIMESTAMP + 4000,
    content: `■ MST経営OSの主な業務フロー
1. 集客・反響受付: 公式HP/LP・問い合わせフォーム・3分経営ボトルネック診断・LINE公式・TimeRex予約から受信トレイへ集約し、会社・担当者・見込み顧客・反響リードへ連携。
2. 商談・診断・提案: 診断結果（4分類の急所判定）と商談ヒアリングをもとに、診断レポートおよび提案書（構築／伴走／構築+伴走）を作成・承認・共有。
3. 契約・請求・支援実行: 電子契約・請求書作成（PDF/送付・消込）と、契約後タスク・プロジェクト管理を連動。
4. 自動配信・CRM追客: ターゲットリスト・個別選択・直接アドレス入力によるメール/LINE一斉配信、およびシナリオステップ自動配信を運用。
5. 公式HP/メディア連携: 商品・ツール掲載や記事公開、AI社長・9種類の専門役割AI・社内ナレッジ保管庫が全体を支援。`,
  },
];

export const DEFAULT_KNOWLEDGE_ID_PREFIX = 'mst-default-';

/**
 * 既存一覧にまだ公式デフォルトナレッジが1件も入っていない場合は不足分を補完する。
 * また、既存の「会社概要(v1)」が未編集のまま残っている場合のみ強み追記版(v2)へ安全に更新する。
 * ユーザーが意図的に削除・編集した項目はそのまま尊重する。
 */
export function seedMissingDefaultKnowledge(existingItems: KnowledgeItem[]): KnowledgeItem[] {
  const latestProfile = DEFAULT_KNOWLEDGE_ITEMS[0];
  const hasAnyOfficialDefault = existingItems.some((item) => item.id.startsWith(DEFAULT_KNOWLEDGE_ID_PREFIX));
  if (hasAnyOfficialDefault) {
    let changed = false;
    const upgraded = existingItems.map((item) => {
      if (item.id === latestProfile.id && item.content === COMPANY_PROFILE_CONTENT_V1) {
        changed = true;
        return {
          ...item,
          title: latestProfile.title,
          tags: [...latestProfile.tags],
          content: latestProfile.content,
          embedding: undefined,
          updatedAt: Date.now(),
        };
      }
      return item;
    });
    return changed ? upgraded : existingItems;
  }
  const existingIds = new Set(existingItems.map((item) => item.id));
  const missing = DEFAULT_KNOWLEDGE_ITEMS
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({ ...item, tags: [...item.tags], knowledgeAccess: item.knowledgeAccess ? { ...item.knowledgeAccess } : undefined }));
  return [...existingItems, ...missing];
}

/**
 * 明示的な「公式HP・OS初期ナレッジを取り込む / 最新化する」操作用。
 * 既存のユーザー独自ナレッジは保持し、公式デフォルトIDは最新内容へ追加・更新する。
 */
export function upsertOfficialDefaultKnowledge(existingItems: KnowledgeItem[]): {
  items: KnowledgeItem[];
  addedCount: number;
  updatedCount: number;
} {
  const now = Date.now();
  const byId = new Map(existingItems.map((item) => [item.id, item]));
  let addedCount = 0;
  let updatedCount = 0;

  for (const def of DEFAULT_KNOWLEDGE_ITEMS) {
    const current = byId.get(def.id);
    if (!current) {
      byId.set(def.id, {
        ...def,
        tags: [...def.tags],
        knowledgeAccess: def.knowledgeAccess ? { ...def.knowledgeAccess } : undefined,
        createdAt: now,
        updatedAt: now,
      });
      addedCount += 1;
    } else if (
      current.title !== def.title ||
      current.content !== def.content ||
      current.category !== def.category
    ) {
      byId.set(def.id, {
        ...current,
        title: def.title,
        category: def.category,
        content: def.content,
        tags: [...def.tags],
        knowledgeAccess: current.knowledgeAccess ?? (def.knowledgeAccess ? { ...def.knowledgeAccess } : undefined),
        embedding: undefined,
        updatedAt: now,
      });
      updatedCount += 1;
    }
  }

  // Keep user-created items first in existing order, followed by newly added defaults
  const orderedIds = existingItems.map((item) => item.id);
  const result: KnowledgeItem[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) {
      result.push(item);
      byId.delete(id);
    }
  }
  for (const remaining of byId.values()) {
    result.push(remaining);
  }
  return { items: result, addedCount, updatedCount };
}
