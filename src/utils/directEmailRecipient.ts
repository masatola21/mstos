export interface DirectContactCandidate {
  id: string;
  full_name: string;
  email?: string | null;
  line_user_id?: string | null;
  company_id?: string | null;
}

const DIRECT_EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export function normalizeDirectEmail(raw?: string | null): string {
  return String(raw || '').trim().toLowerCase();
}

export function isValidDirectEmail(raw?: string | null): boolean {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.length > 254) return false;
  return DIRECT_EMAIL_PATTERN.test(trimmed);
}

export function findContactByEmail<T extends { email?: string | null }>(
  contacts: T[],
  email?: string | null,
): T | undefined {
  const target = normalizeDirectEmail(email);
  if (!target) return undefined;
  return contacts.find((ct) => normalizeDirectEmail(ct.email) === target);
}

export function buildDirectContactInsertPayload(params: {
  email: string;
  recipientName?: string | null;
  companyId?: string | null;
}) {
  const cleanEmail = normalizeDirectEmail(params.email);
  const cleanName = String(params.recipientName || '').trim() || 'ご担当者';
  return {
    company_id: params.companyId || null,
    full_name: cleanName,
    email: cleanEmail,
    preferred_channel: 'email',
    source: 'manual',
    email_consent_status: 'unknown',
  };
}

export function resolveDirectContactPreview<T extends DirectContactCandidate>(params: {
  contacts: T[];
  email?: string | null;
  recipientName?: string | null;
  companyId?: string | null;
}): { contact: T | DirectContactCandidate; isExisting: boolean } {
  const matched = findContactByEmail(params.contacts, params.email);
  if (matched) {
    return { contact: matched, isExisting: true };
  }
  return {
    contact: {
      id: '',
      full_name: String(params.recipientName || '').trim() || 'ご担当者',
      email: String(params.email || '').trim(),
      line_user_id: null,
      company_id: params.companyId || null,
    },
    isExisting: false,
  };
}
