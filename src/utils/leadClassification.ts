export interface LeadClassificationInput {
  inquiry_type?: unknown;
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

function classifyConsultationTheme(text: string): string {
  if (text.includes('経営全体') || text.includes('利益改善')) {
    return '経営全体・利益改善';
  }
  if (text.includes('業務効率化') || text.includes('自動化') || text.includes('IT')) {
    return '業務効率化・IT/自動化';
  }
  if (text.includes('集客') || text.includes('マーケティング')) {
    return '集客・マーケティング';
  }
  if (text.includes('介護保険外') || text.includes('開業')) {
    return '介護保険外開業';
  }
  return '経営相談';
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

/**
 * リードの「希望内容（inquiry_type）」を表示用に判定する。
 * 注意:
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

  // 相談申込や両方希望などの明示値がある場合はそのまま尊重する（自由記述内の「資料」に引きずられない）
  if (deducedInquiryType === '開業相談') {
    return '開業相談';
  }
  if (deducedInquiryType === '両方希望') {
    return '両方希望';
  }
  if (deducedInquiryType && deducedInquiryType !== '資料請求') {
    return deducedInquiryType;
  }

  // 「資料請求」（無印）で保存されている場合は、構造化マーカーを元に資料名を補完
  if (deducedInquiryType === '資料請求') {
    const materialSegment = extractRequestedMaterialsSegment(latestNoteBlock || notes);
    return classifyMaterialLabel(materialSegment, sourceText);
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

  const isExplicitConsultationSource =
    sourceText.includes('お問い合わせ') ||
    sourceText.includes('相談') ||
    statusText === '相談申込' ||
    latestNoteBlock.includes('HP：お問い合わせ') ||
    latestNoteBlock.includes('HP：相談・問い合わせ') ||
    latestNoteBlock.includes('【ご関心のあるテーマ】') ||
    latestNoteBlock.includes('【ご相談内容】') ||
    latestNoteBlock.includes('【LINE介護保険外開業ヒアリング完了】');

  if (isExplicitConsultationSource) {
    return classifyConsultationTheme(latestNoteBlock || notes);
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
