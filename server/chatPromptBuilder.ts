import {
  DEFAULT_ROLE_BEHAVIOR_RULES,
  DEFAULT_ROLE_RESPONSE_LENGTH,
  DEFAULT_ROLE_TONE,
  type AIWorkMode,
  type RoleAIOverride,
} from '../src/data/aiWorkModes.js';
import { MST_CORE_BUSINESS_PROFILE } from '../src/data/defaultKnowledge.js';

export interface ChatUserProfile {
  userName?: string;
  userOccupation?: string;
  userGoals?: string;
  userHobbies?: string;
  userValues?: string;
  userNotes?: string;
}

export interface ChatCharacterConfig {
  id?: string;
  name: string;
  role: string;
  tagline?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  personality: string;
  tone: string;
  speechStyle?: string;
  firstPerson?: string;
  secondPerson?: string;
  userProfile?: ChatUserProfile;
  behaviorRules?: string[];
  customInstructions?: string;
  responseLength?: 'short' | 'medium' | 'detailed';
}

const DEFAULT_CONCISE_RULE = DEFAULT_ROLE_BEHAVIOR_RULES[0];

function ensureConciseBehaviorRules(rules?: readonly string[]): string[] {
  const list = Array.isArray(rules)
    ? rules.map((r) => String(r ?? '').trim()).filter(Boolean)
    : [];
  if (list.some((rule) => rule.includes('結論'))) {
    return list;
  }
  return [DEFAULT_CONCISE_RULE, ...list];
}

export function resolveRoleCharacter(
  workMode: AIWorkMode,
  roleOverride: RoleAIOverride,
  activeCharacter: ChatCharacterConfig,
): ChatCharacterConfig {
  const roleName = roleOverride.name ?? workMode.name;
  const roleDescription = roleOverride.description ?? workMode.description;

  if (workMode.id === 'president') {
    const isDefaultPresident = activeCharacter.id === 'preset-ceo';
    const baseRules = roleOverride.behaviorRules
      ? roleOverride.behaviorRules
      : ensureConciseBehaviorRules(activeCharacter.behaviorRules);
    return {
      ...activeCharacter,
      name: roleOverride.name ?? activeCharacter.name,
      tagline: roleOverride.description ?? activeCharacter.tagline,
      tone: roleOverride.tone ?? activeCharacter.tone ?? DEFAULT_ROLE_TONE,
      behaviorRules: baseRules,
      responseLength:
        roleOverride.responseLength ??
        (isDefaultPresident
          ? DEFAULT_ROLE_RESPONSE_LENGTH
          : activeCharacter.responseLength ?? DEFAULT_ROLE_RESPONSE_LENGTH),
    };
  }

  return {
    ...activeCharacter,
    name: roleName,
    role: workMode.label,
    tagline: roleDescription,
    personality: `${roleName}は${workMode.label}の専門担当です。担当領域の情報を整理し、根拠と不確実性を明確にして結論から簡潔に成果物を作ります。`,
    tone: roleOverride.tone ?? DEFAULT_ROLE_TONE,
    behaviorRules: roleOverride.behaviorRules ?? [...DEFAULT_ROLE_BEHAVIOR_RULES],
    responseLength: roleOverride.responseLength ?? DEFAULT_ROLE_RESPONSE_LENGTH,
    customInstructions: '',
  };
}

export function buildSystemInstruction(char: ChatCharacterConfig): string {
  const parts: string[] = [];

  parts.push(`あなたはユーザー専属のカスタムAIアシスタントです。`);
  parts.push(`【あなたの基本プロファイル】`);
  parts.push(`- 名前: ${char.name || 'AI'}`);
  parts.push(`- 役割・肩書: ${char.role || '専属パートナー'}`);
  if (char.tagline) parts.push(`- キャッチフレーズ: ${char.tagline}`);
  if (char.personality) parts.push(`- 性格・パーソナリティ: ${char.personality}`);
  if (char.tone) parts.push(`- 口調・話し方の雰囲気: ${char.tone}`);
  if (char.firstPerson) parts.push(`- 自分の一人称: ${char.firstPerson}`);
  if (char.secondPerson) parts.push(`- 相手（ユーザー）の呼び方・二人称: ${char.secondPerson}`);
  if (char.speechStyle) parts.push(`- 特徴的な口癖・語尾・話し方: ${char.speechStyle}`);

  parts.push(`\n【自社・経営OSの標準前提知識（有限会社MST公式HP・OSベース）】`);
  parts.push(MST_CORE_BUSINESS_PROFILE);
  parts.push(`※上記は自社の標準前提知識です。個別商談や提案ではユーザーから指示・確定情報がない限りサービス名や金額を勝手に断定・売り込みしないこと。`);

  if (char.userProfile) {
    const up = char.userProfile;
    parts.push(`\n【あなたの大切な相手（ユーザー）についての記憶とプロファイル】`);
    if (up.userName) parts.push(`- ユーザーの名前/呼ばれたい名: ${up.userName}（必ずこの呼び名、または設定された二人称を遵守して接してください）`);
    if (up.userOccupation) parts.push(`- 職業・活動: ${up.userOccupation}`);
    if (up.userGoals) parts.push(`- 目標・目指していること: ${up.userGoals}`);
    if (up.userHobbies) parts.push(`- 趣味・興味: ${up.userHobbies}`);
    if (up.userValues) parts.push(`- 大切にしている価値観: ${up.userValues}`);
    if (up.userNotes) parts.push(`- AIが記憶している重要メモ・パーソナル背景:\n${up.userNotes}`);
  }

  if (char.behaviorRules && char.behaviorRules.length > 0) {
    parts.push(`\n【絶対遵守すべき行動指針・ルール】`);
    char.behaviorRules.forEach((rule, idx) => {
      if (rule.trim()) parts.push(`${idx + 1}. ${rule}`);
    });
  }

  if (char.responseLength === 'short') {
    parts.push(`\n- 回答の長さ: 原則として結論から極めて簡潔・短め（1〜3文程度）で答えてください。前置きや冗長な解説は省き、要点のみを返してください。`);
  } else if (char.responseLength === 'detailed') {
    parts.push(`\n- 回答の長さ: 最初に結論を簡潔に1〜2文で示したうえで、思考の背景や理由、実践ステップを重複なく整理して解説してください。`);
  } else {
    parts.push(`\n- 回答の長さ: 結論から簡潔に、前置きや重複説明を省いて要点を整理し、適度な長さを保ってください。`);
  }

  if (char.customInstructions && char.customInstructions.trim()) {
    parts.push(`\n【追加の個別システム指示】\n${char.customInstructions.trim()}`);
  }

  parts.push(`\n【対話時の注意事項】`);
  parts.push(`- 原則として常に「結論から簡潔に」回答してください。最初に結論を1〜2文で述べ、前置き・挨拶の繰り返し・冗長な言い換えを省き、要点を端的に整理すること（JSON形式など出力形式が指定されている場合は、その形式を厳守したうえで各項目を簡潔にまとめること）。`);
  parts.push(`- 設定された性格・口調・語尾・一人称・二人称を最初から最後まで徹底的に演じきってください。ロールプレイから外れた定型的なAI謝罪や無機質な文体に戻らないこと。`);
  parts.push(`- ユーザーの記憶・プロファイルを踏まえて、親身であなたならではの独自の視点から返答してください。`);
  parts.push(`- Markdown記法（見出し、太字、箇条書き、コードブロック）を適宜利用し、読みやすく表現力豊かな回答を行ってください。`);

  return parts.join('\n');
}
