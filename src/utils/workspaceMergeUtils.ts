/**
 * 競合マージ時に保存中のユーザー編集を消失させず、かつ保存中の削除を復活させないマージ関数
 *
 * @param currentState 保存完了時点の最新ローカル状態
 * @param savingState 保存開始時点のスナップショット
 * @param mergedState クラウドと3-wayマージされた結果
 */
export function mergeCollectionPreservingUserEdits<T extends { id: string }>(
  currentState: T[],
  savingState: T[],
  mergedState: T[],
): T[] {
  const savingById = new Map(savingState.map((r) => [r.id, r]));
  const mergedById = new Map(mergedState.map((r) => [r.id, r]));
  const result: T[] = [];
  const processedIds = new Set<string>();

  for (const current of currentState) {
    processedIds.add(current.id);
    const saving = savingById.get(current.id);
    const merged = mergedById.get(current.id);

    if (!saving) {
      // 保存開始後にユーザーが新規追加したレコード -> current を最優先
      result.push(current);
    } else if (JSON.stringify(current) !== JSON.stringify(saving)) {
      // 保存中にユーザーがローカルで編集したレコード -> current を最優先
      result.push(current);
    } else if (merged) {
      // 保存中にローカル変更なし -> リモートとのマージ結果を採用
      result.push(merged);
    }
    // 保存中にローカル変更がなく、リモート側で削除されていた場合は除外（スキップ）
  }

  // リモートで新規追加されたレコードを取り込む
  for (const merged of mergedState) {
    if (!processedIds.has(merged.id)) {
      // 【指摘3対応】保存開始時点に存在していたのに現在ないものは、ユーザーが保存中に削除したため復活させない
      if (savingById.has(merged.id)) {
        continue;
      }
      result.push(merged);
    }
  }

  return result;
}
