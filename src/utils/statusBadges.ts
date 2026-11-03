/**
 * MST AI経営OS 共通ステータスバッジスタイル定義
 * 添付プロトタイプに準拠したカラーリング
 */
export function getStatusBadgeClass(status: string | null | undefined): string {
  const s = String(status || '').trim();
  if (!s) return 'bg-slate-100 text-slate-600 border-slate-200';

  // 成功・受注・成約・締結・有効（緑）
  if (/^(成約|受注|締結|締結済み|有効|完了|レポート発行|レポート発行済|回答完了|公開中|配信中|有)$/.test(s)) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-semibold';
  }

  // 進行中・提案済・商談中・新規（MSTパープル）
  if (/^(商談|商談中|商談化|進行中|提案済|新規|アプローチ中|作成中|準備中|友だち)$/.test(s)) {
    return 'bg-purple-50 text-purple-700 border-purple-200/80 font-semibold';
  }

  // 検討中・確認待ち・未対応・追客中・注意（黄・アンバー）
  if (/^(検討中|確認待ち|未確認|未着手|追客中|診断希望|診断案内済み|承認待ち|保留|確認中|修正依頼)$/.test(s)) {
    return 'bg-amber-50 text-amber-800 border-amber-200/80 font-semibold';
  }

  // 失注・見送り・取消・ブロック・エラー（赤・ローズ）
  if (/^(失注|見送り|取消|ブロック|解除|期限切れ|未完了|無効)$/.test(s)) {
    return 'bg-rose-50 text-rose-700 border-rose-200/80 font-semibold';
  }

  // 下書き・未設定・通常（グレー）
  return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
}
