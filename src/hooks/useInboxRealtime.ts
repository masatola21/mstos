import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type RealtimeRow = Record<string, any>;

export interface UseInboxRealtimeOptions {
  db: SupabaseClient | null;
  channelName: string;
  table: string;
  /** INSERT通知。未指定なら onSync(false) を呼ぶ */
  onInsert?: (row: RealtimeRow) => void;
  /** UPDATE通知。未指定なら onSync(true) を呼ぶ */
  onUpdate?: (row: RealtimeRow) => void;
  /** DELETE通知（old には主キーのみ入る）。未指定なら onSync(true) を呼ぶ */
  onDelete?: (oldRow: RealtimeRow) => void;
  /**
   * サーバーと同期する。full=true は全件、false は新着の差分のみ。
   * フォールバックのポーリング、再接続時、タブ復帰時に呼ばれる。
   */
  onSync: (full: boolean) => void | Promise<void>;
  /** Realtime未接続のときだけ動くポーリング間隔（既定30秒） */
  fallbackIntervalMs?: number;
  /** この回数ぶん連続で接続エラー/切断が続いたらチャンネルを諦める（再接続ループ防止） */
  maxChannelErrors?: number;
}

const DEFAULT_FALLBACK_INTERVAL_MS = 30_000;
const DEFAULT_MAX_CHANNEL_ERRORS = 3;
/** フォールバック中、何回に1回だけ全件同期するか（残りは差分のみ） */
const FULL_SYNC_EVERY_N_TICKS = 5;
/** タブ復帰時の同期を連打しない最小間隔 */
const MIN_VISIBLE_SYNC_GAP_MS = 5_000;

/**
 * Supabase Realtime を主役にした受信箱の自動更新。
 *
 * - Realtimeが接続できている間は、ポーリングを一切しない（通知を受けて反映するだけ）
 * - 接続できていない間だけ、フォールバックのポーリングを動かす（差分中心）
 * - タブが非表示のあいだはポーリングしない。表示に戻ったら1回だけ同期する
 * - 接続エラーが続く場合は、再接続を繰り返さずチャンネルを閉じてポーリングのみにする
 */
export function useInboxRealtime(options: UseInboxRealtimeOptions): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const { db, channelName, table } = options;
  const fallbackIntervalMs = options.fallbackIntervalMs ?? DEFAULT_FALLBACK_INTERVAL_MS;
  const maxChannelErrors = options.maxChannelErrors ?? DEFAULT_MAX_CHANNEL_ERRORS;

  useEffect(() => {
    if (!db) return;

    let disposed = false;
    let connected = false;
    let lostConnection = false;
    let errorCount = 0;
    let tick = 0;
    let lastSyncAt = 0;

    const runSync = (full: boolean) => {
      lastSyncAt = Date.now();
      try {
        void Promise.resolve(optionsRef.current.onSync(full)).catch(() => {});
      } catch {
        // 同期失敗は次回に任せる
      }
    };

    let channel: ReturnType<SupabaseClient['channel']> | null = db
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
        const handlers = optionsRef.current;
        if (payload.eventType === 'INSERT') {
          if (handlers.onInsert) handlers.onInsert(payload.new);
          else runSync(false);
        } else if (payload.eventType === 'UPDATE') {
          if (handlers.onUpdate) handlers.onUpdate(payload.new);
          else runSync(true);
        } else if (payload.eventType === 'DELETE') {
          if (handlers.onDelete) handlers.onDelete(payload.old);
          else runSync(true);
        }
      })
      .subscribe((status: string) => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          const recovered = lostConnection;
          connected = true;
          errorCount = 0;
          lostConnection = false;
          // 切断中に届かなかった分を取りこぼさないよう、復帰時に1回だけ同期
          if (recovered) runSync(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          connected = false;
          lostConnection = true;
          errorCount += 1;
          if (errorCount >= maxChannelErrors && channel) {
            const toRemove = channel;
            channel = null;
            void db.removeChannel(toRemove);
          }
        }
      });

    const timer = window.setInterval(() => {
      if (connected || document.hidden) return;
      tick += 1;
      runSync(tick % FULL_SYNC_EVERY_N_TICKS === 0);
    }, fallbackIntervalMs);

    const handleVisibility = () => {
      if (document.hidden) return;
      if (Date.now() - lastSyncAt < MIN_VISIBLE_SYNC_GAP_MS) return;
      runSync(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channel) void db.removeChannel(channel);
    };
  }, [db, channelName, table, fallbackIntervalMs, maxChannelErrors]);
}

/**
 * タブが表示されているときだけ一定間隔で callback を呼ぶ。
 * 非表示中は止まり、表示に戻って間隔以上たっていれば1回すぐ実行する。
 */
export function useVisiblePolling(callback: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    let lastRunAt = Date.now();

    const run = () => {
      lastRunAt = Date.now();
      try {
        void Promise.resolve(callbackRef.current()).catch(() => {});
      } catch {
        // 次回に任せる
      }
    };

    const timer = window.setInterval(() => {
      if (!document.hidden) run();
    }, intervalMs);

    const handleVisibility = () => {
      if (!document.hidden && Date.now() - lastRunAt >= intervalMs) run();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled]);
}
