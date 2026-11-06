import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const parseValue = (value) => {
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
};
const spacing = {
    none: '0', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', xxl: '24px',
};
const textSize = {
    xxs: '10px', xs: '12px', sm: '14px', md: '16px', lg: '18px',
    xl: '20px', xxl: '24px', xxxl: '30px',
};
const FlexNode = ({ node, index = 0 }) => {
    if (node == null || typeof node !== 'object')
        return null;
    if (node.type === 'text') {
        return _jsx("div", { style: {
                color: node.color || '#1f2937',
                fontSize: textSize[node.size] || '14px',
                fontWeight: node.weight === 'bold' ? 700 : 400,
                textAlign: node.align || 'left',
                whiteSpace: node.wrap === false ? 'nowrap' : 'pre-wrap',
                overflow: 'hidden',
                marginTop: spacing[node.margin] || undefined,
                lineHeight: 1.45,
            }, children: String(node.text || '') }, index);
    }
    if (node.type === 'image') {
        if (!node.url)
            return _jsx("div", { className: "rounded bg-slate-200 p-4 text-center text-xs text-slate-500", children: "\u753B\u50CFURL\u672A\u8A2D\u5B9A" }, index);
        return _jsx("img", { src: String(node.url), alt: String(node.alt || ''), className: "block max-w-full object-cover", style: { width: node.size === 'full' ? '100%' : node.size === 'xxl' ? '240px' : node.size === 'xl' ? '200px' : '100%', aspectRatio: String(node.aspectRatio || '20:13').replace(':', ' / '), objectFit: node.aspectMode === 'fit' ? 'contain' : 'cover', borderRadius: node.cornerRadius === 'none' ? 0 : 8 } }, index);
    }
    if (node.type === 'button') {
        const action = node.action || {};
        const isLink = node.style === 'link';
        return (_jsx("div", { className: `rounded-lg px-3 py-2 text-center text-sm font-semibold ${isLink ? 'text-blue-700 underline' : 'text-white'}`, style: {
                marginTop: spacing[node.margin] || '8px',
                backgroundColor: isLink ? 'transparent' : (node.color || '#2563eb'),
            }, children: String(action.label || 'ボタン') }, index));
    }
    if (node.type === 'separator')
        return _jsx("hr", { className: "my-2 border-slate-200" }, index);
    if (node.type === 'spacer')
        return _jsx("div", { style: { height: spacing[node.size] || '12px' } }, index);
    if (node.type === 'box') {
        const horizontal = node.layout === 'horizontal' || node.layout === 'baseline';
        const bg = node.backgroundColor || 'transparent';
        return _jsx("div", { className: "min-w-0", style: {
                display: 'flex', flexDirection: horizontal ? 'row' : 'column',
                alignItems: node.layout === 'baseline' ? 'baseline' : 'stretch',
                justifyContent: node.justifyContent || 'flex-start',
                gap: spacing[node.spacing] || '0',
                padding: spacing[node.paddingAll] || undefined,
                background: bg, borderRadius: node.cornerRadius === 'none' ? undefined : 8,
                marginTop: spacing[node.margin] || undefined,
            }, children: (Array.isArray(node.contents) ? node.contents : []).map((child, childIndex) => _jsx(FlexNode, { node: child, index: childIndex }, childIndex)) }, index);
    }
    return _jsxs("div", { className: "space-y-2", children: [node.header && _jsx(FlexNode, { node: node.header }), node.hero && _jsx(FlexNode, { node: node.hero }), node.body && _jsx(FlexNode, { node: node.body }), node.footer && _jsx(FlexNode, { node: node.footer }), Array.isArray(node.contents) && node.contents.map((child, childIndex) => _jsx(FlexNode, { node: child, index: childIndex }, childIndex))] }, index);
};
export const LineMessagePreview = ({ type, payload: payloadInput, text, title }) => {
    const payload = parseValue(payloadInput) || {};
    const body = typeof payload.text === 'string' ? payload.text : (text || '');
    const label = title || 'LINEメッセージプレビュー';
    const imageUrl = String(payload.originalContentUrl || payload.previewImageUrl || '');
    const videoUrl = String(payload.originalContentUrl || '');
    const contents = parseValue(payload.contents) || (payload.type === 'bubble' || payload.type === 'carousel' ? payload : null);
    return _jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50 p-3", "aria-label": label, children: [_jsxs("div", { className: "mb-2 flex items-center justify-between text-xs font-bold text-slate-700", children: [_jsx("span", { children: label }), _jsx("span", { className: "text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold", children: "LINE\u516C\u5F0F\u30D7\u30EC\u30D3\u30E5\u30FC" })] }), _jsxs("div", { className: "mx-auto max-w-[360px] rounded-2xl bg-[#70c776]/15 border border-emerald-200/60 p-3.5 shadow-inner", children: [type === 'text' && _jsx("div", { className: "ml-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 shadow-xs border border-slate-200/80 leading-relaxed font-sans", children: body || 'メッセージ本文がここに表示されます。' }), type === 'image' && _jsx("div", { className: "ml-auto w-fit max-w-[90%] overflow-hidden rounded-xl bg-white p-2 shadow-xs border border-slate-200/80", children: imageUrl ? _jsx("img", { src: imageUrl, alt: String(payload.altText || 'LINE配信画像'), className: "max-h-80 max-w-full rounded-lg object-contain" }) : _jsx("div", { className: "p-8 text-center text-xs text-slate-500", children: "\u753B\u50CF\u7D20\u6750\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }) }), type === 'video' && _jsxs("div", { className: "ml-auto w-fit max-w-[90%] overflow-hidden rounded-xl bg-white p-2 shadow-xs border border-slate-200/80", children: [videoUrl ? _jsx("video", { src: videoUrl, poster: String(payload.previewImageUrl || ''), controls: true, className: "max-h-80 max-w-full rounded-lg" }) : payload.previewImageUrl ? _jsx("img", { src: String(payload.previewImageUrl), alt: String(payload.altText || 'LINE動画プレビュー'), className: "max-h-80 max-w-full rounded-lg object-contain" }) : _jsx("div", { className: "p-8 text-center text-xs text-slate-500", children: "\u52D5\u753B\u7D20\u6750\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), payload.altText && _jsx("div", { className: "pt-1 text-xs text-slate-600 font-medium", children: String(payload.altText) })] }), type === 'flex' && _jsxs("div", { className: "ml-auto w-full max-w-[320px] overflow-hidden rounded-xl bg-white p-3 text-slate-900 shadow-xs border border-slate-200/80", children: [contents ? contents.type === 'carousel' ? _jsx("div", { className: "flex gap-3 overflow-x-auto", children: (contents.contents || []).map((bubble, i) => _jsx("div", { className: "min-w-[260px] max-w-[280px] rounded-lg border border-slate-200 p-3 bg-white shadow-2xs", children: _jsx(FlexNode, { node: bubble, index: i }) }, i)) }) : _jsx(FlexNode, { node: contents }) : _jsx("div", { className: "p-5 text-center text-xs text-rose-600", children: "Flex JSON\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093\u3002bubble\u307E\u305F\u306Fcarousel\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }), payload.altText && _jsxs("div", { className: "mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500", children: ["\u901A\u77E5\u6587: ", String(payload.altText)] })] })] })] });
};
