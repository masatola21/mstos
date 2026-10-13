import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface UserProfile {
  userName?: string;
  userOccupation?: string;
  userGoals?: string;
  userHobbies?: string;
  userValues?: string;
  userNotes?: string;
}

interface CharacterConfig {
  id?: string;
  name: string;
  role: string;
  tagline?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  personality: string;
  tone: string;
  speechStyle?: string;
  firstPerson?: string; // 一人称 (私, 僕, 俺, うち, 拙者 etc.)
  secondPerson?: string; // 二人称 (あなた, 君, お前, ◯◯さん etc.)
  userProfile?: UserProfile;
  behaviorRules?: string[];
  customInstructions?: string;
  responseLength?: 'short' | 'medium' | 'detailed';
}

function extractUsage(usageMetadata: any) {
  if (
    !usageMetadata ||
    usageMetadata.totalTokenCount === undefined ||
    usageMetadata.totalTokenCount === null
  ) {
    return {
      promptTokens: null,
      candidatesTokens: null,
      totalTokens: null,
      status: 'unacquired',
    };
  }
  return {
    promptTokens: usageMetadata.promptTokenCount ?? null,
    candidatesTokens: usageMetadata.candidatesTokenCount ?? null,
    totalTokens: usageMetadata.totalTokenCount ?? null,
    status: 'acquired',
  };
}

function buildSystemInstruction(char: CharacterConfig): string {
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
    parts.push(`\n- 回答の長さ: 原則として簡潔・短め（1〜3文程度でテンポの良い会話）を保ってください。長文の講釈は避け、要点のみを返してください。`);
  } else if (char.responseLength === 'detailed') {
    parts.push(`\n- 回答の長さ: 思考の背景や理由、実践ステップを丁寧に詳しく解説してください。`);
  } else {
    parts.push(`\n- 回答の長さ: 自然で対話的な適度な長さ（長すぎず短すぎず、心地よいテンポ）を保ってください。`);
  }

  if (char.customInstructions && char.customInstructions.trim()) {
    parts.push(`\n【追加の個別システム指示】\n${char.customInstructions.trim()}`);
  }

  parts.push(`\n【対話時の注意事項】`);
  parts.push(`- 設定された性格・口調・語尾・一人称・二人称を最初から最後まで徹底的に演じきってください。ロールプレイから外れた定型的なAI謝罪や無機質な文体に戻らないこと。`);
  parts.push(`- ユーザーの記憶・プロファイルを踏まえて、親身であなたならではの独自の視点から返答してください。`);
  parts.push(`- Markdown記法（見出し、太字、箇条書き、コードブロック）を適宜利用し、読みやすく表現力豊かな回答を行ってください。`);

  return parts.join('\n');
}

// 1. Chat Completion / Streaming
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, character, stream } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const systemInstruction = buildSystemInstruction(character || {
      name: 'MyAI',
      role: 'パーソナルAI',
      personality: '親切で頼りになる',
      tone: '丁寧で親しみやすい',
    });

    // Format contents for Gemini
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.85,
        },
      });

      let latestUsageMetadata = null;

      for await (const chunk of responseStream) {
        if (chunk.usageMetadata) {
          latestUsageMetadata = chunk.usageMetadata;
        }
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      // ストリーム完了後に使用量情報を専用のSSEイベントとして送信
      res.write(
        `data: ${JSON.stringify({
          type: 'usage',
          usage: extractUsage(latestUsageMetadata),
          model: 'gemini-3.8-flash',
        })}\n\n`
      );

      res.write(`data: [DONE]\n\n`);
      res.end();
    } else {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.85,
        },
      });

      const text = response.text || '';
      const usage = extractUsage(response.usageMetadata);
      return res.json({ text, usage, model: 'gemini-3.8-flash' });
    }
  } catch (err: any) {
    console.error('Error in /api/chat:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message || 'AIとの通信中にエラーが発生しました。',
      });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Error occurred' })}\n\n`);
      res.end();
    }
  }
});

// 2. AI Character Architect (ワンクリック自動生成)
app.post('/api/generate-character', async (req, res) => {
  try {
    const { concept, userProfile } = req.body;
    if (!concept || typeof concept !== 'string') {
      return res.status(400).json({ error: 'concept string is required' });
    }

    const prompt = `あなたは世界最高峰のパーソナルAIプロンプトエンジニア兼キャラクターデザイナーです。
ユーザーから「こんな自分用AIを作りたい」という要望を受け取りました。

【ユーザーの要望】:
「${concept}」

${userProfile ? `【ユーザー自身の情報】:\n- 名前: ${userProfile.userName || '未設定'}\n- 職業: ${userProfile.userOccupation || '未設定'}\n- 目標: ${userProfile.userGoals || '未設定'}` : ''}

上記の要望をもとに、最高に魅力的で愛着の湧く「自分専用AIキャラクター」の設計書をJSON形式のみで作成してください。
必ず以下のJSONスキーマに従い、日本語で回答してください。JSONのみを出力し、前後の説明文やコードブロックマーク (\`\`\`json) は除外してください。

{
  "name": "キャラクターの名前 (例: セラ, アルフレッド, アオイ, ルナ, Dr.マックス など)",
  "role": "役割・肩書 (例: 辛口ビジネス参謀, 癒やしの同居人, 専属プログラミングコーチ)",
  "tagline": "一言キャッチフレーズ (例: 『妥協なき論理で、あなたの目標を最短で掴む相棒』)",
  "avatarEmoji": "キャラクターを象徴する絵文字1文字 (例: 🦉, ☕, ⚡, 🌸, 🦾, 🦊, 🧭)",
  "avatarColor": "tailwindグラデーション識別子 ('indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'fuchsia' | 'sky')",
  "personality": "性格の詳しい説明（どんな性格か、どんな長所があるか）",
  "tone": "口調の雰囲気（例: 親しみやすく元気、冷静沈着で理知的、ちょっとツンデレだが優しい 等）",
  "firstPerson": "一人称 (例: 私, 僕, 俺, うち, わたくし, アタシ)",
  "secondPerson": "二人称 (例: ◯◯さん, 君, マスター, あなた, お前)",
  "speechStyle": "特徴的な口癖や語尾のパターン (例: 『〜だよ！』『〜でござる』『〜かしら？』『〜っすね』)",
  "behaviorRules": [
    "行動指針1 (例: 結論から端的にアドバイスする)",
    "行動指針2 (例: 落ち込んでいる時はまず温かく共感する)",
    "行動指針3 (例: 次のアクションに繋がる問いかけを1つ添える)"
  ],
  "responseLength": "short" | "medium" | "detailed",
  "customInstructions": "プロンプトとしての追加の補足指示や背景設定",
  "greetingMessage": "最初にユーザーに話しかける挨拶メッセージ（キャラクターの口調が存分に出ている魅力的な第一声）",
  "suggestedTopics": [
    "このAIに最初に話しかける際のおすすめの話題や質問1",
    "おすすめの話題2",
    "おすすめの話題3"
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.9,
      },
    });

    const usage = extractUsage(response.usageMetadata);

    let rawText = response.text || '{}';
    // Remove markdown code fence if present
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const parsed = JSON.parse(rawText);
      return res.json({ ...parsed, _usage: usage, _model: 'gemini-3.8-flash' });
    } catch (parseErr) {
      console.error('Failed to parse generated character JSON:', rawText);
      // Fallback
      return res.json({
        name: 'マイ・アシスタント',
        role: '専属パートナー',
        tagline: 'あなたを全力でサポートするAI',
        avatarEmoji: '✨',
        avatarColor: 'indigo',
        personality: '親切で誠実、あなたの気持ちをよく理解する',
        tone: '丁寧で親しみやすい敬語',
        firstPerson: '私',
        secondPerson: 'あなた',
        speechStyle: '〜ですね、〜でしょうか？',
        behaviorRules: ['常にユーザー目線で考える', '建設的なアイデアを提供する'],
        responseLength: 'medium',
        greetingMessage: 'こんにちは！あなたの専属アシスタントです。どんなことでも気軽に相談してくださいね！',
        suggestedTopics: ['今日のタスクを整理したい', '新しいアイデアの相談', '気分転換におしゃべり'],
        _usage: usage,
        _model: 'gemini-3.8-flash',
      });
    }
  } catch (err: any) {
    console.error('Error in /api/generate-character:', err);
    return res.status(500).json({ error: err.message || 'AIキャラクター生成に失敗しました。' });
  }
});

// 3. Extract Memory from Conversation (対話から記憶・メモを抽出)
app.post('/api/extract-memory', async (req, res) => {
  try {
    const { messages, currentNotes } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const conversationText = messages
      .slice(-8)
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`)
      .join('\n');

    const prompt = `以下の直近の会話から、AIが今後ユーザーをサポートする上で【記憶しておくべきユーザーの個人的な特徴、好み、現状、悩み、目標、新事実】を抽出してください。
すでに記録されている既存メモと重複しない、新しい有用な情報のみを箇条書きで抽出してください。

【既存のメモ】:
${currentNotes || 'なし'}

【直近の会話】:
${conversationText}

記憶すべき新しい情報があれば箇条書き（3点以内）で出力してください。特筆すべき新しい個人情報がない場合は「なし」とだけ出力してください。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
      },
    });

    const usage = extractUsage(response.usageMetadata);
    const text = response.text?.trim() || '';

    if (text.includes('なし') && text.length < 15) {
      return res.json({ newNotes: '', usage, model: 'gemini-3.8-flash' });
    }
    return res.json({ newNotes: text, usage, model: 'gemini-3.8-flash' });
  } catch (err: any) {
    console.error('Error in /api/extract-memory:', err);
    return res.status(500).json({ error: err.message || '記憶抽出に失敗しました。' });
  }
});

// 4. Prompt Improvement / Optimizer
app.post('/api/refine-prompt', async (req, res) => {
  try {
    const { character } = req.body;
    const prompt = `以下のAIキャラクター設定をレビューし、GeminiなどのLLMがより忠実にキャラクターになりきれるようにSystem Instructionの改善版を提案してください。

【現在の設定】:
- 名前: ${character.name}
- 役割: ${character.role}
- 性格: ${character.personality}
- 口調: ${character.tone}
- 口癖・語尾: ${character.speechStyle}
- 一人称: ${character.firstPerson} / 二人称: ${character.secondPerson}
- ルール: ${(character.behaviorRules || []).join(', ')}

出力は、コピー＆ペーストしてそのまま使える完成度の高い「システムプロンプト補足文 (customInstructions)」のみを提示してください。余計な前置きは不要です。`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const usage = extractUsage(response.usageMetadata);

    return res.json({
      enhancedInstruction: response.text || '',
      usage,
      model: 'gemini-3.8-flash',
    });
  } catch (err: any) {
    console.error('Error in /api/refine-prompt:', err);
    return res.status(500).json({ error: err.message || 'プロンプト改善に失敗しました。' });
  }
});

// Vite middleware or static serving
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, host: '0.0.0.0' },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
