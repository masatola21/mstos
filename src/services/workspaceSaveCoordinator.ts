import { WorkspaceData, saveWorkspaceData, isWorkspaceConflictError, isNonRetryableFatalError, isJwtExpiredError, SaveWorkspaceResult } from './workspaceStateService';
import { matrixService } from './matrixService';
import { mergeCollectionPreservingUserEdits } from '../utils/workspaceMergeUtils';

export type WorkspaceSyncStatus = 'loading' | 'saving' | 'saved' | 'error' | 'conflict';

export interface CoordinatorListener {
  onStatusChange?: (status: WorkspaceSyncStatus, errorMessage?: string) => void;
  onMergedData?: (mergedData: WorkspaceData, savingData: WorkspaceData) => void;
}

export type WorkspaceSaveFn = (
  userId: string,
  data: WorkspaceData,
  options?: { maxConflictRetries?: number }
) => Promise<SaveWorkspaceResult>;

interface QueuedDeferred {
  resolve: (result: SaveWorkspaceResult) => void;
  reject: (error: unknown) => void;
}

export class WorkspaceSaveCoordinator {
  private saveFn: WorkspaceSaveFn;
  private isSaving = false;
  private inFlightSnapshot: string = '';
  private inFlightWaiters: QueuedDeferred[] = [];
  private pendingUserId: string | null = null;
  private pendingData: WorkspaceData | null = null;
  private pendingDeferreds: QueuedDeferred[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSavedSnapshot: string = '';
  private syncStatus: WorkspaceSyncStatus = 'loading';
  private syncError: string = '';
  private isConflictStopped = false;
  private consecutiveErrorCount = 0;
  private lastLoggedErrorKey = '';
  private lastLoggedErrorTime = 0;
  private suppressedErrorCount = 0;
  private listeners = new Set<CoordinatorListener>();

  constructor(saveFn: WorkspaceSaveFn = saveWorkspaceData) {
    this.saveFn = saveFn;
  }

  public setInitialSavedSnapshot(data: WorkspaceData) {
    try {
      this.lastSavedSnapshot = JSON.stringify(data);
    } catch {
      this.lastSavedSnapshot = '';
    }
    this.isConflictStopped = false;
    this.consecutiveErrorCount = 0;
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

  public getConsecutiveErrorCount(): number {
    return this.consecutiveErrorCount;
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
    this.inFlightWaiters.forEach((d) => d.reject(new Error('User logged out or switched')));
    this.inFlightWaiters = [];
    this.lastSavedSnapshot = '';
    this.inFlightSnapshot = '';
    this.syncStatus = 'loading';
    this.syncError = '';
    this.isConflictStopped = false;
    this.consecutiveErrorCount = 0;
  }

  /**
   * ユーザーの再同期操作等で競合停止を解除する
   */
  public resetConflict(): void {
    this.isConflictStopped = false;
    this.consecutiveErrorCount = 0;
    this.syncStatus = 'saved';
    this.syncError = '';
    this.listeners.forEach((l) => l.onStatusChange?.('saved', ''));
  }

  /**
   * 競合エラー検知時または連続エラー時に自動保存を強制停止し、手動リロードを促す状態にする
   */
  public haltOnConflict(message = '他の端末で更新されました。再読み込みしてください'): void {
    this.cancelDebounce();
    this.isConflictStopped = true;
    this.pendingData = null;
    this.pendingUserId = null;
    this.setStatus('conflict', message);
  }

  private logCloudSaveError(error: unknown): void {
    const errCode = (error as { code?: string })?.code;
    const errMsg = (error as { message?: string })?.message || String(error);
    const key = `${errCode || ''}:${errMsg}`;
    const now = Date.now();
    if (this.lastLoggedErrorKey === key && now - this.lastLoggedErrorTime < 30000) {
      this.suppressedErrorCount++;
      return;
    }
    if (this.suppressedErrorCount > 0) {
      console.warn(`[WorkspaceSaveCoordinator] Suppressed ${this.suppressedErrorCount} duplicate consecutive save errors.`);
    }
    this.lastLoggedErrorKey = key;
    this.lastLoggedErrorTime = now;
    this.suppressedErrorCount = 0;
    console.error('[WorkspaceSaveCoordinator] Cloud save failed:', error);
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
    if (this.isConflictStopped) {
      return Promise.reject(new Error('WORKSPACE_CONFLICT: 自動保存は停止されています。再読み込みしてください。'));
    }

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

    if (this.isSaving) {
      // 指摘4・再指摘A対応: 保存実行中は現在保存中の inFlightSnapshot と比較する
      if (snapshot === this.inFlightSnapshot && !hasPendingDeletions) {
        // 現在のユーザー状態が保存実行中の内容と同一
        // 1. キュー済みの pendingData と pendingUserId を破棄して S2 を抑止
        this.pendingData = null;
        this.pendingUserId = null;
        // 2. pendingDeferreds にあるものを inFlightWaiters へ移す
        this.inFlightWaiters.push(...this.pendingDeferreds);
        this.pendingDeferreds = [];
        // 3. 今回の deferred も inFlightWaiters に積む
        if (deferred) {
          this.inFlightWaiters.push(deferred);
        }
        return;
      }

      // 実行中と異なる場合（例: A -> B(保存中) -> A と元に戻した場合、または C への新規変更）：
      // lastSavedSnapshot と一致していても、実行中(B)と異なるため enqueue する
      this.pendingUserId = userId;
      this.pendingData = data;
      if (deferred) {
        this.pendingDeferreds.push(deferred);
      }
      return;
    }

    if (snapshot === this.lastSavedSnapshot && !hasPendingDeletions) {
      // 変更なし：即時成功として返す
      deferred?.resolve({ savedData: data, wasMerged: false });
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
    this.inFlightSnapshot = snapshot;
    this.setStatus('saving');

    const currentDeferreds = [...this.pendingDeferreds];
    this.pendingDeferreds = [];
    let saveHadError = false;

    try {
      const result = await this.saveFn(userId, data, { maxConflictRetries: 3 });

      this.consecutiveErrorCount = 0;

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

        // S1実行中にキューイングされた pendingData をマージ結果へ再基底化
        // これにより他端末の新規追加レコード等がS2によって上書き消失するのを防止
        if (this.pendingData) {
          this.pendingData = {
            ...this.pendingData,
            products: mergeCollectionPreservingUserEdits(this.pendingData.products, data.products, result.savedData.products),
            contracts: mergeCollectionPreservingUserEdits(this.pendingData.contracts, data.contracts, result.savedData.contracts),
            invoices: mergeCollectionPreservingUserEdits(this.pendingData.invoices, data.invoices, result.savedData.invoices),
            tools: mergeCollectionPreservingUserEdits(this.pendingData.tools, data.tools, result.savedData.tools),
            customLists: mergeCollectionPreservingUserEdits(this.pendingData.customLists, data.customLists, result.savedData.customLists),
            marketingScenarios: mergeCollectionPreservingUserEdits(this.pendingData.marketingScenarios, data.marketingScenarios, result.savedData.marketingScenarios),
          };
        }
      }

      currentDeferreds.forEach((d) => d.resolve(result));
      const currentWaiters = [...this.inFlightWaiters];
      this.inFlightWaiters = [];
      currentWaiters.forEach((d) => d.resolve(result));
    } catch (error) {
      saveHadError = true;
      this.consecutiveErrorCount++;
      this.logCloudSaveError(error);

      const errorCode = (error as { code?: string })?.code;
      const errorMessage = (error as { message?: string })?.message || '';
      const isConflict = isWorkspaceConflictError(error);
      const isFatal = isNonRetryableFatalError(error);
      const isExpired = isJwtExpiredError(error);
      const shouldHalt = isConflict || isFatal || isExpired || this.consecutiveErrorCount >= 3;

      if (shouldHalt) {
        // 競合エラー、直らない致命的エラー（認証/形式）、JWT期限切れ、または連続エラー上限（3回）に達した場合は自動保存を完全停止し再読み込みを促す
        this.cancelDebounce();
        this.isConflictStopped = true;
        this.pendingData = null; // 保留中のリクエストを破棄
        this.pendingUserId = null;

        // 待機中のすべての deferred を即座に reject して固まりを防止
        const remainingDeferreds = [...this.pendingDeferreds];
        this.pendingDeferreds = [];
        remainingDeferreds.forEach((d) => d.reject(error));

        const conflictWaiters = [...this.inFlightWaiters];
        this.inFlightWaiters = [];
        conflictWaiters.forEach((d) => d.reject(error));

        if (isFatal || isExpired) {
          const rawStatus = (error as any)?.status ?? (error as any)?.code;
          const isAuth =
            isExpired ||
            rawStatus === 401 ||
            rawStatus === '401' ||
            rawStatus === 403 ||
            rawStatus === '403' ||
            errorCode === '42501' ||
            /permission denied|not authorized|権限がありません|User mismatch/i.test(`${errorMessage}`);
          const fatalMsg = isAuth
            ? (isExpired
                ? 'セッションの有効期限が切れました。再ログインまたは再読み込みしてください。'
                : 'ユーザーの業務データを更新する権限がありません。再ログインまたは再読み込みしてください。')
            : '保存データの形式エラーが発生しました。再読み込みしてください。';
          this.setStatus('conflict', fatalMsg);
        } else {
          this.setStatus('conflict', '他の端末で更新されました。再読み込みしてください');
        }
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
      const remainingWaiters = [...this.inFlightWaiters];
      this.inFlightWaiters = [];
      remainingWaiters.forEach((d) => d.reject(error));
    } finally {
      this.isSaving = false;
      this.inFlightSnapshot = '';

      // 競合停止中または保存失敗時は、finally から即座に再保存を実行しない（無限ループ・CPU高騰の防止）
      if (this.isConflictStopped) {
        this.pendingData = null;
        this.pendingUserId = null;
      } else if (!saveHadError && this.consecutiveErrorCount === 0 && this.pendingData && this.pendingUserId) {
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
