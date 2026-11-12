import { GoogleGenAI } from '@google/genai';
import {
  AI_PROVIDERS,
  type AIModelSetting,
  type AIModelTarget,
  type AIProviderId,
  buildModelChain,
  describeTarget,
} from '../src/data/aiModels.js';

export interface ProviderMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ProviderUsage {
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
  status: 'acquired' | 'unacquired';
}

export interface ProviderRequest {
  systemInstruction?: string;
  messages: ProviderMessage[];
  temperature: number;
  signal?: AbortSignal;
}

export interface ProviderResult {
  text: string;
  usage: ProviderUsage;
  provider: AIProviderId;
  model: string;
  /** 主モデルから切り替わった場合のみ設定される */
  fallbackFrom?: { provider: AIProviderId; model: string; reason: string };
}

const REQUEST_TIMEOUT_MS = 90_000;
const NO_USAGE: ProviderUsage = { promptTokens: null, candidatesTokens: null, totalTokens: null, status: 'unacquired' };

const OPENAI_COMPATIBLE: Partial<Record<AIProviderId, { baseUrl: string; extraHeaders?: Record<string, string> }>> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', extraHeaders: { 'X-Title': 'MST AI Management OS' } },
};

export function isProviderConfigured(provider: AIProviderId): boolean {
  return Boolean(process.env[AI_PROVIDERS[provider].envKey]?.trim());
}

export function getProviderStatus() {
  return Object.values(AI_PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    envKey: provider.envKey,
    configured: isProviderConfigured(provider.id),
    suggestedModels: provider.suggestedModels,
    pricingUrl: provider.pricingUrl,
  }));
}

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return geminiClient;
}

function geminiUsage(meta: any): ProviderUsage {
  if (!meta || meta.totalTokenCount === undefined || meta.totalTokenCount === null) return NO_USAGE;
  return {
    promptTokens: meta.promptTokenCount ?? null,
    candidatesTokens: meta.candidatesTokenCount ?? null,
    totalTokens: meta.totalTokenCount ?? null,
    status: 'acquired',
  };
}

function openAiUsage(usage: any): ProviderUsage {
  if (!usage || usage.total_tokens === undefined || usage.total_tokens === null) return NO_USAGE;
  return {
    promptTokens: usage.prompt_tokens ?? null,
    candidatesTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
    status: 'acquired',
  };
}

function cleanErrorMessage(raw: string): string {
  try {
    let current = raw.trim();
    for (let depth = 0; depth < 3; depth++) {
      if (current.startsWith('{') && current.endsWith('}')) {
        const parsed = JSON.parse(current);
        if (parsed.error?.message) {
          const innerMsg = cleanErrorMessage(String(parsed.error.message).trim());
          const code = parsed.error.code ? `HTTP ${parsed.error.code}` : '';
          const status = parsed.error.status || '';
          const tag = [code, status].filter(Boolean).join(' ');
          return tag ? `[${tag}] ${innerMsg.replace(/^\[[^\]]+\]\s*/, '')}` : innerMsg;
        }
        if (parsed.message) {
          current = String(parsed.message).trim();
          continue;
        }
      }
      break;
    }
    return current;
  } catch {
    return raw;
  }
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cleaned = cleanErrorMessage(message);
  return cleaned.replace(/\s+/g, ' ').slice(0, 300);
}

function isTransientError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('504') ||
    msg.includes('gateway') ||
    msg.includes('overloaded') ||
    msg.includes('try again later') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

function withTimeout(parent?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('タイムアウト')), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) onAbort();
    else parent.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

// ---- 各接続先の1回分の呼び出し（テキストが出るたびに onText を呼ぶ）----

async function callGemini(
  target: AIModelTarget,
  request: ProviderRequest,
  onText: (chunk: string) => void
): Promise<ProviderUsage> {
  const isGemini3or4 = /^gemini-[34]/.test(target.model);
  const config: Record<string, any> = {};
  if (request.systemInstruction) config.systemInstruction = request.systemInstruction;
  // Gemini 3.8 / 4 は sampling parameters (temperature, topP, topK) が非推奨
  if (!isGemini3or4 && typeof request.temperature === 'number') {
    config.temperature = request.temperature;
  }

  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let emitted = false;
    try {
      const stream = await getGemini().models.generateContentStream({
        model: target.model,
        contents: request.messages.map((m) => ({ role: m.role, parts: [{ text: m.content }] })),
        config,
      });
      let usageMetadata: any = null;
      for await (const chunk of stream) {
        if (request.signal?.aborted) break;
        if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
        if (chunk.text) {
          emitted = true;
          onText(chunk.text);
        }
      }
      return geminiUsage(usageMetadata);
    } catch (err) {
      lastError = err;
      if (request.signal?.aborted || emitted) {
        throw err;
      }
      if (attempt < maxAttempts && isTransientError(err)) {
        const backoffMs = attempt * 1200 + Math.floor(Math.random() * 400);
        console.warn(`[AI Gemini] 一時的高負荷・エラーのため再試行 (${target.model} attempt ${attempt}/${maxAttempts}, ${backoffMs}ms待機):`, shortError(err));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

async function callOpenAiCompatible(
  target: AIModelTarget,
  request: ProviderRequest,
  onText: (chunk: string) => void
): Promise<ProviderUsage> {
  const config = OPENAI_COMPATIBLE[target.provider]!;
  const apiKey = process.env[AI_PROVIDERS[target.provider].envKey]!.trim();
  const { signal, clear } = withTimeout(request.signal);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...config.extraHeaders,
      },
      body: JSON.stringify({
        model: target.model,
        stream: true,
        stream_options: { include_usage: true },
        temperature: request.temperature,
        messages: [
          ...(request.systemInstruction ? [{ role: 'system', content: request.systemInstruction }] : []),
          ...request.messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let usage: ProviderUsage = NO_USAGE;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return; // コメント行（": OPENROUTER PROCESSING" など）は無視
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      let json: any;
      try {
        json = JSON.parse(payload);
      } catch {
        return;
      }
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      const text = json.choices?.[0]?.delta?.content;
      if (typeof text === 'string' && text) onText(text);
      const reported = json.usage ?? json.x_groq?.usage;
      if (reported) usage = openAiUsage(reported);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handleLine);
    }
    if (buffer) handleLine(buffer);
    return usage;
  } finally {
    clear();
  }
}

async function callTarget(target: AIModelTarget, request: ProviderRequest, onText: (chunk: string) => void) {
  if (!isProviderConfigured(target.provider)) {
    throw new Error(`${AI_PROVIDERS[target.provider].envKey} がサーバーに設定されていません`);
  }
  return target.provider === 'gemini'
    ? callGemini(target, request, onText)
    : callOpenAiCompatible(target, request, onText);
}

/**
 * 主モデル→切り替え先の順に実行する。
 * 切り替えるのは「まだ1文字も出力していない段階での失敗」のみ。
 * 途中まで出力した後の失敗は、内容が混ざらないようそのままエラーにする。
 */
export async function runWithFallback(
  setting: AIModelSetting,
  request: ProviderRequest,
  onText: (chunk: string) => void = () => {}
): Promise<ProviderResult> {
  const chain = buildModelChain(setting);

  // Gemini を利用しており、かつ gemini-3.1-flash-lite がチェーンに含まれていない場合、
  // 503 高負荷スパイク時の自律復旧用として軽量モデルをフォールバック候補に追加
  const hasGemini = chain.some((t) => t.provider === 'gemini');
  const hasFlashLite = chain.some((t) => t.provider === 'gemini' && t.model === 'gemini-3.1-flash-lite');
  const effectiveChain = [...chain];
  if (hasGemini && !hasFlashLite && isProviderConfigured('gemini')) {
    effectiveChain.push({ provider: 'gemini', model: 'gemini-3.1-flash-lite' });
  }

  const failures: Array<{ target: AIModelTarget; reason: string }> = [];

  for (const target of effectiveChain) {
    let emitted = false;
    let text = '';
    try {
      const usage = await callTarget(target, request, (chunk) => {
        emitted = true;
        text += chunk;
        onText(chunk);
      });
      return {
        text,
        usage,
        provider: target.provider,
        model: target.model,
        fallbackFrom: failures.length
          ? { provider: failures[0].target.provider, model: failures[0].target.model, reason: failures[0].reason }
          : undefined,
      };
    } catch (error) {
      if (request.signal?.aborted) throw error;
      const reason = shortError(error);
      console.error(`[AI] ${describeTarget(target)} failed:`, reason);
      if (emitted) throw new Error(`${describeTarget(target)} の応答が途中で中断されました: ${reason}`);
      failures.push({ target, reason });
    }
  }

  const summary = failures.map((f) => `${describeTarget(f.target)}（${f.reason}）`).join(' / ');
  throw new Error(`利用できるモデルがありませんでした: ${summary}`);
}

/**
 * テキストから高次元ベクトル埋め込み（text-embedding-004）を生成する
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!isProviderConfigured('gemini')) return null;
  try {
    const ai = getGemini();
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text.slice(0, 2048),
    });
    return (response as any).embedding?.values || null;
  } catch (error) {
    console.warn('Embedding generation warning:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * コサイン類似度（-1.0 〜 1.0）を計算する
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
