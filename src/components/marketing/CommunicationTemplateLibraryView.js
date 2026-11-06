import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X, Sparkles, Filter, Copy } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { LineMessagePreview } from '../LineMessagePreview';
import { InlineDeleteButton } from '../InlineDeleteButton';
import { PlaceholderAssist } from '../common/PlaceholderAssist';
export const CATEGORY_LABELS = {
    diagnosis: '診断のご案内',
    form: 'フォーム・アンケート案内',
    deal: '商談・相談日程調整',
    customer_meeting: '顧客面談・定期フォロー',
    document: '重要書類送付（見積・契約・請求）',
    sales_outreach: '営業アプローチ',
    nurturing_story: 'ナーチャリング・ストーリー',
    announcement: 'お知らせ・汎用連絡',
};
const BUCKET = 'mst-line-message-assets';
const typeLabel = { text: 'テキスト', image: '画像', flex: 'Flex', video: '動画' };
const PRESET_SNIPPETS = [
    {
        label: '【診断】無料経営診断のご案内',
        category: 'diagnosis',
        channel: 'email',
        name: '【診断】無料経営診断のご案内（標準版）',
        subject: '【3分無料診断のご案内】現状の仕組み化と改善ポイント｜{会社名} 様',
        body: `{お名前} 様\n\nいつもお世話になっております。有限会社MSTの大橋です。\n\n貴社の現状の経営・業務課題を可視化し、改善優先度を診断できる「3分無料診断」をご用意いたしました。\n下記の診断フォームより、3分ほどでご回答いただけます。\n\n▼ 3分無料診断フォーム\n{案内URL}\n\n回答完了後、即座に簡易レポートが生成され、専任チームからの改善アドバイスも受け取ることができます。\nぜひ現状の整理にお役立てください。\n\n--------------------\n有限会社MST\n担当: 大橋真人\n返信先: {差出人メール}\n--------------------`,
    },
    {
        label: '【日程調整】商談・個別相談（30分）',
        category: 'deal',
        channel: 'email',
        name: '【日程調整】30分オンライン個別相談のご案内',
        subject: '【オンライン個別相談】日程調整のお願い｜{会社名} 様',
        body: `{お名前} 様\n\nお世話になっております。有限会社MSTの大橋です。\n\nこの度はご相談いただきありがとうございます。\nオンライン（Google Meet）にて、30分の個別相談を実施させていただければと存じます。\n\n下記の日程調整ページより、ご都合の良い日時を1つお選びください。\nカレンダーから選択いただくと、自動で予約が確定し接続URLが発行されます。\n\n▼ 面談日程の選択（カレンダー）\n{面談予約URL}\n\n※所要時間: 約30分\n※当日は現状の課題感やご希望をざっくばらんにお伺いできれば幸いです。\n\n何かご都合が合わない場合は、本メールに希望日時を2〜3候補ご返信ください。\n何卒よろしくお願い申し上げます。\n\n有限会社MST 大橋真人`,
    },
    {
        label: '【フォーム】事前ヒアリングシート回答依頼',
        category: 'form',
        channel: 'email',
        name: '【フォーム】事前ヒアリングシートのご回答依頼',
        subject: '【ご回答のお願い】事前ヒアリングシート｜{会社名} 様',
        body: `{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n次回のお打ち合わせをより有意義な時間とするため、事前に貴社の現状について簡単なアンケートへのご回答をお願いしております。\n\n▼ 事前ヒアリングフォーム\n{案内URL}\n\n※所要時間: 約3〜5分\n事前に入力いただいた内容をもとに、具体的な改善案や資料を準備して面談に臨ませていただきます。\n\nご不明な点がございましたら本メールにご返信ください。\nよろしくお願いいたします。\n\n有限会社MST`,
    },
    {
        label: '【書類】お見積書の送付',
        category: 'document',
        channel: 'email',
        name: '【書類】お見積書のご送付（標準）',
        subject: '【お見積書の送付】{書類名}｜{会社名} 様',
        body: `{お名前} 様\n\n平素より大変お世話になっております。有限会社MSTの大橋です。\n\n先般はお打ち合わせのお時間をいただき、誠にありがとうございました。\nご相談いただきました内容に基づき、お見積書を作成いたしましたのでお送り申し上げます。\n\n下記のURLより、お見積内容をご確認いただけます。\n▼ お見積書\n{書類URL}\n\n【書類名】: {書類名}\n\n内容にご不明な点や追加のご要望がございましたら、いつでもお気軽にお申し付けください。\nご検討のほど、何卒よろしくお願い申し上げます。\n\n有限会社MST 大橋真人`,
    },
    {
        label: '【LINE Flex】診断・相談カード（選択肢付き）',
        category: 'diagnosis',
        channel: 'line',
        lineType: 'flex',
        name: '【LINE Flex】無料診断＆オンライン相談ご案内カード',
        altText: '【無料診断・個別相談のご案内】ご希望のメニューをお選びください',
        flexJson: JSON.stringify({
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    { type: 'text', text: '【MST】経営改善サポート', weight: 'bold', size: 'lg', color: '#1E293B' },
                    { type: 'text', text: '{お名前} 様、ご登録ありがとうございます。下記のメニューより、ご希望の案内をお選びください。', size: 'sm', color: '#475569', wrap: true },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'button',
                        style: 'primary',
                        color: '#10B981',
                        action: { type: 'uri', label: '📊 3分無料診断を始める', uri: '{案内URL}' },
                        margin: 'md'
                    },
                    {
                        type: 'button',
                        style: 'secondary',
                        action: { type: 'uri', label: '📅 30分オンライン相談を予約', uri: '{面談予約URL}' },
                        margin: 'sm'
                    }
                ]
            }
        }, null, 2),
        body: '',
    },
];
export const CommunicationTemplateLibraryView = () => {
    const db = getSupabase();
    const [emailTemplates, setEmailTemplates] = useState([]);
    const [lineTemplates, setLineTemplates] = useState([]);
    const [channelFilter, setChannelFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('diagnosis');
    const [channel, setChannel] = useState('email');
    const [lineType, setLineType] = useState('text');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [altText, setAltText] = useState('');
    const [flexJson, setFlexJson] = useState('');
    const [assetUrl, setAssetUrl] = useState('');
    const [assetPath, setAssetPath] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewPath, setPreviewPath] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const load = async () => {
        if (!db) {
            setError('Supabaseに接続してください。');
            setLoading(false);
            return;
        }
        setLoading(true);
        const [{ data: userData }, emailResult, lineResult] = await Promise.all([
            db.auth.getUser(),
            db.from('communication_templates').select('*').order('updated_at', { ascending: false }),
            db.from('line_auto_reply_templates').select('*').order('updated_at', { ascending: false }),
        ]);
        setOwnerId(userData.user?.id || '');
        if (emailResult.error) {
            setError('メールテンプレートを読み込めません。');
        }
        else {
            setEmailTemplates((emailResult.data || []));
        }
        if (lineResult.error) {
            setError((current) => current || 'LINEテンプレートを読み込めません。');
        }
        else {
            setLineTemplates((lineResult.data || []));
        }
        setLoading(false);
    };
    useEffect(() => {
        void load();
    }, []);
    const rows = useMemo(() => [
        ...emailTemplates.map((item) => ({
            source: 'communication',
            id: item.id,
            name: item.name?.trim() || `${CATEGORY_LABELS[item.category] || item.category} · ${item.template_key}`,
            channel: item.channel,
            type: 'text',
            category: item.category || 'announcement',
            updatedAt: item.updated_at,
            subject: item.subject || '',
            body: item.body_text || '',
        })),
        ...lineTemplates.map((item) => {
            // LINEテンプレートはタイトル等からカテゴリを類推、または汎用
            let inferredCat = 'announcement';
            const n = item.name.toLowerCase();
            if (n.includes('診断') || n.includes('カルテ'))
                inferredCat = 'diagnosis';
            else if (n.includes('面談') || n.includes('予約') || n.includes('日程') || n.includes('相談'))
                inferredCat = 'deal';
            else if (n.includes('フォーム') || n.includes('アンケート'))
                inferredCat = 'form';
            else if (n.includes('書類') || n.includes('請求') || n.includes('見積') || n.includes('契約'))
                inferredCat = 'document';
            else if (n.includes('営業') || n.includes('アプローチ'))
                inferredCat = 'sales_outreach';
            else if (n.includes('ストーリー') || n.includes('大橋'))
                inferredCat = 'nurturing_story';
            return {
                source: 'line',
                id: item.id,
                name: item.name,
                channel: 'line',
                type: item.reply_type,
                category: inferredCat,
                updatedAt: item.updated_at,
                payload: item.payload || {},
            };
        }),
    ], [emailTemplates, lineTemplates]);
    const visibleRows = useMemo(() => {
        return rows.filter((item) => {
            // チャンネル・形式フィルター
            if (channelFilter !== 'all') {
                if (channelFilter === 'email' && item.channel !== 'email')
                    return false;
                if (channelFilter !== 'email' && (item.channel !== 'line' || item.type !== channelFilter))
                    return false;
            }
            // カテゴリフィルター
            if (categoryFilter !== 'all' && item.category !== categoryFilter) {
                return false;
            }
            // 検索クエリ
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchesName = item.name.toLowerCase().includes(q);
                const matchesCat = (CATEGORY_LABELS[item.category] || item.category).toLowerCase().includes(q);
                const matchesSubject = item.source === 'communication' && item.subject.toLowerCase().includes(q);
                const matchesBody = item.source === 'communication' && item.body.toLowerCase().includes(q);
                if (!matchesName && !matchesCat && !matchesSubject && !matchesBody)
                    return false;
            }
            return true;
        });
    }, [rows, channelFilter, categoryFilter, searchQuery]);
    const resetEditor = () => {
        setEditing(null);
        setName('');
        setCategory('diagnosis');
        setChannel('email');
        setLineType('text');
        setSubject('');
        setBody('');
        setAltText('');
        setFlexJson('');
        setAssetUrl('');
        setAssetPath('');
        setPreviewUrl('');
        setPreviewPath('');
        setEditorOpen(false);
    };
    const startCreate = () => {
        resetEditor();
        setError('');
        setNotice('');
        setEditorOpen(true);
    };
    const applyPreset = (preset) => {
        setName(preset.name);
        setCategory(preset.category);
        setChannel(preset.channel);
        if (preset.channel === 'email') {
            setLineType('text');
            setSubject(preset.subject || '');
            setBody(preset.body || '');
            setAltText('');
            setFlexJson('');
        }
        else {
            setLineType(preset.lineType || 'text');
            setSubject('');
            setBody(preset.body || '');
            setAltText(preset.altText || '');
            setFlexJson(preset.flexJson || '');
        }
    };
    const startEdit = (item) => {
        setEditing(item);
        setName(item.name);
        setCategory(item.category || 'announcement');
        setChannel(item.channel);
        if (item.source === 'communication') {
            setLineType('text');
            setSubject(item.subject);
            setBody(item.body);
            setAssetUrl('');
            setPreviewUrl('');
            setAssetPath('');
            setPreviewPath('');
            setAltText('');
            setFlexJson('');
        }
        else {
            const payload = item.payload || {};
            setLineType(item.type);
            setSubject('');
            setBody(String(payload.text || ''));
            setAltText(String(payload.altText || ''));
            setFlexJson(payload.contents ? JSON.stringify(payload.contents, null, 2) : '');
            const paths = Array.isArray(payload.storagePaths) ? payload.storagePaths : [];
            const isVideo = item.type === 'video';
            setAssetUrl(isVideo ? String(payload.originalContentUrl || '') : item.type === 'image' ? String(payload.originalContentUrl || '') : '');
            setPreviewUrl(String(payload.previewImageUrl || ''));
            setAssetPath(typeof paths[0] === 'string' ? paths[0] : '');
            setPreviewPath(typeof paths[1] === 'string' ? paths[1] : '');
        }
        setError('');
        setNotice('');
        setEditorOpen(true);
    };
    const uploadAsset = async (file, kind) => {
        if (!db || !ownerId)
            throw new Error('ログイン状態を確認してください。');
        if (file.size > 20 * 1024 * 1024)
            throw new Error('ファイルは20MB以下にしてください。');
        const allowed = kind === 'video' ? ['video/mp4'] : ['image/jpeg', 'image/png'];
        if (!allowed.includes(file.type))
            throw new Error(kind === 'video' ? '動画はMP4形式を選択してください。' : '画像はJPEGまたはPNG形式を選択してください。');
        const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'asset';
        const path = `${ownerId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError)
            throw new Error(`素材をアップロードできませんでした: ${uploadError.message}`);
        const { data } = db.storage.from(BUCKET).getPublicUrl(path);
        return { path, url: data.publicUrl };
    };
    const onUpload = async (file, slot) => {
        if (!file)
            return;
        setBusy(true);
        setError('');
        try {
            const uploaded = await uploadAsset(file, slot === 'asset' && lineType === 'video' ? 'video' : 'image');
            if (slot === 'asset') {
                setAssetPath(uploaded.path);
                setAssetUrl(uploaded.url);
            }
            else {
                setPreviewPath(uploaded.path);
                setPreviewUrl(uploaded.url);
            }
        }
        catch (e) {
            setError(e.message || '素材をアップロードできませんでした。');
        }
        finally {
            setBusy(false);
        }
    };
    const removeStoredAssets = async (paths) => {
        const uniquePaths = [...new Set(paths.filter(Boolean))];
        if (!db || uniquePaths.length === 0)
            return;
        const { error: storageError } = await db.storage.from(BUCKET).remove(uniquePaths);
        if (storageError)
            setError((current) => current || `テンプレートは保存しましたが、古い素材を削除できませんでした: ${storageError.message}`);
    };
    const saveTemplate = async (event) => {
        event.preventDefault();
        if (!db) {
            setError('Supabaseに接続してください。');
            return;
        }
        if (!ownerId) {
            setError('ログインしてください。');
            return;
        }
        if (!name.trim()) {
            setError('テンプレート名を入力してください。');
            return;
        }
        setError('');
        setNotice('');
        let linePayload = null;
        if (channel === 'line') {
            if (lineType === 'text' && !body.trim()) {
                setError('本文を入力してください。');
                return;
            }
            if ((lineType === 'image' || lineType === 'video') && (!assetUrl || !previewUrl || !assetPath || !previewPath)) {
                setError('素材本体とプレビュー画像をアップロードしてください。');
                return;
            }
            if (lineType === 'video' && !altText.trim()) {
                setError('動画の代替テキストを入力してください。');
                return;
            }
            if (lineType === 'flex') {
                if (!altText.trim()) {
                    setError('Flexメッセージの代替テキストを入力してください。');
                    return;
                }
                try {
                    const contents = JSON.parse(flexJson);
                    if (!contents || typeof contents !== 'object' || !['bubble', 'carousel'].includes(contents.type)) {
                        throw new Error();
                    }
                    linePayload = { altText: altText.trim(), contents };
                }
                catch {
                    setError('Flex本文はbubbleまたはcarousel形式の正しいJSONで入力してください。');
                    return;
                }
            }
            else if (lineType === 'text') {
                linePayload = { text: body.trim() };
            }
            else {
                linePayload = {
                    originalContentUrl: assetUrl,
                    previewImageUrl: previewUrl,
                    ...(lineType === 'video' ? { altText: altText.trim() } : {}),
                    storagePaths: [assetPath, previewPath],
                };
            }
        }
        setBusy(true);
        let saveError = null;
        let oldPaths = [];
        if (editing?.source === 'communication' || (!editing && channel === 'email')) {
            const previous = editing?.source === 'communication' ? emailTemplates.find((item) => item.id === editing.id) : null;
            if (editing?.source === 'communication' && previous) {
                const { error: updateError } = await db.from('communication_templates').update({
                    name: name.trim(),
                    category,
                    subject: channel === 'email' ? subject : '',
                    body_text: body,
                    updated_at: new Date().toISOString(),
                }).eq('id', editing.id);
                saveError = updateError;
            }
            else {
                const { error: insertError } = await db.from('communication_templates').insert({
                    owner_id: ownerId,
                    template_key: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    category,
                    channel: 'email',
                    name: name.trim(),
                    subject,
                    body_text: body,
                });
                saveError = insertError;
            }
        }
        else {
            const previous = editing?.source === 'line' ? lineTemplates.find((item) => item.id === editing.id) : null;
            const oldPayload = previous?.payload || {};
            oldPaths = Array.isArray(oldPayload.storagePaths) ? oldPayload.storagePaths.filter((path) => typeof path === 'string') : [];
            const payload = linePayload || { text: body.trim() };
            const result = editing?.source === 'line'
                ? await db.from('line_auto_reply_templates').update({
                    name: name.trim(),
                    reply_type: lineType,
                    payload,
                    updated_at: new Date().toISOString(),
                }).eq('id', editing.id)
                : await db.from('line_auto_reply_templates').insert({
                    owner_id: ownerId,
                    name: name.trim(),
                    reply_type: lineType,
                    payload,
                });
            saveError = result.error;
            if (saveError)
                oldPaths = [];
        }
        if (saveError) {
            setError(saveError.message);
        }
        else {
            if (editing?.source === 'line') {
                const savedPayload = linePayload || { text: body.trim() };
                const retainedPaths = Array.isArray(savedPayload.storagePaths) ? savedPayload.storagePaths : [];
                await removeStoredAssets(oldPaths.filter((path) => !retainedPaths.includes(path)));
            }
            setNotice('テンプレートを保存しました。送信センター（個別送信・一斉配信）および自動配信シナリオで即座に選べます。');
            resetEditor();
            await load();
        }
        setBusy(false);
    };
    const deleteTemplate = async (item) => {
        if (!db)
            return;
        setError('');
        setNotice('');
        const result = item.source === 'communication'
            ? await db.from('communication_templates').delete().eq('id', item.id)
            : await db.from('line_auto_reply_templates').delete().eq('id', item.id);
        if (result.error) {
            setError(result.error.message);
            return;
        }
        if (item.source === 'line') {
            const paths = Array.isArray(item.payload.storagePaths) ? item.payload.storagePaths.filter((path) => typeof path === 'string') : [];
            await removeStoredAssets(paths);
        }
        setNotice(`テンプレート「${item.name}」を削除しました。`);
        await load();
    };
    const typeOf = (item) => item.source === 'communication' ? (item.channel === 'email' ? 'メール文面' : 'テキスト') : typeLabel[item.type];
    const channelFilterItems = [
        { id: 'all', label: '全形式' },
        { id: 'email', label: 'メール' },
        { id: 'text', label: 'LINEテキスト' },
        { id: 'flex', label: 'LINE Flex' },
        { id: 'image', label: 'LINE画像' },
        { id: 'video', label: 'LINE動画' },
    ];
    return (_jsxs("section", { className: "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-slate-800", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u5B9A\u578B\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u4FDD\u7BA1\u5EAB" }), _jsx("p", { className: "mt-0.5 text-xs text-slate-500", children: "\u8A3A\u65AD\u6848\u5185\u30FB\u9762\u8AC7\u8ABF\u6574\u30FB\u66F8\u985E\u9001\u4ED8\u30FB\u55B6\u696D\u30E1\u30FC\u30EB\u30FBLINE Flex\u306A\u3069\u5168\u793E\u5171\u901A\u306E\u5B9A\u578B\u6587\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u7BA1\u7406\u3057\u307E\u3059\u3002" })] }), _jsxs("button", { type: "button", onClick: startCreate, className: "inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition cursor-pointer shadow-xs", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), "\u65B0\u898F\u4F5C\u6210"] })] }), (error || notice) && (_jsx("div", { role: error ? 'alert' : 'status', className: error ? 'rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800', children: error || notice })), _jsxs("div", { className: "rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 space-y-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-bold text-purple-900", children: [_jsx(Sparkles, { className: "h-3.5 w-3.5 text-purple-600" }), _jsx("span", { children: "\u3088\u304F\u4F7F\u3046\u5B9A\u578B\u96DB\u5F62\uFF08\u30AF\u30EA\u30C3\u30AF\u3067\u65B0\u898F\u4F5C\u6210\u306B\u53CD\u6620\uFF09" })] }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: PRESET_SNIPPETS.map((preset, idx) => (_jsxs("button", { type: "button", onClick: () => {
                                resetEditor();
                                applyPreset(preset);
                                setEditorOpen(true);
                            }, className: "inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 px-2.5 py-1 text-xs text-purple-800 transition cursor-pointer shadow-2xs font-medium", children: [_jsx(Copy, { className: "h-3 w-3 text-purple-600" }), _jsx("span", { children: preset.label })] }, idx))) })] }), _jsxs("div", { className: "space-y-2.5 pt-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [_jsxs("span", { className: "text-xs font-bold text-slate-700 mr-1 flex items-center gap-1", children: [_jsx(Filter, { className: "h-3.5 w-3.5 text-purple-600" }), " \u7528\u9014:"] }), _jsx("button", { type: "button", onClick: () => setCategoryFilter('all'), className: `rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${categoryFilter === 'all'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`, children: "\u3059\u3079\u3066" }), Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (_jsx("button", { type: "button", onClick: () => setCategoryFilter(catKey), className: `rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${categoryFilter === catKey
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`, children: catLabel }, catKey)))] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 pt-1", children: [_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [_jsx("span", { className: "text-xs font-bold text-slate-700 mr-1", children: "\u5A92\u4F53:" }), channelFilterItems.map((item) => (_jsx("button", { type: "button", onClick: () => setChannelFilter(item.id), className: `rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${channelFilter === item.id
                                            ? 'border-purple-300 bg-purple-50 text-purple-800 font-bold'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`, children: item.label }, item.id)))] }), _jsx("div", { className: "w-full sm:w-64", children: _jsx("input", { type: "text", placeholder: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u540D\u3084\u672C\u6587\u3067\u691C\u7D22\u2026", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:outline-none shadow-2xs" }) })] })] }), editorOpen && (_jsxs("form", { onSubmit: (event) => void saveTemplate(event), className: "space-y-4 rounded-xl border border-purple-200 bg-purple-50/20 p-5 shadow-lg", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-200 pb-3", children: [_jsx("div", { children: _jsxs("h3", { className: "text-sm font-bold text-slate-900 flex items-center gap-2", children: [_jsx("span", { children: editing ? 'テンプレートを編集' : '新規テンプレート作成' }), _jsx("span", { className: "text-xs font-normal text-slate-500", children: "\uFF08\u5168\u793E\u5171\u901A\u30DE\u30B9\u30BF\u30FC\uFF09" })] }) }), _jsx("button", { type: "button", onClick: resetEditor, className: "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsxs("label", { className: "text-xs font-bold text-slate-700 md:col-span-2", children: ["\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u540D ", _jsx("span", { className: "text-rose-500", children: "*" }), _jsx("input", { required: true, maxLength: 120, placeholder: "\u4F8B: \u3010\u8A3A\u65AD\u3011\u88FD\u9020\u696D\u5411\u30513\u5206\u7121\u6599\u8A3A\u65AD\u6848\u5185\uFF08\u30AA\u30F3\u30E9\u30A4\u30F3\u9762\u8AC7URL\u4ED8\u304D\uFF09", value: name, onChange: (event) => setName(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 shadow-2xs" })] }), _jsxs("label", { className: "text-xs font-bold text-slate-700", children: ["\u7528\u9014\uFF08\u30AB\u30C6\u30B4\u30EA\uFF09 ", _jsx("span", { className: "text-rose-500", children: "*" }), _jsx("select", { value: category, onChange: (event) => setCategory(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 shadow-2xs", children: Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (_jsx("option", { value: catKey, children: catLabel }, catKey))) })] }), _jsxs("label", { className: "text-xs font-bold text-slate-700", children: ["\u914D\u4FE1\u30C1\u30E3\u30CD\u30EB", _jsxs("select", { disabled: !!editing, value: channel, onChange: (event) => {
                                            const value = event.target.value;
                                            setChannel(value);
                                            if (value === 'email')
                                                setLineType('text');
                                        }, className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 shadow-2xs", children: [_jsx("option", { value: "email", children: "\u30E1\u30FC\u30EB" }), _jsx("option", { value: "line", children: "LINE" })] })] }), channel === 'line' && (_jsxs("label", { className: "text-xs font-bold text-slate-700", children: ["LINE\u5F62\u5F0F", _jsx("select", { disabled: editing?.source === 'communication', value: lineType, onChange: (event) => {
                                            setLineType(event.target.value);
                                            setBody('');
                                            setAltText('');
                                            setFlexJson('');
                                            setAssetUrl('');
                                            setAssetPath('');
                                            setPreviewUrl('');
                                            setPreviewPath('');
                                        }, className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 shadow-2xs", children: Object.entries(typeLabel).map(([key, label]) => (_jsx("option", { value: key, children: label }, key))) })] })), channel === 'email' && (_jsxs("div", { className: "md:col-span-2", children: [_jsxs("label", { className: "text-xs font-bold text-slate-700", children: ["\u4EF6\u540D ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { required: true, maxLength: 200, placeholder: "\u4F8B: \u30103\u5206\u7121\u6599\u8A3A\u65AD\u3011\u6539\u5584\u512A\u5148\u5EA6\u30EC\u30DD\u30FC\u30C8\u306E\u3054\u6848\u5185\uFF5C{\u4F1A\u793E\u540D} \u69D8", value: subject, onChange: (event) => setSubject(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 shadow-2xs" }), _jsx(PlaceholderAssist, { text: subject, onInsert: (token) => setSubject((curr) => curr + token) })] })), (channel === 'email' || lineType === 'text') && (_jsxs("div", { className: "md:col-span-3", children: [_jsxs("label", { className: "text-xs font-bold text-slate-700", children: ["\u672C\u6587 ", _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("textarea", { required: true, rows: 8, maxLength: 10000, value: body, onChange: (event) => setBody(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 font-sans leading-relaxed focus:border-purple-500 shadow-2xs", placeholder: "\u304A\u540D\u524D\u306F {\u304A\u540D\u524D}\u3001\u4F1A\u793E\u540D\u306F {\u4F1A\u793E\u540D}\u3001\u8A3A\u65ADURL\u306F {\u6848\u5185URL}\u3001\u9762\u8AC7\u30AB\u30EC\u30F3\u30C0\u30FC\u306F {\u9762\u8AC7\u4E88\u7D04URL} \u306E\u3088\u3046\u306B\u57CB\u3081\u8FBC\u3081\u307E\u3059\u3002" }), _jsx(PlaceholderAssist, { text: body, onInsert: (token) => setBody((curr) => curr + token) })] })), channel === 'line' && (lineType === 'image' || lineType === 'video') && (_jsxs("div", { className: "space-y-3 md:col-span-3", children: [_jsxs("label", { className: "block text-xs font-bold text-slate-700", children: [lineType === 'video' ? '動画ファイル（MP4）' : '画像ファイル（JPEG / PNG）', _jsx("input", { type: "file", accept: lineType === 'video' ? 'video/mp4' : 'image/jpeg,image/png', onChange: (event) => void onUpload(event.target.files?.[0], 'asset'), className: "mt-1 block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:text-slate-700" }), assetUrl && _jsxs("span", { className: "mt-1 block break-all text-[11px] text-purple-700 font-mono", children: ["URL: ", assetUrl] })] }), _jsxs("label", { className: "block text-xs font-bold text-slate-700", children: ["\u30D7\u30EC\u30D3\u30E5\u30FC\u753B\u50CF\uFF08JPEG / PNG\uFF09", _jsx("input", { type: "file", accept: "image/jpeg,image/png", onChange: (event) => void onUpload(event.target.files?.[0], 'preview'), className: "mt-1 block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:text-slate-700" }), previewUrl && _jsxs("span", { className: "mt-1 block break-all text-[11px] text-purple-700 font-mono", children: ["URL: ", previewUrl] })] }), lineType === 'video' && (_jsxs("label", { className: "block text-xs font-bold text-slate-700", children: ["\u4EE3\u66FF\u30C6\u30AD\u30B9\u30C8", _jsx("input", { required: true, value: altText, onChange: (event) => setAltText(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 shadow-2xs" })] }))] })), channel === 'line' && lineType === 'flex' && (_jsxs("div", { className: "space-y-3 md:col-span-3", children: [_jsxs("label", { className: "block text-xs font-bold text-slate-700", children: ["\u4EE3\u66FF\u30C6\u30AD\u30B9\u30C8\uFF08\u30D7\u30C3\u30B7\u30E5\u901A\u77E5\u3084\u4E00\u89A7\u306B\u8868\u793A\u3055\u308C\u308B\u6587\u5B57\uFF09 ", _jsx("span", { className: "text-rose-500", children: "*" }), _jsx("input", { required: true, value: altText, onChange: (event) => setAltText(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-purple-500 shadow-2xs" })] }), _jsxs("label", { className: "block text-xs font-bold text-slate-700", children: ["Flex JSON\u69CB\u9020 ", _jsx("span", { className: "text-rose-500", children: "*" }), _jsx("textarea", { required: true, rows: 9, value: flexJson, onChange: (event) => setFlexJson(event.target.value), className: "mt-1 block w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 focus:border-purple-500 shadow-2xs", placeholder: '{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[...]}}' }), _jsx(PlaceholderAssist, { text: flexJson, onInsert: (token) => setFlexJson((curr) => curr + token), showPreview: false })] })] }))] }), channel === 'line' && (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-4", children: [_jsx("span", { className: "text-xs font-bold text-slate-700 mb-2 block", children: "LINE\u9001\u4FE1\u30D7\u30EC\u30D3\u30E5\u30FC:" }), _jsx(LineMessagePreview, { type: lineType, title: name || 'LINEテンプレート', payload: lineType === 'text'
                                    ? { text: body }
                                    : lineType === 'image'
                                        ? { originalContentUrl: assetUrl, previewImageUrl: previewUrl }
                                        : lineType === 'video'
                                            ? { originalContentUrl: assetUrl, previewImageUrl: previewUrl, altText }
                                            : { altText, contents: flexJson } })] })), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-2 border-t border-slate-200", children: [_jsx("button", { type: "button", onClick: resetEditor, className: "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs", children: "\u30AD\u30E3\u30F3\u30BB\u30EB" }), _jsxs("button", { disabled: busy, type: "submit", className: "inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 shadow-xs cursor-pointer", children: [_jsx(Save, { className: "h-4 w-4" }), busy ? '保存中…' : 'テンプレートを保存'] })] })] })), _jsx("div", { className: "overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs", children: _jsxs("table", { className: "w-full min-w-[720px] text-left text-xs", children: [_jsx("thead", { className: "bg-slate-50 text-slate-600 font-bold border-b border-slate-200", children: _jsxs("tr", { children: [_jsx("th", { className: "p-3", children: "\u5A92\u4F53" }), _jsx("th", { className: "p-3", children: "\u30AB\u30C6\u30B4\u30EA\uFF08\u7528\u9014\uFF09" }), _jsx("th", { className: "p-3", children: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u540D" }), _jsx("th", { className: "p-3", children: "\u66F4\u65B0\u65E5\u6642" }), _jsx("th", { className: "p-3 text-right", children: "\u64CD\u4F5C" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "p-6 text-center text-slate-400", children: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" }) })) : visibleRows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "p-8 text-center text-slate-500", children: "\u6761\u4EF6\u306B\u5408\u81F4\u3059\u308B\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u300C\u65B0\u898F\u4F5C\u6210\u300D\u307E\u305F\u306F\u4E0A\u90E8\u306E\u30D7\u30EA\u30BB\u30C3\u30C8\u304B\u3089\u8FFD\u52A0\u3067\u304D\u307E\u3059\u3002" }) })) : (visibleRows.map((item) => (_jsxs("tr", { className: "text-slate-800 hover:bg-slate-50/70 transition", children: [_jsx("td", { className: "p-3", children: _jsx("span", { className: `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${item.channel === 'email' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`, children: item.channel === 'email' ? 'メール' : `LINE (${typeOf(item)})` }) }), _jsx("td", { className: "p-3", children: _jsx("span", { className: "rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-700 font-medium", children: CATEGORY_LABELS[item.category] || item.category }) }), _jsxs("td", { className: "p-3", children: [_jsx("div", { className: "font-bold text-slate-900", children: item.name }), item.source === 'communication' && item.subject && (_jsxs("div", { className: "text-slate-500 truncate max-w-md mt-0.5", children: ["\u4EF6\u540D: ", item.subject] }))] }), _jsx("td", { className: "p-3 text-slate-400", children: item.updatedAt ? new Date(item.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }), _jsx("td", { className: "p-3 text-right", children: _jsxs("div", { className: "inline-flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => startEdit(item), className: "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs", children: "\u7DE8\u96C6" }), _jsxs(InlineDeleteButton, { warning: `テンプレート「${item.name}」を削除しますか？${item.source === 'line' ? ' 関連ファイルも削除されます。' : ''}`, onConfirm: () => deleteTemplate(item), children: [_jsx(Trash2, { className: "mr-1 inline h-3 w-3" }), "\u524A\u9664"] })] }) })] }, item.source + item.id)))) })] }) }), _jsxs("div", { className: "flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1", children: [_jsxs("span", { children: ["\u5408\u8A08 ", visibleRows.length, " \u4EF6\u306E\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u8868\u793A\u4E2D"] }), _jsx("span", { children: "\u203BLINE\u753B\u50CF\u30FB\u52D5\u753B\u306E\u7D20\u6750\u30D5\u30A1\u30A4\u30EB\u306FSupabase Storage\u3067\u30BB\u30AD\u30E5\u30A2\u306B\u7BA1\u7406\u3055\u308C\u307E\u3059\u3002" })] })] }));
};
