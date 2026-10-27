/**
 * RFC 5545 iCalendar Parser for Google Calendar and other ICS feeds
 */

export interface ParsedIcalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  isAllDay: boolean;
  location?: string;
  meetUrl?: string;
  notes?: string;
  calendarName?: string;
  rawUid?: string;
}

function unescapeIcalText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Format date string from iCal (e.g. "20261023" or "20261023T090000Z" or "20261023T180000")
 */
function parseIcalDateTime(value: string): { date: string; time?: string; isAllDay: boolean } {
  // If date-only: "20261023"
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { date: `${y}-${m}-${d}`, isAllDay: true };
  }

  // If UTC dateTime: "20261023T090000Z"
  if (/^\d{8}T\d{6}Z$/.test(value)) {
    const y = parseInt(value.slice(0, 4), 10);
    const m = parseInt(value.slice(4, 6), 10) - 1;
    const d = parseInt(value.slice(6, 8), 10);
    const hh = parseInt(value.slice(9, 11), 10);
    const mm = parseInt(value.slice(11, 13), 10);
    const ss = parseInt(value.slice(13, 15), 10);

    const utcDate = new Date(Date.UTC(y, m, d, hh, mm, ss));
    // Format to JST (Japan Standard Time, UTC+9)
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const jstDate = new Date(utcDate.getTime() + jstOffsetMs);

    const jstY = jstDate.getUTCFullYear();
    const jstM = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    const jstD = String(jstDate.getUTCDate()).padStart(2, '0');
    const jstH = String(jstDate.getUTCHours()).padStart(2, '0');
    const jstMin = String(jstDate.getUTCMinutes()).padStart(2, '0');

    return {
      date: `${jstY}-${jstM}-${jstD}`,
      time: `${jstH}:${jstMin}`,
      isAllDay: false,
    };
  }

  // If local / timezone dateTime: "20261023T090000"
  if (/^\d{8}T\d{6}/.test(value)) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    const hh = value.slice(9, 11);
    const mm = value.slice(11, 13);
    return {
      date: `${y}-${m}-${d}`,
      time: `${hh}:${mm}`,
      isAllDay: false,
    };
  }

  // Fallback try standard Date
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mm = String(parsed.getMinutes()).padStart(2, '0');
      return {
        date: `${y}-${m}-${d}`,
        time: `${hh}:${mm}`,
        isAllDay: false,
      };
    }
  } catch {
    // Ignore
  }

  return { date: value.slice(0, 10), isAllDay: true };
}

export function parseIcalendar(icsString: string): { calendarName: string; events: ParsedIcalEvent[] } {
  // Step 1: Unfold lines (RFC 5545: CRLF followed by single space or tab)
  const unfolded = icsString.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let calendarName = 'Google カレンダー';
  const events: ParsedIcalEvent[] = [];

  let inEvent = false;
  let currentEvent: Partial<ParsedIcalEvent> & { dtEndRaw?: string } = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('X-WR-CALNAME:')) {
      calendarName = unescapeIcalText(trimmed.slice('X-WR-CALNAME:'.length)) || calendarName;
      continue;
    }

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && currentEvent.date && currentEvent.title) {
        events.push({
          id: currentEvent.id || `google-sync-${events.length + 1}-${Date.now()}`,
          title: currentEvent.title,
          date: currentEvent.date,
          startTime: currentEvent.startTime,
          endTime: currentEvent.endTime,
          isAllDay: currentEvent.isAllDay ?? false,
          location: currentEvent.location,
          meetUrl: currentEvent.meetUrl,
          notes: currentEvent.notes,
          calendarName,
          rawUid: currentEvent.rawUid,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    // Colon or semicolon separator
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = trimmed.slice(0, colonIdx);
    const valuePart = trimmed.slice(colonIdx + 1);

    const keyName = keyPart.split(';')[0].toUpperCase();

    switch (keyName) {
      case 'UID':
        currentEvent.rawUid = valuePart;
        currentEvent.id = `google-${valuePart.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`;
        break;

      case 'SUMMARY':
        currentEvent.title = unescapeIcalText(valuePart);
        break;

      case 'DESCRIPTION': {
        const desc = unescapeIcalText(valuePart);
        currentEvent.notes = desc;
        // Detect Google Meet / Zoom URL in description if not present
        const meetMatch = desc.match(/https:\/\/(meet\.google\.com\/[a-z0-9-]+|zoom\.us\/j\/[0-9]+[^\s]*)/i);
        if (meetMatch && !currentEvent.meetUrl) {
          currentEvent.meetUrl = meetMatch[0];
        }
        break;
      }

      case 'LOCATION': {
        const loc = unescapeIcalText(valuePart);
        currentEvent.location = loc;
        if (loc.includes('meet.google.com') || loc.includes('zoom.us')) {
          currentEvent.meetUrl = loc;
        }
        break;
      }

      case 'DTSTART': {
        const parsed = parseIcalDateTime(valuePart);
        currentEvent.date = parsed.date;
        currentEvent.startTime = parsed.time;
        currentEvent.isAllDay = parsed.isAllDay;
        break;
      }

      case 'DTEND': {
        const parsed = parseIcalDateTime(valuePart);
        currentEvent.endTime = parsed.time;
        break;
      }

      default:
        break;
    }
  }

  // Sort by date and startTime
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
  });

  return { calendarName, events };
}
