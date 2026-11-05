import { WorkspaceData, saveWorkspaceData, isWorkspaceConflictError, SaveWorkspaceResult } from './workspaceStateService';
import { matrixService } from './matrixService';

export type WorkspaceSyncStatus = 'loading' | 'saving' | 'saved' | 'error' | 'conflict';

export interface CoordinatorListener {
  onStatusChange?: (status: WorkspaceSyncStatus, errorMessage?: string) => void;
  onMergedData?: (mergedData: WorkspaceData) => void;
}

interface QueuedDeferred {
  resolve: (result: SaveWorkspaceResult) => void;
  reject: (error: unknown) => void;
}

class WorkspaceSaveCoordinator {
  private isSaving = false;
  private pendingUserId: string | null = null;
  private pendingData: WorkspaceData | null = null;
  private pendingDeferreds: QueuedDeferred[] = [];
  private debounceTimer: number | null = null;
  private lastSavedSnapshot: string = '';
  private syncStatus: WorkspaceSyncStatus = 'loading';
  private syncError: string = '';
  private listeners = new Set<CoordinatorListener>();

  public setInitialSavedSnapshot(data: WorkspaceData) {
    try {
      this.lastSavedSnapshot = JSON.stringify(data);
    } catch {
      this.lastSavedSnapshot = '';
    }
    this.setStatus('saved');
  }

  public getStatus(): WorkspaceSyncStatus {
    return this.syncStatus;
  }

  public getError(): string {
    return this.syncError;
  }

  public addListener(listener: CoordinatorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: WorkspaceSyncStatus, errorMessage: string = '') {
    this.syncStatus = status;
    this.syncError = errorMessage;
    this.listeners.forEach((l) => l.onStatusChange?.(status, errorMessage));
  }

  private notifyMergedData(mergedData: WorkspaceData) {
    this.listeners.forEach((l) => l.onMergedData?.(mergedData));
  }

  /**
   * 自動保存用：debounceタイマーを経て保存をリクエストする。
   * 連続したstate更新があっても、タイマーが発火するまでJSON.stringifyなどの重い比較は行わない。
   */
  public requestDebouncedSave(
    userId: string,
    getData: () => WorkspaceData,
    delayMs = 700
  ): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      const data = getData();
      this.enqueueSave(userId, data);
    }, delayMs);
  }

  /**
   * 手動削除や即時保存用：debounceを待たずに即時実行キューへ投入する。
   * 呼び出し元は保存の完了（または失敗）をawaitできる。
   */
  public requestImmediateSave(
    userId: string,
    data: WorkspaceData
  ): Promise<SaveWorkspaceResult> {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    return new Promise<SaveWorkspaceResult>((resolve, reject) => {
      this.enqueueSave(userId, data, { resolve, reject });
    });
  }

  private enqueueSave(
    userId: string,
    data: WorkspaceData,
    deferred?: QueuedDeferred
  ): void {
    // 変更があるか確認（ただし未反映の削除がある場合は必ず保存）
    let snapshot = '';
    try {
      snapshot = JSON.stringify(data);
    } catch {
      snapshot = '';
    }

    const pendingDeletions = matrixService.getPendingDeletions(userId);
    const hasPendingDeletions =
      pendingDeletions.contracts.size > 0 ||
      pendingDeletions.invoices.size > 0 ||
      pendingDeletions.products.size > 0;

    if (snapshot === this.lastSavedSnapshot && !hasPendingDeletions) {
      // 変更なし：即時成功として返す
      deferred?.resolve({ savedData: data, wasMerged: false });
      return;
    }

    if (this.isSaving) {
      // 現在保存処理が実行中：最新データに集約（coalesce）して待機
      this.pendingUserId = userId;
      this.pendingData = data;
      if (deferred) {
        this.pendingDeferreds.push(deferred);
      }
      return;
    }

    // 保存開始
    if (deferred) {
      this.pendingDeferreds.push(deferred);
    }
    this.executeSave(userId, data, snapshot);
  }

  private async executeSave(userId: string, data: WorkspaceData, snapshot: string): Promise<void> {
    this.isSaving = true;
    this.setStatus('saving');

    const currentDeferreds = [...this.pendingDeferreds];
    this.pendingDeferreds = [];

    try {
      const result = await saveWorkspaceData(userId, data, { maxConflictRetries: 2 });

      // 保存成功時のみ lastSavedSnapshot を更新
      try {
        this.lastSavedSnapshot = JSON.stringify(result.savedData);
      } catch {
        this.lastSavedSnapshot = snapshot;
      }

      this.setStatus('saved');

      // 競合自動マージが発生した場合はUIに最新データを通知
      if (result.wasMerged) {
        this.notifyMergedData(result.savedData);
      }

      currentDeferreds.forEach((d) => d.resolve(result));
    } catch (error) {
      console.error('[WorkspaceSaveCoordinator] Cloud save failed:', error);

      const errorCode = (error as { code?: string })?.code;
      const errorMessage = (error as { message?: string })?.message || '';

      if (isWorkspaceConflictError(error)) {
        this.setStatus('conflict', '他の端末で更新されています。再読み込みしてください');
      } else {
        const errorDetails = `${errorMessage} ${(error as { details?: string })?.details || ''} ${(error as { hint?: string })?.hint || ''}`;
        if (errorCode === '23505' && /invoice_number|invoice number|customer_invoices/i.test(errorDetails)) {
          this.setStatus('error', '請求書番号が重複しています。請求番号を確認して再度保存してください。');
        } else if (errorCode === '23505' || /duplicate key|unique constraint/i.test(errorMessage)) {
          this.setStatus('error', '保存時に一意制約の重複が発生しました。重複するデータを確認してください。');
        } else {
          this.setStatus('error', errorMessage ? `クラウド同期に失敗しました: ${errorMessage}` : 'クラウド同期に失敗しました。');
        }
      }

      currentDeferreds.forEach((d) => d.reject(error));
    } finally {
      this.isSaving = false;

      // 実行中に新たな変更がペンディングされていた場合、最新データで直ちに次を実行
      if (this.pendingData && this.pendingUserId) {
        const nextUserId = this.pendingUserId;
        const nextData = this.pendingData;
        this.pendingUserId = null;
        this.pendingData = null;

        let nextSnapshot = '';
        try {
          nextSnapshot = JSON.stringify(nextData);
        } catch {
          nextSnapshot = '';
        }

        // 次の保存を再帰呼び出し
        this.executeSave(nextUserId, nextData, nextSnapshot);
      }
    }
  }

  public cancelDebounce() {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const workspaceSaveCoordinator = new WorkspaceSaveCoordinator();
