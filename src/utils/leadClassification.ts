export interface LeadClassificationInput {
  inquiry_type?: unknown;
  service_type?: unknown;
  source?: unknown;
  status?: unknown;
  notes?: unknown;
}

const MATERIAL_ENRICHED_LABELS = {
  both: '資料請求: 実務ガイド・介護開業パッケージ',
  care: '資料請求: 介護保険外開業パッケージ',
  guide: '資料請求: 経営改善実務ガイド',
  generic: '資料請求',
} as const;

const STANDALONE_IT_REGEX = /(?:^|[^A-Za-z])IT(?:$|[^A-Za-z])/;

export function classifyConsultationTheme(text: string): string {
  const normalized = String(text || '').trim();
  if (!normalized) return '経営相談';

  if (normalized.includes('経営全体') || normalized.includes('利益改善')) {
    return '経営全体・利益改善';
  }
  if (normalized.includes('集客') || normalized.includes('マーケティング')) {
    return '集客・マーケティング';
  }
  if (
    normalized.includes('業務効率化') ||
    normalized.includes('業務改善') ||
    normalized.includes('自動化') ||
    normalized.includes('IT導入') ||
    normalized.includes('IT化') ||
    normalized.includes('IT自動化') ||
    normalized.includes('IT/自動化') ||
    normalized.includes('DX') ||
    STANDALONE_IT_REGEX.test(normalized)
  ) {
    return '業務効率化・IT/自動化';
  }
  if (normalized.includes('介護保険外') || normalized.includes('開業')) {
    return '介護保険外開業';
  }
  return '経営相談';
}

const CONSULTATION_TOPIC_KEYS = [
  'service_interest',
  'serviceInterest',
  'q_service_interest',
  'consultation_topic',
  'q_consultation_topic',
  'consultation_theme',
  'q_consultation_theme',
  'topic',
  'q_topic',
  'theme',
  'q_theme',
  'selected_topic',
  'selected_service',
  'selected_option',
  'inquiry_topic',
  'desired_content',
  'hope',
  'q_inquiry_type',
  'inquiry_type',
  'inquiryType',
  'interest',
  'q_interest',
  'subject',
  'category',
] as const;

const INTERNAL_MACHINE_INQUIRY_TOKENS = new Set([
  'consultation',
  'material',
  'diagnosis',
  'care_package',
  'meeting',
  'other',
]);

const LEGACY_AUTO_CLASSIFIED_BUCKETS = new Set([
  '経営相談',
  '業務効率化・IT/自動化',
  '経営全体・利益改善',
  '集客・マーケティング',
  '介護保険外開業',
  'その他お問い合わせ',
]);

export function extractRawConsultationTopic(
  answers?: Record<string, unknown> | null,
  customFields?: Record<string, unknown> | null,
): string {
  for (const sourceObj of [answers, customFields]) {
    if (!sourceObj || typeof sourceObj !== 'object') continue;
    for (const key of CONSULTATION_TOPIC_KEYS) {
      const val = sourceObj[key];
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed && !INTERNAL_MACHINE_INQUIRY_TOKENS.has(trimmed.toLowerCase())) {
          return trimmed;
        }
      }
      if (Array.isArray(val)) {
        const joined = val
          .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()) && !INTERNAL_MACHINE_INQUIRY_TOKENS.has(v.trim().toLowerCase()))
          .map((v) => v.trim())
          .join('・')
          .trim();
        if (joined) return joined;
      }
    }
  }
  return '';
}

export function resolveConsultationInquiryType(params: {
  answers?: Record<string, unknown> | null;
  customFields?: Record<string, unknown> | null;
  fallbackText?: string | null;
}): string {
  const rawInterest = extractRawConsultationTopic(params.answers, params.customFields);
  if (rawInterest) {
    // ホームページ等のフォームで選択された内容をそのまま忠実に反映する
    return rawInterest;
  }
  const fallback = String(params.fallbackText || '').trim();
  if (fallback) {
    return classifyConsultationTheme(fallback);
  }
  return '経営相談';
}

function getLatestNoteBlock(notes: string): string {
  const trimmed = notes.trim();
  if (!trimmed) return '';
  const markerMatches = [...trimmed.matchAll(/\[申込\s+[^\]]+\]/g)];
  if (markerMatches.length === 0) return trimmed;
  const lastMatch = markerMatches[markerMatches.length - 1];
  return lastMatch.index !== undefined ? trimmed.slice(lastMatch.index) : trimmed;
}

function classifyMaterialLabel(text: string, sourceText: string): string {
  const combined = `${sourceText}\n${text}`;
  const hasCare =
    combined.includes('care-package-overview') ||
    combined.includes('介護保険外') ||
    combined.includes('開業パッケージ') ||
    combined.includes('介護');
  const hasGuide =
    combined.includes('management-guide') ||
    combined.includes('実務ガイド') ||
    combined.includes('経営改善') ||
    combined.includes('ガイドブック');

  if (hasCare && hasGuide) return MATERIAL_ENRICHED_LABELS.both;
  if (hasCare) return MATERIAL_ENRICHED_LABELS.care;
  if (hasGuide) return MATERIAL_ENRICHED_LABELS.guide;
  return MATERIAL_ENRICHED_LABELS.generic;
}

function hasExplicitMaterialStructure(noteBlock: string, sourceText: string): boolean {
  if (sourceText.includes('資料請求')) return true;
  if (noteBlock.includes('HP：資料請求')) return true;
  if (noteBlock.includes('【請求資料】')) return true;
  if (noteBlock.includes('"material_keys"') || noteBlock.includes('"material_choice"')) return true;
  if (/^\s*【資料請求】/m.test(noteBlock)) return true;
  return false;
}

function extractRequestedMaterialsSegment(noteBlock: string): string {
  const requestedMatch = noteBlock.match(/【請求資料】([^\n]+)/);
  if (requestedMatch?.[1]) return requestedMatch[1];
  const choiceMatch = noteBlock.match(/"choice_label"\s*:\s*"([^"]+)"/);
  if (choiceMatch?.[1]) return choiceMatch[1];
  const keysMatch = noteBlock.match(/"material_keys"\s*:\s*(\[[^\]]*\])/);
  if (keysMatch?.[1]) return keysMatch[1];
  const rawMaterialNoteMatch = noteBlock.match(/【資料請求】ご希望資料:\s*([^\n]+)/);
  if (rawMaterialNoteMatch?.[1]) return rawMaterialNoteMatch[1];
  return noteBlock;
}

function extractTopicFromNoteAnswers(noteBlock: string): string {
  if (!noteBlock) return '';
  const jsonMatches = noteBlock.match(/\{[^\n]*\}/g);
  if (jsonMatches && jsonMatches.length > 0) {
    for (let i = jsonMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(jsonMatches[i]);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const topic = extractRawConsultationTopic(parsed as Record<string, unknown>);
          if (topic) return topic;
        }
      } catch {
        // Ignore truncated JSON
      }
    }
  }
  const keyMatch = noteBlock.match(
    /"(?:service_interest|serviceInterest|q_service_interest|consultation_topic|q_consultation_topic|consultation_theme|q_consultation_theme|topic|q_topic|theme|q_theme|selected_topic|selected_service|selected_option|inquiry_topic|desired_content|hope|q_inquiry_type|inquiry_type|inquiryType)"\s*:\s*"([^"]+)"/,
  );
  if (keyMatch?.[1]) {
    const val = keyMatch[1].trim();
    if (val && !INTERNAL_MACHINE_INQUIRY_TOKENS.has(val.toLowerCase())) return val;
  }
  return '';
}

function stripUrlMetadataLines(noteBlock: string): string {
  return noteBlock
    .split('\n')
    .filter((line) => !line.startsWith('【流入詳細】'))
    .join('\n');
}

/**
 * リードの「希望内容（inquiry_type）」を表示用に判定する。
 * 注意:
 * - ホームページ等のフォームで選択された内容（JSON内の回答）がある場合は忠実にそのまま反映する。
 * - 相談申し込み・開業相談の自由記述内に「資料」という単語が含まれていても「資料請求」へ誤上書きしない。
 * - 「開業相談」として保存されたレコードは相談案件として維持し、「資料請求: ...」へ変換しない。
 */
export function deduceLeadInquiryType(item: LeadClassificationInput): string {
  let deducedInquiryType = String(item.inquiry_type || '').trim();
  const sourceText = String(item.source || '').trim();
  const statusText = String(item.status || '').trim();
  const notes = String(item.notes || '').trim();
  const latestNoteBlock = getLatestNoteBlock(notes);

  if (deducedInquiryType.includes('提案書') || deducedInquiryType === '資料請求: 介護開業提案書') {
    deducedInquiryType = '';
  }

  const isExplicitConsultationSource =
    sourceText.includes('お問い合わせ') ||
    sourceText.includes('相談') ||
    statusText === '相談申込' ||
    latestNoteBlock.includes('HP：お問い合わせ') ||
    latestNoteBlock.includes('HP：相談・問い合わせ') ||
    latestNoteBlock.includes('【ご関心のあるテーマ】') ||
    latestNoteBlock.includes('【ご相談内容】') ||
    latestNoteBlock.includes('【LINE介護保険外開業ヒアリング完了】');

  // 「資料請求」（無印）で保存されている場合は、構造化マーカーを元に資料名を補完
  if (deducedInquiryType === '資料請求') {
    const materialSegment = extractRequestedMaterialsSegment(latestNoteBlock || notes);
    return classifyMaterialLabel(materialSegment, sourceText);
  }

  // 両方希望はそのまま尊重
  if (deducedInquiryType === '両方希望') {
    return '両方希望';
  }

  // 最新申込ブロック内の回答JSONにホームで選択された内容がある場合は、旧自動分類より優先して忠実に反映する
  const topicFromAnswers = extractTopicFromNoteAnswers(latestNoteBlock);
  const canOverrideWithFormChoice =
    !deducedInquiryType ||
    LEGACY_AUTO_CLASSIFIED_BUCKETS.has(deducedInquiryType) ||
    (deducedInquiryType === '開業相談' && isExplicitConsultationSource && !sourceText.includes('開業パッケージ'));

  if (topicFromAnswers && canOverrideWithFormChoice) {
    return topicFromAnswers;
  }

  // 明示的な相談・カスタム希望内容がある場合はそのまま尊重する
  if (deducedInquiryType === '開業相談') {
    return '開業相談';
  }
  if (deducedInquiryType && deducedInquiryType !== '経営相談') {
    return deducedInquiryType;
  }

  if (deducedInquiryType === '経営相談') {
    return '経営相談';
  }

  // inquiry_type が空の場合のみ、最新申込ブロック・source・status の構造化情報から推定する
  const explicitRequestMatch = latestNoteBlock.match(/【希望内容】([^\n]+)/);
  if (explicitRequestMatch?.[1]) {
    const explicit = explicitRequestMatch[1].trim();
    if (explicit === '資料請求') {
      return classifyMaterialLabel(extractRequestedMaterialsSegment(latestNoteBlock), sourceText);
    }
    if (explicit) return explicit;
  }

  if (isExplicitConsultationSource) {
    return classifyConsultationTheme(stripUrlMetadataLines(latestNoteBlock || notes));
  }

  if (
    sourceText.includes('診断') ||
    statusText === '診断申込' ||
    latestNoteBlock.includes('経営ボトルネック診断') ||
    latestNoteBlock.includes('診断判定')
  ) {
    return 'ボトルネック診断';
  }

  if (statusText === '資料請求' || hasExplicitMaterialStructure(latestNoteBlock, sourceText)) {
    const materialSegment = extractRequestedMaterialsSegment(latestNoteBlock || notes);
    return classifyMaterialLabel(materialSegment, sourceText);
  }

  if (
    latestNoteBlock.includes('介護保険外') ||
    latestNoteBlock.includes('開業') ||
    sourceText.includes('開業パッケージ')
  ) {
    return '介護保険外開業';
  }

  if (sourceText.includes('HP')) {
    return 'お問い合わせ';
  }

  return sourceText || 'Web反響';
}
