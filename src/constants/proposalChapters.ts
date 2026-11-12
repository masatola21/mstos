/**
 * 診断・提案書の章の定義(仕様書「診断・提案書 構成テンプレート仕様書(案)」§3〜§5)。
 *
 * - 他のファイルに依存しない(サーバー・画面・テストのどこからでも読める)。
 * - 画面の表示名はここだけで持つ。DBに入れる値(ProposalKind)は変えない。
 * - 金額・期間・サービス名・有効期限は AI に決めさせない(source に 'ai' を付けない章が決める)。
 */

// ─── 提案の型 ───────────────────────────────────────────────

/** DBに入れる値(proposal_drafts.final_kind / our_assessment / customer_intent) */
export type ProposalKind = 'spot_build' | 'retainer' | 'hybrid';
/** 最終決定は「未定」を持てる。未定のままでは承認も送付もできない。 */
export type FinalProposalKind = ProposalKind | 'undecided';

/** 画面に出す呼び名(2026-11-12 決定: 構築 / 伴走 / 構築+伴走) */
export const PROPOSAL_KIND_LABELS: Record<FinalProposalKind, string> = {
  spot_build: '構築',
  retainer: '伴走',
  hybrid: '構築+伴走',
  undecided: '未定',
};

/** 既存 documentGenerators.ts の PaymentMode と同じ値 */
export type ProposalPaymentMode =
  | 'lump_sum'
  | 'retainer'
  | 'milestone'
  | 'installments_3'
  | 'installments_6'
  | 'hybrid_setup_retainer';

/** 型ごとに選べる支払い方式。先頭が初期値(担当者は上書きできる)。 */
export const PAYMENT_MODES_BY_KIND: Record<ProposalKind, readonly ProposalPaymentMode[]> = {
  spot_build: ['lump_sum', 'installments_3', 'installments_6', 'milestone'],
  retainer: ['retainer'],
  hybrid: ['hybrid_setup_retainer'],
};

export function defaultPaymentModeFor(kind: FinalProposalKind): ProposalPaymentMode | null {
  return kind === 'undecided' ? null : PAYMENT_MODES_BY_KIND[kind][0];
}

export function isPaymentModeAllowed(kind: FinalProposalKind, mode: ProposalPaymentMode): boolean {
  return kind !== 'undecided' && PAYMENT_MODES_BY_KIND[kind].includes(mode);
}

/** 既存の PaymentMode から型を求める(画面は支払い方式を選び、型はそこから決まる) */
export function kindFromPaymentMode(mode: ProposalPaymentMode): ProposalKind {
  if (mode === 'retainer') return 'retainer';
  if (mode === 'hybrid_setup_retainer') return 'hybrid';
  return 'spot_build';
}

/** 有効期限は発行日からこの日数(2026-11-12 決定: 仕様書の例に合わせて30日) */
export const PROPOSAL_VALID_DAYS = 30;

/** "YYYY-MM-DD" に日数を足す(タイムゾーンに左右されないよう UTC で計算) */
export function addDaysToIsoDate(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── 章 ─────────────────────────────────────────────────────

export type ChapterPart = 'cover' | 'diagnosis' | 'proposal' | 'footer';
/** 埋める元。code=判定ロジック/DBの値、ai=下書き生成、human=担当者入力、fixed=固定文または商品マスタ */
export type ChapterSource = 'code' | 'ai' | 'human' | 'fixed';

export interface ChapterDef {
  id: string;
  part: ChapterPart;
  title: string;
  sources: readonly ChapterSource[];
  /** 空欄・不足のときの扱い(仕様書の表の右端) */
  whenMissing: string;
  /** 承認待ちに進む条件に入る章 */
  blocksApproval: boolean;
  /** お客様に送る版に載せるか。D6 は社内用(決定: 載せない) */
  customerVisible: boolean;
}

export const CHAPTERS: readonly ChapterDef[] = [
  { id: 'cover', part: 'cover', title: '表紙', sources: ['code'], whenMissing: '宛先が空なら生成しない', blocksApproval: false, customerVisible: true },
  { id: 'D0', part: 'diagnosis', title: '結論サマリー', sources: ['ai'], whenMissing: '再生成', blocksApproval: false, customerVisible: true },
  { id: 'D1', part: 'diagnosis', title: '診断の前提', sources: ['code', 'fixed'], whenMissing: '未入力の項目は「未回答」と表示', blocksApproval: false, customerVisible: true },
  { id: 'D2', part: 'diagnosis', title: '現状整理', sources: ['ai'], whenMissing: '該当なしは「要ヒアリング」', blocksApproval: false, customerVisible: true },
  { id: 'D3', part: 'diagnosis', title: '特定された急所と根拠', sources: ['code', 'ai'], whenMissing: '根拠のない断定は書かない。「要ヒアリング」', blocksApproval: false, customerVisible: true },
  { id: 'D4', part: 'diagnosis', title: '放置した場合の影響', sources: ['ai'], whenMissing: '章ごと省略可', blocksApproval: false, customerVisible: true },
  { id: 'D5', part: 'diagnosis', title: '改善の方向性', sources: ['ai', 'fixed'], whenMissing: '再生成', blocksApproval: false, customerVisible: true },
  { id: 'D6', part: 'diagnosis', title: '商談で確認すること', sources: ['fixed', 'ai'], whenMissing: '固定の核だけで成立させる', blocksApproval: false, customerVisible: false },
  { id: 'P1', part: 'proposal', title: '提案の型と方針', sources: ['human', 'ai'], whenMissing: '型が「未定」なら承認不可', blocksApproval: true, customerVisible: true },
  { id: 'P2', part: 'proposal', title: '提供内容・成果物', sources: ['fixed', 'human'], whenMissing: '承認不可', blocksApproval: true, customerVisible: true },
  { id: 'P3', part: 'proposal', title: 'ロードマップ', sources: ['human', 'ai'], whenMissing: '承認時に確認必須', blocksApproval: true, customerVisible: true },
  { id: 'P4', part: 'proposal', title: '費用', sources: ['human'], whenMissing: '承認不可', blocksApproval: true, customerVisible: true },
  { id: 'P5', part: 'proposal', title: 'お客様にお願いすること・前提・対象外', sources: ['fixed', 'human'], whenMissing: '共通文で補う', blocksApproval: false, customerVisible: true },
  { id: 'P6', part: 'proposal', title: 'お支払い条件・契約期間', sources: ['human'], whenMissing: '承認不可', blocksApproval: true, customerVisible: true },
  { id: 'P7', part: 'proposal', title: '次のステップ・お申し込み', sources: ['fixed'], whenMissing: '—', blocksApproval: false, customerVisible: true },
  { id: 'footer', part: 'footer', title: '有効期限・免責・発行者情報', sources: ['fixed'], whenMissing: '—', blocksApproval: false, customerVisible: true },
];

export const DIAGNOSIS_CHAPTER_IDS = CHAPTERS.filter((c) => c.part === 'diagnosis').map((c) => c.id);
export const PROPOSAL_CHAPTER_IDS = CHAPTERS.filter((c) => c.part === 'proposal').map((c) => c.id);

export function getChapter(id: string): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

/** お客様に送る版に載せる章(D6 は含まれない) */
export function customerVisibleChapters(): ChapterDef[] {
  return CHAPTERS.filter((c) => c.customerVisible);
}

/** AI が値を決めてはいけない項目(プロンプトの禁止事項と、入力検証の対象) */
export const AI_FORBIDDEN_FIELDS = ['サービス名', '金額', '期間', '支払い条件', '有効期限'] as const;

// ─── 診断レポート(Markdown)を章に分ける ─────────────────────

export interface ParsedChapter {
  id: string;
  title: string;
  body: string;
}

export interface ParsedDiagnosisReport {
  /** D0〜D6 の見出しが1つも見つからない = 旧形式のレポート(固定4見出しの1本の文章) */
  legacy: boolean;
  chapters: ParsedChapter[];
  /** どの章の見出しにも属さない先頭の文章 */
  preamble: string;
}

// 見出しの印(# または ■)が必須。例: "## D2 現状整理" / "### D3. 特定された急所" / "■ D5 改善の方向性"
// 印のない行頭の "D1 は…" は文中の言及として扱い、章にしない。
const CHAPTER_HEADING = /^\s{0,3}(?:#{1,6}\s*|■\s*)(D[0-6])\s*[.．:：\s　]\s*(.*?)\s*$/;

/**
 * 診断レポートを D0〜D6 に分ける。
 * - 章の見出しは、# または ■ で始まり "D0"〜"D6" を含む行。同じ章が2回出たら後の方を無視せず、本文を後ろに足す。
 * - 見出しが1つも無い旧形式は legacy: true で返し、本文は preamble に入れる(呼び出し側が全文を出す)。
 */
export function parseDiagnosisReport(markdown: string): ParsedDiagnosisReport {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const chapters: ParsedChapter[] = [];
  const preamble: string[] = [];
  let current: ParsedChapter | null = null;

  for (const line of lines) {
    const m = CHAPTER_HEADING.exec(line);
    if (m) {
      const existing = chapters.find((c) => c.id === m[1]);
      if (existing) {
        current = existing;
      } else {
        current = { id: m[1], title: m[2] || getChapter(m[1])?.title || m[1], body: '' };
        chapters.push(current);
      }
      continue;
    }
    if (current) current.body += (current.body ? '\n' : '') + line;
    else preamble.push(line);
  }

  for (const c of chapters) c.body = c.body.trim();
  chapters.sort((a, b) => DIAGNOSIS_CHAPTER_IDS.indexOf(a.id) - DIAGNOSIS_CHAPTER_IDS.indexOf(b.id));
  return { legacy: chapters.length === 0, chapters, preamble: preamble.join('\n').trim() };
}

/** 章ごとの表示用データ。足りない章は body が空 = 画面は whenMissing を出す。 */
export function diagnosisChaptersForDisplay(
  parsed: ParsedDiagnosisReport,
  opts: { forCustomer?: boolean } = {},
): Array<{ def: ChapterDef; body: string; missing: boolean }> {
  return CHAPTERS.filter((c) => c.part === 'diagnosis' && (!opts.forCustomer || c.customerVisible)).map((def) => {
    const body = parsed.chapters.find((c) => c.id === def.id)?.body ?? '';
    return { def, body, missing: body === '' };
  });
}

/** 書類(プレーンテキスト欄)に入れるため、Markdown の記号を取り除く。 */
export function markdownToPlainText(md: string): string {
  return String(md ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^(\s*)[-*]\s+/, '$1・').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
