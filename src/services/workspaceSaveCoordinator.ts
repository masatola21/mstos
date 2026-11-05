import { WorkspaceData, saveWorkspaceData, isWorkspaceConflictError, SaveWorkspaceResult } from './workspaceStateService';
import { matrixService } from './matrixService';

export type WorkspaceSyncStatus = 'loading' | 'saving' | 'saved' | 'error' | 'conflict';

export interface CoordinatorListener {
  onStatusChange?: (status: WorkspaceSyncStatus, errorMessage?: string) => void;
  onMergedData?: (mergedData: WorkspaceData, savingData: WorkspaceData) => void;
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
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedSnapshot: string = '';
  private syncStatus: WorkspaceSyncStatus = 'loading';
  private syncError: string = '';
  private isConflictStopped = false;
  private listeners = new Set<CoordinatorListener>();

  public setInitialSavedSnapshot(data: WorkspaceData) {
    try {
      this.lastSavedSnapshot = JSON.stringify(data);
    } catch {
      this.lastSavedSnapshot = '';
    }
    this.isConflictStopped = false;
    this.setStatus('saved');
  }

  public getStatus(): WorkspaceSyncStatus {
    return this.syncStatus;
  }

  public getError(): string {
    return this.syncError;
  }

  public isStopped(): boolean {
    return this.isConflictStopped;
  }

  /**
   * ログアウトやユーザー切替時の完全リセット
   */
  public reset(): void {
    this.cancelDebounce();
    this.pendingUserId = null;
    this.pendingData = null;
    this.pendingDeferreds.forEach((d) => d.reject(new Error('User logged out or switched')));
    this.pendingDeferreds = [];
    this.lastSavedSnapshot = '';
    this.syncStatus = 'loading';
    this.syncError = '';
    this.isConflictStopped = false;
  }

  /**
   * ユーザーの再同期操作等で競合停止を解除する
   */
  public resetConflict(): void {
    this.isConflictStopped = false;
    this.syncStatus = 'saved';
    this.syncError = '';
    this.listeners.forEach((l) => l.onStatusChange?.('saved', ''));
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

  private notifyMergedData(mergedData: WorkspaceData, savingData: WorkspaceData) {
    this.listeners.forEach((l) => l.onMergedData?.(mergedData, savingData));
  }

  /**
   * 自動保存用：debounceタイマーを経て保存をリクエストする。
   * 競合発生中（conflictStopped）は自動保存を停止（有界化）。
   */
  public requestDebouncedSave(
    userId: string,
    getData: () => WorkspaceData,
    delayMs = 700
  ): void {
    // 競合停止中なら自動保存を行わない
    if (this.isConflictStopped) {
      return;
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.isConflictStopped) return;
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
      clearTimeout(this.debounceTimer);
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
    if (this.isConflictStopped) {
      deferred?.reject(new Error('WORKSPACE_CONFLICT: 自動保存は停止されています。再読み込みしてください。'));
      return;
    }

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

      // 競合自動マージが発生した場合は、マージ前（data）とマージ後（result.savedData）の両方をUIに通知
      if (result.wasMerged) {
        this.notifyMergedData(result.savedData, data);
      }

      currentDeferreds.forEach((d) => d.resolve(result));
    } catch (error) {
      console.error('[WorkspaceSaveCoordinator] Cloud save failed:', error);

      const errorCode = (error as { code?: string })?.code;
      const errorMessage = (error as { message?: string })?.message || '';

      if (isWorkspaceConflictError(error)) {
        // 自動マージ上限を超えて競合が解消しなかった場合は自動保存を停止（有界化）
        this.isConflictStopped = true;
        this.pendingData = null; // 保留中のリクエストも破棄
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

      // 競合停止されていない場合で、実行中に新たな変更がペンディングされていたら次を実行
      if (!this.isConflictStopped && this.pendingData && this.pendingUserId) {
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

        this.executeSave(nextUserId, nextData, nextSnapshot);
      }
    }
  }

  public cancelDebounce() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const workspaceSaveCoordinator = new WorkspaceSaveCoordinator();
