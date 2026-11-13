/**
 * マーケティング自動配信およびジョブリトライ・送信条件判定の共通ユーティリティ
 */

export interface SendTimeWindowCheck {
  allowed: boolean;
  nextDueAt?: string;
}

/**
 * 送信時間帯（例: "09:00-18:00"）をJST（Asia/Tokyo）基準で判定。
 * 時間帯外の場合は、次回送信可能となる直近の開始時刻（ISO形式）を返却。
 */
export function checkSendTimeWindow(
  windowStr: string | null | undefined,
  now: Date = new Date()
): SendTimeWindowCheck {
  if (!windowStr || typeof windowStr !== 'string' || !windowStr.trim()) {
    return { allowed: true };
  }
  const match = windowStr.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { allowed: true };
  }

  const startHour = parseInt(match[1], 10);
  const startMinute = parseInt(match[2], 10);
  const endHour = parseInt(match[3], 10);
  const endMinute = parseInt(match[4], 10);

  if (
    startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59 ||
    endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59
  ) {
    return { allowed: true };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get('minute'), 10);

  const currentMins = hour * 60 + minute;
  const startMins = startHour * 60 + startMinute;
  const endMins = endHour * 60 + endMinute;

  let isAllowed = false;
  let nextStartDayOffset = 0;

  if (startMins <= endMins) {
    // 同一日の時間帯（例: 09:00 - 18:00）
    if (currentMins >= startMins && currentMins < endMins) {
      isAllowed = true;
    } else if (currentMins < startMins) {
      nextStartDayOffset = 0;
    } else {
      nextStartDayOffset = 1;
    }
  } else {
    // 日跨ぎの時間帯（例: 22:00 - 06:00）
    if (currentMins >= startMins || currentMins < endMins) {
      isAllowed = true;
    } else {
      nextStartDayOffset = 0;
    }
  }

  if (isAllowed) {
    return { allowed: true };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const targetDate = new Date(Date.UTC(year, month - 1, day + nextStartDayOffset));
  const tYear = targetDate.getUTCFullYear();
  const tMonth = pad(targetDate.getUTCMonth() + 1);
  const tDay = pad(targetDate.getUTCDate());

  const jstIso = `${tYear}-${tMonth}-${tDay}T${pad(startHour)}:${pad(startMinute)}:00+09:00`;
  const nextDueDate = new Date(jstIso);

  return {
    allowed: false,
    nextDueAt: nextDueDate.toISOString(),
  };
}

/**
 * 待機分数（waitMinutes）と任意の配信希望時刻（JST "HH:mm"）から、配信予定時刻（ISO形式）を計算する。
 * - 待機日数（1日単位）が1日以上のステップは、N日後の希望時刻（JST）に予約する。
 * - 待機分数が0分（即時）で applyPreferredOnZeroWait=true の場合は、当日の希望時刻（過ぎていれば翌日の希望時刻）に予約する。
 */
export function calculateDueAt(
  waitMinutes: number,
  preferredSendTime?: string | null,
  now: Date = new Date(),
  options: { applyPreferredOnZeroWait?: boolean } = {}
): string {
  const safeWait = Math.max(0, Number(waitMinutes) || 0);
  const fallbackIso = () => new Date(now.getTime() + safeWait * 60 * 1000).toISOString();

  if (typeof preferredSendTime !== 'string' || !preferredSendTime.trim()) {
    return fallbackIso();
  }
  const match = preferredSendTime.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return fallbackIso();
  }

  const prefHour = parseInt(match[1], 10);
  const prefMinute = parseInt(match[2], 10);
  if (prefHour < 0 || prefHour > 23 || prefMinute < 0 || prefMinute > 59) {
    return fallbackIso();
  }

  if (safeWait === 0 && !options.applyPreferredOnZeroWait) {
    return fallbackIso();
  }
  if (safeWait > 0 && safeWait % 1440 !== 0) {
    return fallbackIso();
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10);
  const day = parseInt(get('day'), 10);
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(get('minute'), 10);

  let dayOffset = Math.round(safeWait / 1440);
  if (safeWait === 0 && options.applyPreferredOnZeroWait) {
    const currentMins = hour * 60 + minute;
    const prefMins = prefHour * 60 + prefMinute;
    dayOffset = currentMins <= prefMins ? 0 : 1;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const targetDate = new Date(Date.UTC(year, month - 1, day + dayOffset));
  const tYear = targetDate.getUTCFullYear();
  const tMonth = pad(targetDate.getUTCMonth() + 1);
  const tDay = pad(targetDate.getUTCDate());
  const jstIso = `${tYear}-${tMonth}-${tDay}T${pad(prefHour)}:${pad(prefMinute)}:00+09:00`;
  return new Date(jstIso).toISOString();
}

/**
 * 配信停止（opted_out）などの送信除外条件を判定
 */
export function shouldSkipAutomationDelivery(
  channel: 'email' | 'line' | string,
  contact: {
    email?: string | null;
    email_consent_status?: string | null;
    line_user_id?: string | null;
  } | null | undefined
): { skip: boolean; reason?: string } {
  if (!contact) {
    return { skip: true, reason: '連絡先情報が存在しません。' };
  }

  if (channel === 'email') {
    if (contact.email_consent_status === 'opted_out') {
      return { skip: true, reason: 'メール配信停止済み（opted_out）のためスキップ' };
    }
    if (!contact.email || !contact.email.includes('@')) {
      return { skip: true, reason: '有効なメールアドレスが登録されていません。' };
    }
  }

  if (channel === 'line') {
    if (!contact.line_user_id || !contact.line_user_id.trim()) {
      return { skip: true, reason: 'LINE User IDが未連携のためスキップ' };
    }
  }

  return { skip: false };
}

/**
 * 指数バックオフによる次回リトライ遅延（ミリ秒）およびリトライ可否を計算
 * 仕様：1回目 = 1分後, 2回目 = 5分後, 3回目 = 15分後、3回超過は失敗 (failed)
 */
export function calculateExponentialBackoff(
  currentRetryCount: number,
  maxRetries: number = 3
): {
  canRetry: boolean;
  nextRetryCount: number;
  delayMs: number;
  delayMinutes: number;
  nextDueAt?: string;
} {
  const current = Math.max(0, Number(currentRetryCount) || 0);
  if (current >= maxRetries) {
    return {
      canRetry: false,
      nextRetryCount: current,
      delayMs: 0,
      delayMinutes: 0,
    };
  }

  const nextRetryCount = current + 1;
  let delayMinutes = 1;
  if (nextRetryCount === 1) {
    delayMinutes = 1; // 1分後
  } else if (nextRetryCount === 2) {
    delayMinutes = 5; // 5分後
  } else {
    delayMinutes = 15; // 15分後
  }

  const delayMs = delayMinutes * 60 * 1000;
  const nextDueAt = new Date(Date.now() + delayMs).toISOString();

  return {
    canRetry: true,
    nextRetryCount,
    delayMs,
    delayMinutes,
    nextDueAt,
  };
}
