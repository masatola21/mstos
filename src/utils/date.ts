const formatJstDate = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(date);

export const todayJst = () => formatJstDate(new Date());

export const monthJst = () => todayJst().slice(0, 7);

export const dateAfterDaysJst = (days: number) => formatJstDate(new Date(Date.now() + days * 86400000));

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 日付・日時文字列を日本人に分かりやすい「YYYY年M月D日(曜日)」または「YYYY/MM/DD(曜日)」にフォーマット
 */
export function formatJapaneseDate(
  dateInput?: string | Date | null,
  options: {
    includeWeekday?: boolean;
    style?: 'kanji' | 'slash'; // 'kanji' => 2026年11月10日(火), 'slash' => 2026/11/10(火)
  } = {}
): string {
  if (!dateInput) return '';
  const { includeWeekday = true, style = 'kanji' } = options;

  try {
    let date: Date;
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return '';
      // YYYY-MM-DD or YYYY/MM/DD
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
        const parts = trimmed.split(/[-/]/).map(Number);
        date = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        date = new Date(trimmed);
      }
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) return String(dateInput);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = WEEKDAYS_JA[date.getDay()];
    const weekdayStr = includeWeekday ? `(${weekday})` : '';

    if (style === 'slash') {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}/${mm}/${dd}${weekdayStr ? ' ' + weekdayStr : ''}`;
    }

    return `${year}年${month}月${day}日${weekdayStr}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * 日時文字列を「YYYY年M月D日(曜日) HH:mm」または「YYYY/MM/DD(曜日) HH:mm」にフォーマット
 */
export function formatJapaneseDateTime(
  dateInput?: string | Date | null,
  options: {
    includeWeekday?: boolean;
    style?: 'kanji' | 'slash';
    fallbackTime?: string;
  } = {}
): string {
  if (!dateInput) return '';
  const { includeWeekday = true, style = 'kanji', fallbackTime } = options;

  try {
    let date: Date;
    let explicitTime = fallbackTime;

    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return '';

      // YYYY-MM-DD with separate time
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
        const parts = trimmed.split(/[-/]/).map(Number);
        date = new Date(parts[0], parts[1] - 1, parts[2]);
      } else if (trimmed.includes('T') || trimmed.includes(' ')) {
        date = new Date(trimmed);
      } else {
        date = new Date(trimmed);
      }
    } else {
      date = dateInput;
    }

    if (isNaN(date.getTime())) return String(dateInput);

    const dateStr = formatJapaneseDate(date, { includeWeekday, style });
    
    // 時間の取得
    let timeStr = '';
    if (explicitTime) {
      timeStr = ` ${explicitTime}`;
    } else if (typeof dateInput === 'string' && (dateInput.includes('T') || dateInput.includes(' '))) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      timeStr = ` ${hours}:${minutes}`;
    }

    return `${dateStr}${timeStr}`.trim();
  } catch {
    return String(dateInput);
  }
}

