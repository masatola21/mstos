import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { InlineDeleteButton } from './InlineDeleteButton';
import { ArrowDown, ArrowUp, Clipboard, ClipboardCheck, ExternalLink, Plus, RefreshCw, Save, Trash2, Sparkles, AlertCircle } from 'lucide-react';
export const MST_OFFICIAL_BOTTLENECK_QUESTIONS = [
    {
        id: 'q_ops_bottleneck',
        label: '【業務・手作業】日々の業務で最も時間や手間を奪われている手作業・ボトルネックは何ですか？',
        type: 'radio',
        required: true,
        options: [
            '請求書・見積書等の作成やツール間の二重入力・転記作業',
            '顧客対応や連絡漏れ・対応状況の確認に追われている',
            '経営者や特定の人に仕事が集中し、属人化している',
            '情報が散乱しており、どこに何があるか探す時間が長い',
            '特に大きな手作業の負担はなく、自走できている',
        ],
    },
    {
        id: 'q_profit_bottleneck',
        label: '【売上・利益】売上と利益の現状について、最も当てはまるお悩みは何ですか？',
        type: 'radio',
        required: true,
        options: [
            '売上はある程度あるが、手元に利益が残りにくい',
            '集客から商談・フォローまでの導線が分断され、案件化が漏れている',
            '日々の業務に追われ、単価アップや利益改善の見直しに着手できていない',
            '営業や顧客獲得が経営者の人脈や属人的な力に依存している',
            '利益は順調に出ており、さらなる事業拡大・新事業を目指したい',
        ],
    },
    {
        id: 'q_delay_reason',
        label: '【改善停滞の原因】「改善したい」と思いながらも後回しになっている主な原因は何ですか？',
        type: 'radio',
        required: true,
        options: [
            '日々の現場業務や火消しに追われ、改善を考える時間がない',
            '何から手を付ければ一番効果が出るか、優先順位が分からない',
            'ツールを導入してみたが、自社の業務に合わず定着しなかった',
            '改善を伴走・相談できる右腕（パートナー）が社内外にいない',
            '計画はあるが、社内だけで実行を継続するのが難しい',
        ],
    },
    {
        id: 'q_ideal_future',
        label: '【目指したい未来】仕組み化によって経営者の時間と利益が創出できたら、何に一番時間を使いたいですか？',
        type: 'radio',
        required: true,
        options: [
            '経営判断や戦略・次の一手（新規事業や新収益源の立ち上げ）',
            '既存事業の利益率向上とマーケティング・集客の強化',
            '組織化・人材育成・権限移譲を進め、自走する組織づくり',
            '経営者自身の余白・休日の確保と健康管理',
            'まずは目の前の手作業を減らし、日々の負担を軽減したい',
        ],
    },
    {
        id: 'q_free_notes',
        label: '現在最も気になっていることや、相談したい課題があればご自由にご記入ください（任意）',
        type: 'textarea',
        required: false,
        options: [],
    },
];
const DEFAULT_PRIVACY_NOTICE = 'ご入力いただいた情報は、お問い合わせ・お申し込みへの対応および関連するご連絡のために利用します。個人情報の取り扱いに関するお問い合わせは、運営者までご連絡ください。';
const FORM_TYPES = [
    { value: 'diagnosis', label: '診断申込' },
    { value: 'consultation', label: '相談申込' },
    { value: 'meeting', label: '面談申込' },
];
const QUESTION_TYPES = [
    { value: 'text', label: '一行入力' },
    { value: 'textarea', label: '複数行入力' },
    { value: 'select', label: 'プルダウン選択' },
    { value: 'radio', label: '単一選択' },
    { value: 'checkbox', label: 'チェックボックス' },
    { value: 'date', label: '日付' },
];
function newQuestion() {
    return { id: 'question_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), label: '', type: 'text', required: false, options: [] };
}
function readDefinition(value) {
    const definition = value && typeof value === 'object' ? value : {};
    const rawQuestions = Array.isArray(definition.questions) ? definition.questions : [];
    const questions = rawQuestions.slice(0, 40).filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.label === 'string').map((item) => ({
        id: item.id,
        label: item.label,
        type: QUESTION_TYPES.some((type) => type.value === item.type) ? item.type : 'text',
        required: Boolean(item.required),
        options: Array.isArray(item.options) ? item.options.filter((option) => typeof option === 'string') : [],
    }));
    return {
        category: typeof definition.category === 'string' ? definition.category : typeof definition.service_category === 'string' ? definition.service_category : '',
        description: typeof definition.description === 'string' ? definition.description : '',
        booking_url: typeof definition.booking_url === 'string' ? definition.booking_url : '',
        material_url: typeof definition.material_url === 'string' ? definition.material_url : '',
        questions: questions.length ? questions : [newQuestion()],
    };
}
export const DiagnosisFormsWorkspace = ({ initialLeadId, initialCompanyId, initialSection, activeSection, showHeader = true, onOpenDiagnosis, onOpenSendCenter }) => {
    const [section, setSection] = useState(initialSection || (initialLeadId || initialCompanyId ? 'answers' : 'forms'));
    const [forms, setForms] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [bookingUrl, setBookingUrl] = useState('');
    const [materialUrl, setMaterialUrl] = useState('');
    const [formType, setFormType] = useState('consultation');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState([newQuestion()]);
    const [privacyNotice, setPrivacyNotice] = useState(DEFAULT_PRIVACY_NOTICE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [copiedId, setCopiedId] = useState('');
    const visibleAnswers = answers.filter((answer) => (!initialLeadId || answer.lead_id === initialLeadId) &&
        (!initialCompanyId || answer.company_id === initialCompanyId));
    const selectForm = (form) => {
        const definition = readDefinition(form.definition);
        setSelectedId(form.id);
        setName(form.name);
        setCategory(definition.category || '');
        setBookingUrl(definition.booking_url || '');
        setMaterialUrl(definition.material_url || '');
        setFormType(form.form_type || 'diagnosis');
        setDescription(definition.description || '');
        setQuestions(definition.questions);
        setPrivacyNotice(form.privacy_notice || DEFAULT_PRIVACY_NOTICE);
    };
    const applyOfficialBottleneckPreset = async (autoSave = false) => {
        setName('経営課題・業務診断フォーム');
        setCategory('経営の仕組み化 × 利益改善');
        setBookingUrl('');
        setFormType('diagnosis');
        setDescription('貴社の現状の経営課題（業務の手作業・売上利益・改善停滞原因・経営者の時間）のボトルネックを特定し、仕組み化と利益改善に向けた最適なロードマップを作成するための診断フォームです。');
        setQuestions(MST_OFFICIAL_BOTTLENECK_QUESTIONS);
        setPrivacyNotice(DEFAULT_PRIVACY_NOTICE);
        if (autoSave) {
            const supabase = getSupabase();
            if (!supabase) {
                setError('Supabaseに接続してください。');
                return;
            }
            setLoading(true);
            setError('');
            setNotice('');
            try {
                const payload = {
                    name: '経営課題・業務診断フォーム',
                    form_type: 'diagnosis',
                    questionnaire_version: 'v2.0-bottleneck',
                    definition: {
                        category: '経営の仕組み化 × 利益改善',
                        description: '貴社の現状の経営課題（業務の手作業・売上利益・改善停滞原因・経営者の時間）のボトルネックを特定し、仕組み化と利益改善に向けた最適なロードマップを作成するための診断フォームです。',
                        booking_url: bookingUrl.trim(),
                        questions: MST_OFFICIAL_BOTTLENECK_QUESTIONS,
                    },
                    privacy_notice: DEFAULT_PRIVACY_NOTICE,
                };
                const slug = 'business-diagnosis';
                const result = selectedId
                    ? await supabase.from('diagnosis_forms').update(payload).eq('id', selectedId)
                    : await supabase.from('diagnosis_forms').insert({ ...payload, public_slug: slug, status: 'published' });
                if (result.error)
                    throw result.error;
                setNotice('営業資料準拠の最新ボトルネック診断設問を保存しました。');
                await load();
            }
            catch (e) {
                setError(e?.message || '保存できませんでした。');
            }
            finally {
                setLoading(false);
            }
        }
        else {
            setNotice('営業資料準拠の最新設問（4大ボトルネック＋自由記述）を編集欄に反映しました。「変更を保存」ボタンを押して確定してください。');
        }
    };
    const resetForm = () => {
        setSelectedId('');
        setName('');
        setCategory('');
        setFormType('consultation');
        setDescription('');
        setBookingUrl('');
        setMaterialUrl('');
        setQuestions([newQuestion()]);
        setPrivacyNotice(DEFAULT_PRIVACY_NOTICE);
    };
    const load = async () => {
        const supabase = getSupabase();
        if (!supabase) {
            setError('Supabaseに接続してください。');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [formResult, answerResult] = await Promise.all([
                supabase.from('diagnosis_forms').select('*').order('created_at', { ascending: false }),
                supabase.from('diagnosis_submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
            ]);
            if (formResult.error)
                throw formResult.error;
            if (answerResult.error)
                throw answerResult.error;
            const loadedForms = (formResult.data || []);
            setForms(loadedForms);
            if (selectedId) {
                const stillSelected = loadedForms.find((f) => f.id === selectedId);
                if (stillSelected)
                    selectForm(stillSelected);
                else
                    resetForm();
            }
            else if (loadedForms.length > 0) {
                selectForm(loadedForms[0]);
            }
            setAnswers((answerResult.data || []));
        }
        catch (e) {
            setError(e?.message || 'フォーム・回答を読み込めませんでした。');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);
    useEffect(() => { if (activeSection)
        setSection(activeSection); }, [activeSection]);
    const saveForm = async (event) => {
        event.preventDefault();
        const supabase = getSupabase();
        if (!supabase || !name.trim())
            return;
        if (!questions.length) {
            setError('設問を1つ以上追加してください。');
            return;
        }
        if (questions.some((question) => !question.label.trim())) {
            setError('設問文を入力してください。');
            return;
        }
        if (questions.some((question) => (question.type === 'select' || question.type === 'radio') && question.options.filter(Boolean).length < 2)) {
            setError('選択式の設問には選択肢を2つ以上入力してください。');
            return;
        }
        if (new Set(questions.map((question) => question.id)).size !== questions.length) {
            setError('設問IDが重複しています。');
            return;
        }
        setError('');
        setNotice('');
        const definition = {
            category: category.trim(),
            description: description.trim(),
            booking_url: bookingUrl.trim(),
            material_url: materialUrl.trim(),
            questions,
        };
        const slug = (name.trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-|-$/g, '') || 'form') + '-' + crypto.randomUUID().slice(0, 8);
        const payload = {
            name: name.trim(),
            form_type: formType,
            questionnaire_version: 'v1.0',
            definition,
            privacy_notice: privacyNotice.trim() || null,
        };
        const result = selectedId
            ? await supabase.from('diagnosis_forms').update(payload).eq('id', selectedId)
            : await supabase.from('diagnosis_forms').insert({ ...payload, public_slug: slug, status: 'draft' });
        if (result.error) {
            setError(result.error.message);
            return;
        }
        setNotice(selectedId ? 'フォーム定義を保存しました。' : 'フォームを下書き保存しました。フォーム一覧から選択して公開できます。');
        await load();
    };
    const updateStatus = async (form, status) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        if (status === 'published' && !form.privacy_notice?.trim()) {
            setError('公開する前にフォームを編集し、個人情報の取り扱い案内を保存してください。');
            return;
        }
        setError('');
        setNotice('');
        const { error: updateError } = await supabase.from('diagnosis_forms').update({ status, published_at: status === 'published' ? new Date().toISOString() : null }).eq('id', form.id);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        setNotice(status === 'published' ? 'フォームを公開しました。公開URLをコピーしてLPやLINEに掲載できます。' : status === 'paused' ? 'フォーム受付を停止しました。' : 'フォーム状態を更新しました。');
        await load();
    };
    const publishSelectedForm = () => {
        const form = forms.find(item => item.id === selectedId);
        if (!form)
            return;
        const currentDefinition = {
            category: category.trim(),
            description: description.trim(),
            booking_url: bookingUrl.trim(),
            material_url: materialUrl.trim(),
            questions,
        };
        const savedDefinition = readDefinition(form.definition);
        const hasUnsavedChanges = name.trim() !== form.name || formType !== (form.form_type || 'diagnosis') ||
            privacyNotice.trim() !== (form.privacy_notice || '') ||
            JSON.stringify(currentDefinition) !== JSON.stringify(savedDefinition);
        if (hasUnsavedChanges) {
            setError('公開前にフォームの変更を保存してください。');
            return;
        }
        void updateStatus(form, 'published');
    };
    const deleteSelectedForm = async () => {
        const form = forms.find(item => item.id === selectedId);
        if (!form)
            return;
        const supabase = getSupabase();
        if (!supabase)
            return;
        setError('');
        setNotice('');
        // 関連する回答レコードがある場合は先に削除
        const { error: subError } = await supabase.from('diagnosis_submissions').delete().eq('form_id', form.id);
        if (subError) {
            setError('関連する回答データを削除できませんでした: ' + subError.message);
            return;
        }
        const { data: deleted, error: delError } = await supabase.from('diagnosis_forms').delete().eq('id', form.id).select('id').maybeSingle();
        if (delError) {
            setError('フォームを削除できませんでした: ' + delError.message);
            return;
        }
        if (!deleted) {
            setError('削除対象が見つからないか、削除権限がありません。');
            return;
        }
        setNotice(`フォーム「${form.name}」と関連する回答データを削除しました。`);
        resetForm();
        await load();
    };
    const updateSubmission = async (submission, status) => {
        const supabase = getSupabase();
        if (!supabase)
            return;
        setError('');
        const { error: updateError } = await supabase.from('diagnosis_submissions').update({
            status, reviewed_at: new Date().toISOString(),
        }).eq('id', submission.id);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        await load();
    };
    const publicUrl = (form) => window.location.origin + '/f/' + encodeURIComponent(form.public_slug);
    const copyUrl = async (form) => {
        try {
            await navigator.clipboard.writeText(publicUrl(form));
            setCopiedId(form.id);
            window.setTimeout(() => setCopiedId(''), 1800);
        }
        catch {
            setError('URLをコピーできませんでした。URLを選択してコピーしてください。');
        }
    };
    const updateQuestion = (index, patch) => setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...patch } : question));
    const moveQuestion = (index, direction) => {
        setQuestions((current) => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= current.length)
                return current;
            const updated = [...current];
            [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
            return updated;
        });
    };
    const addQuestion = () => {
        if (questions.length >= 40) {
            setError('設問は40個まで追加できます。');
            return;
        }
        setQuestions((current) => [...current, newQuestion()]);
    };
    const removeQuestion = (index) => setQuestions((current) => current.filter((_, i) => i !== index));
    const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all';
    const labelClass = 'block text-xs font-semibold text-slate-700';
    return (_jsxs("div", { className: "space-y-4", children: [showHeader && _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-slate-900", children: "\u30D5\u30A9\u30FC\u30E0\u30FB\u8A3A\u65AD\u306E\u53D7\u4ED8\u7BA1\u7406" }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "\u30D5\u30A9\u30FC\u30E0\u540D\u30FB\u8A2D\u554F\u30FB\u8AAC\u660E\u6587\u3092\u81EA\u7531\u306B\u4F5C\u6210\u30FB\u7BA1\u7406\u3067\u304D\u307E\u3059\u3002" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setSection('forms'), className: 'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (section === 'forms' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'), children: "\u30D5\u30A9\u30FC\u30E0\u8A2D\u5B9A" }), _jsxs("button", { onClick: () => setSection('answers'), className: 'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (section === 'answers' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'), children: ["\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54 (", visibleAnswers.length, ")"] }), _jsx("button", { onClick: () => void load(), title: "\u66F4\u65B0", className: "rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50", children: _jsx(RefreshCw, { className: "h-4 w-4" }) })] })] }), error && _jsx("div", { role: "alert", className: "rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700", children: error }), notice && _jsx("div", { role: "status", className: "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700", children: notice }), section === 'forms' && (_jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]", children: [_jsxs("section", { className: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold text-slate-900", children: "\u30D5\u30A9\u30FC\u30E0\u4E00\u89A7" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-xs text-slate-500", children: [forms.length, "\u4EF6"] }), _jsxs("button", { type: "button", onClick: resetForm, className: "inline-flex items-center gap-1 rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm", children: [_jsx(Plus, { className: "h-3 w-3" }), "\u65B0\u898F\u4F5C\u6210"] })] })] }), loading ? (_jsx("p", { className: "text-sm text-slate-500", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })) : forms.length === 0 ? (_jsx("div", { className: "rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500", children: "\u30D5\u30A9\u30FC\u30E0\u306F\u307E\u3060\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u53F3\u5074\u306E\u5165\u529B\u6B04\u304B\u3089\u65B0\u898F\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })) : (_jsx("ul", { className: "space-y-2", children: forms.map(form => (_jsxs("li", { children: [_jsxs("button", { onClick: () => selectForm(form), className: 'w-full rounded-lg border p-3 text-left transition-colors ' + (selectedId === form.id ? 'border-purple-400 bg-purple-50/70 shadow-sm' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'), children: [_jsxs("div", { className: "flex justify-between gap-2", children: [_jsx("span", { className: "font-medium text-slate-900", children: form.name }), _jsxs("div", { className: "flex items-center gap-1.5", children: [((form.form_type === 'diagnosis' || form.name.includes('診断')) && !readDefinition(form.definition).questions.some((q) => q.id === 'q_ops_bottleneck')) && (_jsx("span", { className: "rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700", children: "\u6700\u65B0\u5316\u63A8\u5968" })), _jsxs("span", { className: "text-xs text-slate-500", children: [FORM_TYPES.find(x => x.value === form.form_type)?.label || '診断申込', " \u00B7 ", form.status] })] })] }), _jsxs("div", { className: "mt-1 break-all text-xs text-slate-400", children: ["/", form.public_slug] })] }), form.status === 'published' && (_jsxs("div", { className: "mt-2 flex items-center gap-2 pl-2", children: [_jsxs("a", { href: publicUrl(form), target: "_blank", rel: "noreferrer", className: "inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700", children: [_jsx(ExternalLink, { className: "h-3 w-3" }), "\u516C\u958B\u30D5\u30A9\u30FC\u30E0\u3092\u958B\u304F"] }), _jsxs("button", { type: "button", onClick: () => void copyUrl(form), className: "inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50", children: [copiedId === form.id ? _jsx(ClipboardCheck, { className: "h-3 w-3 text-emerald-600" }) : _jsx(Clipboard, { className: "h-3 w-3" }), copiedId === form.id ? 'コピー済み' : 'URLをコピー'] }), _jsx("button", { type: "button", onClick: () => onOpenSendCenter?.(form.id, publicUrl(form), form.form_type === 'diagnosis' ? 'diagnosis' : 'form'), className: "rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700", children: "\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC\u3067\u6848\u5185" })] }))] }, form.id))) })), selectedId && (_jsxs("div", { className: "mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3", children: [forms.find(x => x.id === selectedId)?.status !== 'published' ? (_jsx("button", { type: "button", onClick: publishSelectedForm, className: "rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm", children: "\u516C\u958B\u3059\u308B" })) : (_jsx("button", { type: "button", onClick: () => { const f = forms.find(x => x.id === selectedId); if (f)
                                            void updateStatus(f, 'paused'); }, className: "rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100", children: "\u53D7\u4ED8\u505C\u6B62" })), _jsx("button", { type: "button", onClick: () => { const f = forms.find(x => x.id === selectedId); if (f)
                                            void updateStatus(f, 'archived'); }, className: "rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50", children: "\u30A2\u30FC\u30AB\u30A4\u30D6" }), _jsx("button", { type: "button", onClick: () => { const f = forms.find(x => x.id === selectedId); if (f)
                                            void updateStatus(f, 'draft'); }, className: "rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50", children: "\u4E0B\u66F8\u304D\u306B\u623B\u3059" }), _jsx(InlineDeleteButton, { onConfirm: () => void deleteSelectedForm(), warning: `フォーム「${forms.find(item => item.id === selectedId)?.name || ''}」と関連する回答データを完全に削除しますか？この操作は取り消せません。`, confirmLabel: "\u30D5\u30A9\u30FC\u30E0\u524A\u9664\u3092\u78BA\u5B9A", className: "rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100", children: "\u30D5\u30A9\u30FC\u30E0\u3092\u524A\u9664" })] }))] }), _jsxs("form", { onSubmit: saveForm, className: "space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("h3", { className: "font-semibold text-slate-900", children: [_jsx(Plus, { className: "mr-1 inline h-4 w-4 text-purple-600" }), selectedId ? 'フォームを編集' : '新しいフォームを作成'] }), selectedId && (_jsx("button", { type: "button", onClick: resetForm, className: "text-xs font-medium text-purple-600 hover:underline", children: "\u65B0\u898F\u30D5\u30A9\u30FC\u30E0\u3092\u4F5C\u6210" }))] }), formType === 'diagnosis' && (_jsx("div", { className: "rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 p-4 shadow-sm", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 font-bold text-purple-900 text-sm", children: [_jsx(Sparkles, { className: "h-4 w-4 text-purple-600" }), "\u55B6\u696D\u8CC7\u6599\u6E96\u62E0\uFF1A\u7D4C\u55B6\u306E\u4ED5\u7D44\u307F\u5316 \u00D7 \u5229\u76CA\u6539\u5584 \u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u8A3A\u65AD\uFF08\u516C\u5F0F\u30D7\u30EA\u30BB\u30C3\u30C8\uFF09"] }), _jsx("p", { className: "mt-1 text-xs text-slate-600", children: "\u65E5\u3005\u306E\u624B\u4F5C\u696D\u30FB\u58F2\u4E0A\u5229\u76CA\u30FB\u6539\u5584\u505C\u6EDE\u539F\u56E0\u30FB\u76EE\u6307\u3057\u305F\u3044\u672A\u6765\u306E4\u5927\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u3092\u7279\u5B9A\u3059\u308B\u6700\u65B0\u8A2D\u554F\u69CB\u6210\u3067\u3059\u3002" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => applyOfficialBottleneckPreset(false), className: "inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition shadow-sm", children: [_jsx(Sparkles, { className: "h-3.5 w-3.5" }), "\u7DE8\u96C6\u6B04\u306B\u53CD\u6620"] }), _jsxs("button", { type: "button", onClick: () => void applyOfficialBottleneckPreset(true), className: "inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition", children: [_jsx(Save, { className: "h-3.5 w-3.5" }), "\u53CD\u6620\u3057\u3066\u5373\u6642\u4FDD\u5B58"] })] })] }) })), formType === 'diagnosis' && !questions.some((q) => q.id === 'q_ops_bottleneck') && (_jsxs("div", { className: "rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(AlertCircle, { className: "h-4 w-4 shrink-0 text-amber-600" }), _jsx("span", { children: "\u73FE\u5728\u306E\u8A2D\u554F\u306F\u65E7\u69CB\u6210\u3067\u3059\u3002\u300C\u53CD\u6620\u3057\u3066\u5373\u6642\u4FDD\u5B58\u300D\u3092\u62BC\u3059\u3068\u3001\u55B6\u696D\u8CC7\u6599\u306B\u5408\u308F\u305B\u305F\u6700\u65B0\u30DC\u30C8\u30EB\u30CD\u30C3\u30AF\u8A2D\u554F\uFF084\u554F\uFF0B\u81EA\u7531\u8A18\u8FF0\uFF09\u306B\u4E00\u62EC\u66F4\u65B0\u3055\u308C\u307E\u3059\u3002" })] }), _jsx("button", { type: "button", onClick: () => void applyOfficialBottleneckPreset(true), className: "rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 transition shadow-sm", children: "\u4ECA\u3059\u3050\u66F4\u65B0\u3057\u3066\u4FDD\u5B58" })] })), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("label", { className: labelClass, children: ["\u53D7\u4ED8\u306E\u7A2E\u985E", _jsx("select", { value: formType, onChange: event => setFormType(event.target.value), className: inputClass, children: FORM_TYPES.map(type => _jsx("option", { value: type.value, children: type.label }, type.value)) })] }), _jsxs("label", { className: labelClass, children: ["\u30B5\u30FC\u30D3\u30B9\u533A\u5206\u30FB\u4E0A\u90E8\u30E9\u30D9\u30EB\uFF08\u4EFB\u610F\uFF09", _jsx("input", { value: category, onChange: event => setCategory(event.target.value), className: inputClass, placeholder: "\u4F8B\uFF1A\u7D4C\u55B6\u306E\u4ED5\u7D44\u307F\u5316 \u00D7 \u5229\u76CA\u6539\u5584" })] })] }), _jsxs("label", { className: labelClass, children: ["\u500B\u5225\u9762\u8AC7\u306E\u4E88\u7D04\u30AB\u30EC\u30F3\u30C0\u30FCURL\uFF08\u4EFB\u610F\u30FBSpir / TimeRex / Calendly \u306A\u3069\uFF09", _jsx("input", { value: bookingUrl, onChange: event => setBookingUrl(event.target.value), className: inputClass, placeholder: "\u4F8B\uFF1Ahttps://app.spirbot.com/... \u307E\u305F\u306F https://timerex.net/..." }), _jsxs("span", { className: "text-xs text-slate-500", children: ["\u8A2D\u5B9A\u3059\u308B\u3068\u3001\u8A3A\u65AD\u56DE\u7B54\u5B8C\u4E86\u5F8C\u306E\u901F\u5831\u30B5\u30F3\u30AF\u30B9\u30DA\u30FC\u30B8\u306B\u300C\u9762\u8AC7\u65E5\u6642\u3092\u9078\u3076\uFF08\u4E88\u7D04\u3059\u308B\uFF09\u300D\u30DC\u30BF\u30F3\u3068\u3057\u3066\u8868\u793A\u3055\u308C\u307E\u3059\u3002\u81EA\u52D5\u30D5\u30A9\u30ED\u30FC\u306E ", '{booking_url}', " \u306B\u3082\u5DEE\u3057\u8FBC\u307E\u308C\u307E\u3059\u3002"] })] }), _jsxs("label", { className: labelClass, children: ["\u914D\u5E03\u8CC7\u6599\u30FB\u30B5\u30FC\u30D3\u30B9\u6982\u8981\u8CC7\u6599\u306EURL\uFF08\u4EFB\u610F\u30FBPDF / Google Drive / \u95B2\u89A7URL \u306A\u3069\uFF09", _jsx("input", { value: materialUrl, onChange: event => setMaterialUrl(event.target.value), className: inputClass, placeholder: "\u4F8B\uFF1Ahttps://example.com/materials/guide.pdf" }), _jsxs("span", { className: "text-xs text-slate-500", children: ["\u81EA\u52D5\u30D5\u30A9\u30ED\u30FC\u306E ", '{material_url}', " \u30D7\u30EC\u30FC\u30B9\u30DB\u30EB\u30C0\u30FC\u306B\u5DEE\u3057\u8FBC\u307E\u308C\u307E\u3059\u3002\u672A\u8A2D\u5B9A\u306E\u5834\u5408\u3001", '{material_url}', " \u3092\u542B\u3080\u81EA\u52D5\u30D5\u30A9\u30ED\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8\u306F\u5B89\u5168\u306E\u305F\u3081\u9001\u4FE1\u304C\u505C\u6B62\uFF08failed\uFF09\u3055\u308C\u307E\u3059\u3002"] })] }), _jsxs("label", { className: labelClass, children: ["\u30D5\u30A9\u30FC\u30E0\u540D ", _jsx("span", { className: "text-rose-400", children: "*" }), _jsx("input", { required: true, value: name, onChange: event => setName(event.target.value), className: inputClass, placeholder: "\u4F8B\uFF1A\u696D\u52D9\u30D2\u30A2\u30EA\u30F3\u30B0\u30D5\u30A9\u30FC\u30E0\u3001\u521D\u56DE\u76F8\u8AC7\u53D7\u4ED8" })] }), _jsxs("label", { className: labelClass, children: ["\u30D5\u30A9\u30FC\u30E0\u8AAC\u660E\uFF08\u4EFB\u610F\uFF09", _jsx("textarea", { value: description, onChange: event => setDescription(event.target.value), rows: 3, className: inputClass, placeholder: "\u56DE\u7B54\u8005\u306B\u8868\u793A\u3059\u308B\u8AAC\u660E\u6587\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044" })] }), _jsxs("label", { className: labelClass, children: ["\u500B\u4EBA\u60C5\u5831\u306E\u53D6\u308A\u6271\u3044\u6848\u5185 ", _jsx("span", { className: "text-rose-400", children: "*" }), _jsx("textarea", { required: true, value: privacyNotice, onChange: event => setPrivacyNotice(event.target.value), rows: 3, className: inputClass, placeholder: "\u500B\u4EBA\u60C5\u5831\u306E\u53D6\u308A\u6271\u3044\u306B\u95A2\u3059\u308B\u65B9\u91DD\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044" })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("h4", { className: "text-sm font-semibold text-slate-900", children: ["\u8A2D\u554F (", questions.length, "/40)"] }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: "\u8A2D\u554F\u6587\u3001\u5F62\u5F0F\u3001\u9078\u629E\u80A2\u3001\u5FC5\u9808\u30D5\u30E9\u30B0\u3092\u81EA\u7531\u306B\u8A2D\u5B9A\u3067\u304D\u307E\u3059\u3002" })] }), _jsxs("button", { type: "button", onClick: addQuestion, className: "inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), "\u8A2D\u554F\u3092\u8FFD\u52A0"] })] }), questions.map((question, index) => (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-600", children: ["\u8A2D\u554F ", index + 1] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { type: "button", disabled: index === 0, onClick: () => moveQuestion(index, -1), "aria-label": "\u4E0A\u3078\u79FB\u52D5", className: "rounded p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30", children: _jsx(ArrowUp, { className: "h-4 w-4" }) }), _jsx("button", { type: "button", disabled: index === questions.length - 1, onClick: () => moveQuestion(index, 1), "aria-label": "\u4E0B\u3078\u79FB\u52D5", className: "rounded p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30", children: _jsx(ArrowDown, { className: "h-4 w-4" }) }), _jsx("button", { type: "button", disabled: questions.length <= 1, onClick: () => removeQuestion(index), "aria-label": "\u8A2D\u554F\u3092\u524A\u9664", className: "rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-30", children: _jsx(Trash2, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsxs("label", { className: labelClass, children: ["\u8A2D\u554F\u6587 ", _jsx("span", { className: "text-rose-500", children: "*" }), _jsx("input", { value: question.label, onChange: event => updateQuestion(index, { label: event.target.value }), className: inputClass, placeholder: "\u8A2D\u554F\u6587\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044" })] }), _jsxs("label", { className: labelClass, children: ["\u56DE\u7B54\u5F62\u5F0F", _jsx("select", { value: question.type, onChange: event => updateQuestion(index, { type: event.target.value }), className: inputClass, children: QUESTION_TYPES.map(type => _jsx("option", { value: type.value, children: type.label }, type.value)) })] })] }), (question.type === 'select' || question.type === 'radio') && (_jsxs("label", { className: 'mt-3 ' + labelClass, children: ["\u9078\u629E\u80A2\uFF081\u884C\u306B1\u3064\uFF09 ", _jsx("span", { className: "text-rose-500", children: "*" }), _jsx("textarea", { value: question.options.join('\n'), onChange: event => updateQuestion(index, { options: event.target.value.split('\n').map(option => option.trim()).filter(Boolean) }), rows: 3, className: inputClass, placeholder: '選択肢1\n選択肢2\n選択肢3' })] })), question.type === 'checkbox' && (_jsxs("label", { className: 'mt-3 ' + labelClass, children: ["\u30C1\u30A7\u30C3\u30AF\u9805\u76EE\u306E\u8868\u793A\u540D", _jsx("input", { value: question.options[0] || '', onChange: event => updateQuestion(index, { options: event.target.value ? [event.target.value] : [] }), className: inputClass, placeholder: "\u4F8B\uFF1A\u8A72\u5F53\u3059\u308B / \u540C\u610F\u3059\u308B" })] })), _jsxs("label", { className: "mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: question.required, onChange: event => updateQuestion(index, { required: event.target.checked }), className: "h-4 w-4 rounded accent-purple-600" }), "\u56DE\u7B54\u5FC5\u9808\u306B\u3059\u308B"] })] }, question.id)))] }), _jsxs("section", { className: "rounded-xl border border-slate-200 bg-slate-50 p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h4", { className: "text-sm font-semibold text-slate-900", children: "\u516C\u958B\u753B\u9762\u30D7\u30EC\u30D3\u30E5\u30FC" }), category && _jsx("span", { className: "rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700", children: category })] }), _jsx("div", { className: "mt-2 text-base font-bold text-slate-900", children: name || '（フォーム名未設定）' }), description ? (_jsx("p", { className: "mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600", children: description })) : (_jsx("p", { className: "mt-2 text-xs italic text-slate-400", children: "\u8AAC\u660E\u6587\u306F\u672A\u8A2D\u5B9A\u3067\u3059\u3002" })), _jsx("div", { className: "mt-3 space-y-2", children: questions.map((question, index) => (_jsxs("div", { className: "rounded-lg border border-slate-200 bg-white p-3 shadow-2xs", children: [_jsxs("div", { className: "text-xs font-medium text-slate-800", children: [index + 1, ". ", question.label || '設問文未入力', question.required && _jsx("span", { className: "ml-1 text-rose-500 font-bold", children: "\u5FC5\u9808" })] }), _jsxs("div", { className: "mt-1 text-xs text-slate-500", children: [QUESTION_TYPES.find(type => type.value === question.type)?.label, question.options.length ? ' · ' + question.options.join(' / ') : ''] })] }, question.id))) })] }), _jsxs("button", { disabled: loading, className: "flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50", children: [_jsx(Save, { className: "h-4 w-4" }), selectedId ? '変更を保存' : '下書き保存'] }), _jsx("p", { className: "text-xs text-slate-500", children: "\u4FDD\u5B58\u5F8C\u3001\u30D5\u30A9\u30FC\u30E0\u4E00\u89A7\u304B\u3089\u300C\u516C\u958B\u3059\u308B\u300D\u3092\u9078\u629E\u3059\u308B\u3068\u516C\u958BURL\u304C\u767A\u884C\u3055\u308C\u307E\u3059\u3002" })] })] })), section === 'answers' && (_jsxs("section", { className: "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", children: [loading ? (_jsx("p", { className: "p-4 text-sm text-slate-500", children: "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026" })) : visibleAnswers.length === 0 ? (_jsx("p", { className: "p-6 text-center text-sm text-slate-500", children: "\u30D5\u30A9\u30FC\u30E0\u56DE\u7B54\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { className: "bg-slate-50 text-xs font-semibold text-slate-600", children: _jsxs("tr", { className: "border-b border-slate-200", children: [_jsx("th", { className: "p-3", children: "\u56DE\u7B54\u8005" }), _jsx("th", { className: "p-3", children: "\u30D5\u30A9\u30FC\u30E0" }), _jsx("th", { className: "p-3", children: "\u53D7\u4ED8\u65E5\u6642" }), _jsx("th", { className: "p-3", children: "\u72B6\u614B" }), _jsx("th", { className: "p-3", children: "\u78BA\u8A8D" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: visibleAnswers.map(answer => (_jsxs(Fragment, { children: [_jsxs("tr", { className: "border-b border-slate-100 hover:bg-slate-50/60 transition-colors", children: [_jsxs("td", { className: "p-3 text-slate-900 font-medium", children: [answer.respondent_name || answer.respondent_email || '回答者未特定', _jsx("div", { className: "text-xs text-slate-500 font-normal", children: answer.respondent_email || '' }), answer.respondent_company_name && _jsxs("div", { className: "mt-1 text-xs text-purple-700 font-medium", children: ["\u4F1A\u793E\u540D\u30FB\u5C4B\u53F7: ", answer.respondent_company_name] })] }), _jsxs("td", { className: "p-3 text-slate-700", children: [forms.find(form => form.id === answer.form_id)?.name || answer.form_id.slice(0, 8), _jsx("div", { className: "mt-1 text-xs", children: answer.diagnosis_id ? (_jsx("button", { type: "button", onClick: () => onOpenDiagnosis?.(answer.diagnosis_id), className: "text-purple-600 underline font-medium hover:text-purple-700", children: "\u8A3A\u65AD\u3092\u958B\u304F" })) : forms.find(form => form.id === answer.form_id)?.form_type === 'diagnosis' ? (_jsx("span", { className: "text-amber-700 font-medium", children: answer.company_id ? '診断未作成' : '会社未紐付け' })) : null })] }), _jsx("td", { className: "p-3 text-slate-500 text-xs", children: new Date(answer.submitted_at).toLocaleString('ja-JP') }), _jsx("td", { className: "p-3 text-slate-700", children: answer.status }), _jsx("td", { className: "p-3", children: _jsxs("select", { value: answer.status, onChange: event => void updateSubmission(answer, event.target.value), className: "rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-purple-500", children: [_jsx("option", { value: "received", children: "\u53D7\u4ED8" }), _jsx("option", { value: "reviewing", children: "\u5BFE\u5FDC\u4E2D" }), _jsx("option", { value: "completed", children: "\u5B8C\u4E86" }), _jsx("option", { value: "rejected", children: "\u5BFE\u8C61\u5916" })] }) })] }), _jsx("tr", { className: "border-b border-slate-100 bg-slate-50/40", children: _jsx("td", { colSpan: 5, className: "px-3 pb-3", children: _jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer text-xs font-medium text-purple-600 hover:text-purple-700", children: "\u56DE\u7B54\u5185\u5BB9\u3092\u78BA\u8A8D" }), (() => {
                                                                const form = forms.find(item => item.id === answer.form_id);
                                                                const questions = readDefinition(form?.definition).questions;
                                                                const questionById = new Map(questions.map(question => [question.id, question]));
                                                                const entries = Object.entries(answer.answers || {});
                                                                if (!entries.length)
                                                                    return _jsx("p", { className: "mt-2 text-xs text-slate-500", children: "\u56DE\u7B54\u306F\u3042\u308A\u307E\u305B\u3093\u3002" });
                                                                return (_jsx("dl", { className: "mt-2 space-y-2", children: entries.map(([id, value]) => {
                                                                        const question = questionById.get(id);
                                                                        const displayValue = typeof value === 'boolean'
                                                                            ? (value ? (question?.options[0] || 'はい') : 'いいえ')
                                                                            : Array.isArray(value) ? value.join('、') : String(value ?? '—');
                                                                        return (_jsxs("div", { className: "grid gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)] shadow-2xs", children: [_jsx("dt", { className: "text-xs font-semibold text-slate-600", children: question?.label || '設問 (' + id + ')' }), _jsx("dd", { className: "whitespace-pre-wrap break-words text-sm text-slate-800", children: displayValue })] }, id));
                                                                    }) }));
                                                            })(), answer.reviewer_memo && _jsxs("p", { className: "mt-2 text-xs text-slate-600", children: ["\u78BA\u8A8D\u30E1\u30E2: ", answer.reviewer_memo] })] }) }) })] }, answer.id))) })] }) })), _jsx("p", { className: "border-t border-slate-100 p-3 text-xs text-slate-500", children: "\u8A3A\u65AD\u30D5\u30A9\u30FC\u30E0\u306E\u56DE\u7B54\u306F\u3001\u5BFE\u8C61\u4F1A\u793E\u304C\u7D10\u4ED8\u3044\u3066\u3044\u308B\u5834\u5408\u306B\u300C\u672A\u78BA\u8A8D\u300D\u306E\u8A3A\u65AD\u3068\u3057\u3066\u81EA\u52D5\u4F5C\u6210\u3055\u308C\u307E\u3059\u3002\u56DE\u7B54\u884C\u306E\u300C\u8A3A\u65AD\u3092\u958B\u304F\u300D\u304B\u3089\u5185\u5BB9\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002\u4F1A\u793E\u3092\u7279\u5B9A\u3067\u304D\u306A\u3044\u56DE\u7B54\u306F\u53D7\u4ED8\u8A18\u9332\u306B\u4FDD\u6301\u3057\u307E\u3059\u3002" })] }))] }));
};
