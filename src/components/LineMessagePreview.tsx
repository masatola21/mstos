import React from 'react';

export type LinePreviewType = 'text' | 'image' | 'flex' | 'video';

type Props = {
  type: LinePreviewType;
  payload?: unknown;
  text?: string;
  title?: string;
};

const parseValue = (value: unknown): any => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const spacing: Record<string, string> = {
  none: '0', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', xxl: '24px',
};
const textSize: Record<string, string> = {
  xxs: '10px', xs: '12px', sm: '14px', md: '16px', lg: '18px',
  xl: '20px', xxl: '24px', xxxl: '30px',
};

const FlexNode: React.FC<{ node: any; index?: number }> = ({ node, index = 0 }) => {
  if (node == null || typeof node !== 'object') return null;
  if (node.type === 'text') {
    return <div key={index} style={{
      color: node.color || '#1f2937',
      fontSize: textSize[node.size] || '14px',
      fontWeight: node.weight === 'bold' ? 700 : 400,
      textAlign: node.align || 'left',
      whiteSpace: node.wrap === false ? 'nowrap' : 'pre-wrap',
      overflow: 'hidden',
      marginTop: spacing[node.margin] || undefined,
      lineHeight: 1.45,
    }}>{String(node.text || '')}</div>;
  }
  if (node.type === 'image') {
    if (!node.url) return <div key={index} className="rounded bg-slate-200 p-4 text-center text-xs text-slate-500">画像URL未設定</div>;
    return <img key={index} src={String(node.url)} alt={String(node.alt || '')} className="block max-w-full object-cover"
      style={{ width: node.size === 'full' ? '100%' : node.size === 'xxl' ? '240px' : node.size === 'xl' ? '200px' : '100%', aspectRatio: String(node.aspectRatio || '20:13').replace(':', ' / '), objectFit: node.aspectMode === 'fit' ? 'contain' : 'cover', borderRadius: node.cornerRadius === 'none' ? 0 : 8 }} />;
  }
  if (node.type === 'button') {
    const action = node.action || {};
    return <div key={index} className={'rounded-lg px-3 py-2 text-center text-sm font-semibold ' + (node.style === 'link' ? 'text-blue-700' : 'bg-blue-600 text-white')}
      style={{ marginTop: spacing[node.margin] || '8px' }}>{String(action.label || 'ボタン')}</div>;
  }
  if (node.type === 'separator') return <hr key={index} className="my-2 border-slate-200" />;
  if (node.type === 'spacer') return <div key={index} style={{ height: spacing[node.size] || '12px' }} />;
  if (node.type === 'box') {
    const horizontal = node.layout === 'horizontal' || node.layout === 'baseline';
    const bg = node.backgroundColor || 'transparent';
    return <div key={index} className="min-w-0" style={{
      display: 'flex', flexDirection: horizontal ? 'row' : 'column',
      alignItems: node.layout === 'baseline' ? 'baseline' : 'stretch',
      justifyContent: node.justifyContent || 'flex-start',
      gap: spacing[node.spacing] || '0',
      padding: spacing[node.paddingAll] || undefined,
      background: bg, borderRadius: node.cornerRadius === 'none' ? undefined : 8,
      marginTop: spacing[node.margin] || undefined,
    }}>{(Array.isArray(node.contents) ? node.contents : []).map((child: any, childIndex: number) => <FlexNode key={childIndex} node={child} index={childIndex} />)}</div>;
  }
  return <div key={index} className="space-y-2">
    {node.header && <FlexNode node={node.header} />}
    {node.hero && <FlexNode node={node.hero} />}
    {node.body && <FlexNode node={node.body} />}
    {node.footer && <FlexNode node={node.footer} />}
    {Array.isArray(node.contents) && node.contents.map((child: any, childIndex: number) => <FlexNode key={childIndex} node={child} index={childIndex} />)}
  </div>;
};

export const LineMessagePreview: React.FC<Props> = ({ type, payload: payloadInput, text, title }) => {
  const payload = parseValue(payloadInput) || {};
  const body = typeof payload.text === 'string' ? payload.text : (text || '');
  const label = title || 'LINEメッセージプレビュー';
  const imageUrl = String(payload.originalContentUrl || payload.previewImageUrl || '');
  const videoUrl = String(payload.originalContentUrl || '');
  const contents = parseValue(payload.contents) || (payload.type === 'bubble' || payload.type === 'carousel' ? payload : null);
  return <div className="rounded-xl border border-slate-700 bg-slate-950 p-3" aria-label={label}>
    <div className="mb-2 text-[11px] font-semibold text-slate-400">{label}</div>
    <div className="mx-auto max-w-[360px] rounded-2xl bg-[#dce9df] p-3">
      {type === 'text' && <div className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">{body || 'メッセージ本文がここに表示されます。'}</div>}
      {type === 'image' && <div className="ml-auto w-fit max-w-[90%] overflow-hidden rounded-xl bg-white p-2 shadow-sm">{imageUrl ? <img src={imageUrl} alt={String(payload.altText || 'LINE配信画像')} className="max-h-80 max-w-full rounded-lg object-contain" /> : <div className="p-8 text-center text-xs text-slate-500">画像素材を選択してください。</div>}</div>}
      {type === 'video' && <div className="ml-auto w-fit max-w-[90%] overflow-hidden rounded-xl bg-white p-2 shadow-sm">{videoUrl ? <video src={videoUrl} poster={String(payload.previewImageUrl || '')} controls className="max-h-80 max-w-full rounded-lg" /> : payload.previewImageUrl ? <img src={String(payload.previewImageUrl)} alt={String(payload.altText || 'LINE動画プレビュー')} className="max-h-80 max-w-full rounded-lg object-contain" /> : <div className="p-8 text-center text-xs text-slate-500">動画素材を選択してください。</div>}{payload.altText && <div className="pt-1 text-xs text-slate-500">{String(payload.altText)}</div>}</div>}
      {type === 'flex' && <div className="ml-auto w-full max-w-[320px] overflow-hidden rounded-xl bg-white p-3 text-slate-800 shadow-sm">{contents ? contents.type === 'carousel' ? <div className="flex gap-3 overflow-x-auto">{(contents.contents || []).map((bubble: any, i: number) => <div key={i} className="min-w-[260px] max-w-[280px] rounded-lg border border-slate-200 p-3"><FlexNode node={bubble} index={i} /></div>)}</div> : <FlexNode node={contents} /> : <div className="p-5 text-center text-xs text-rose-600">Flex JSONを読み取れません。bubbleまたはcarousel形式を確認してください。</div>}{payload.altText && <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">通知文: {String(payload.altText)}</div>}</div>}
    </div>
  </div>;
};
