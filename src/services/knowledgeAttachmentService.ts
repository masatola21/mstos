import { getSupabase } from '../lib/supabaseClient';
import { KnowledgeAttachment } from '../types';

export const KNOWLEDGE_FILES_BUCKET = 'mst-knowledge-files';
export const MAX_KNOWLEDGE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function uploadKnowledgeAttachment(
  userId: string,
  knowledgeItemId: string,
  file: File,
): Promise<KnowledgeAttachment> {
  if (file.size > MAX_KNOWLEDGE_ATTACHMENT_BYTES) {
    throw new Error('添付ファイルは20MB以下にしてください。');
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabaseに接続できません。接続設定を確認してください。');

  const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 160) || 'attachment';
  const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `${userId}/${knowledgeItemId}/${uniqueId}-${safeName}`;
  const { error } = await supabase.storage.from(KNOWLEDGE_FILES_BUCKET).upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(`ファイルをアップロードできませんでした: ${error.message}`);

  return {
    id: uniqueId,
    fileName: file.name,
    storagePath,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: Date.now(),
  };
}

export async function downloadKnowledgeAttachment(attachment: KnowledgeAttachment): Promise<Blob> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabaseに接続できません。接続設定を確認してください。');
  const { data, error } = await supabase.storage.from(KNOWLEDGE_FILES_BUCKET).download(attachment.storagePath);
  if (error) throw new Error(`ファイルをダウンロードできませんでした: ${error.message}`);
  return data;
}

export async function deleteKnowledgeAttachment(attachment: KnowledgeAttachment): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabaseに接続できません。接続設定を確認してください。');
  const { error } = await supabase.storage.from(KNOWLEDGE_FILES_BUCKET).remove([attachment.storagePath]);
  if (error) throw new Error(`ファイルを削除できませんでした: ${error.message}`);
}

export function downloadTextFile(fileName: string, content: string, mimeType = 'text/markdown;charset=utf-8'): void {
  const blobUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

