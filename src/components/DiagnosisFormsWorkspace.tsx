import React, { Fragment, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import { InlineDeleteButton } from './InlineDeleteButton';
import { ArrowDown, ArrowUp, Clipboard, ClipboardCheck, ExternalLink, Plus, RefreshCw, Save, Trash2, Sparkles, AlertCircle, FileText, Upload, CheckCircle2, Eye, Copy, Link as LinkIcon } from 'lucide-react';

export interface PublicMaterial {
  id: string;
  key: string;
  label: string;
  description: string;
  category: string;
  file_path: string | null;
  external_url: string | null;
  public_url: string;
  size_bytes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

type FormType = 'diagnosis' | 'consultation' | 'meeting';
type QuestionType = 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date';
type FormQuestion = { id: string; label: string; type: QuestionType; required: boolean; options: string[] };
type FormDefinition = { category?: string; description: string; booking_url?: string; material_url?: string; questions: FormQuestion[] };
type DiagnosisForm = { id: string; name: string; public_slug: string; form_type: FormType; status: 'draft'|'published'|'paused'|'archived'; questionnaire_version: string; definition: Record<string, unknown>; privacy_notice: string|null; created_at: string };
type Submission = { id: string; form_id: string; contact_id: string|null; company_id: string|null; respondent_company_name: string|null; lead_id: string|null; diagnosis_id?: string|null; status: 'received'|'reviewing'|'completed'|'rejected'; respondent_name: string|null; respondent_email: string|null; answers: Record<string, unknown>; score: number|null; submitted_at: string; reviewer_memo: string|null };

export const MST_OFFICIAL_BOTTLENECK_QUESTIONS: FormQuestion[] = [
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
const FORM_TYPES: { value: FormType; label: string }[] = [
  { value: 'diagnosis', label: '診断申込' },
  { value: 'consultation', label: '相談申込' },
  { value: 'meeting', label: '面談申込' },
];
const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: '一行入力' },
  { value: 'textarea', label: '複数行入力' },
  { value: 'select', label: 'プルダウン選択' },
  { value: 'radio', label: '単一選択' },
  { value: 'checkbox', label: 'チェックボックス' },
  { value: 'date', label: '日付' },
];

function newQuestion(): FormQuestion {
  return { id: 'question_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), label: '', type: 'text', required: false, options: [] };
}

function readDefinition(value: Record<string, unknown> | null | undefined): FormDefinition {
  const definition = value && typeof value === 'object' ? value : {};
  const rawQuestions = Array.isArray(definition.questions) ? definition.questions : [];
  const questions = rawQuestions.slice(0, 40).filter((item: any) =>
    item && typeof item === 'object' && typeof item.id === 'string' && typeof item.label === 'string'
  ).map((item: any): FormQuestion => ({
    id: item.id,
    label: item.label,
    type: QUESTION_TYPES.some((type) => type.value === item.type) ? item.type : 'text',
    required: Boolean(item.required),
    options: Array.isArray(item.options) ? item.options.filter((option: unknown): option is string => typeof option === 'string') : [],
  }));
  return {
    category: typeof definition.category === 'string' ? definition.category : typeof definition.service_category === 'string' ? definition.service_category : '',
    description: typeof definition.description === 'string' ? definition.description : '',
    booking_url: typeof definition.booking_url === 'string' ? definition.booking_url : '',
    material_url: typeof definition.material_url === 'string' ? definition.material_url : '',
    questions: questions.length ? questions : [newQuestion()],
  };
}

interface DiagnosisFormsWorkspaceProps {
  initialLeadId?: string;
  initialCompanyId?: string;
  initialSection?: 'forms'|'answers'|'materials';
  activeSection?: 'forms'|'answers'|'materials';
  onSectionChange?: (section: 'forms'|'answers'|'materials') => void;
  showHeader?: boolean;
  onOpenDiagnosis?: (diagnosisId: string) => void;
  onOpenSendCenter?: (formId: string, url: string, kind: 'form'|'diagnosis') => void;
}

export const DiagnosisFormsWorkspace: React.FC<DiagnosisFormsWorkspaceProps> = ({ initialLeadId, initialCompanyId, initialSection, activeSection, onSectionChange, showHeader = true, onOpenDiagnosis, onOpenSendCenter }) => {
  const [section, setSection] = useState<'forms'|'answers'|'materials'>(activeSection || initialSection || (initialLeadId || initialCompanyId ? 'answers' : 'forms'));

  useEffect(() => {
    if (activeSection) {
      setSection(activeSection);
    } else if (initialSection) {
      setSection(initialSection);
    }
  }, [activeSection, initialSection]);

  const switchSection = (next: 'forms'|'answers'|'materials') => {
    setSection(next);
    onSectionChange?.(next);
  };
  const [forms, setForms] = useState<DiagnosisForm[]>([]);
  const [answers, setAnswers] = useState<Submission[]>([]);
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);
  const [editingMaterial, setEditingMaterial] = useState<Partial<PublicMaterial> | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [copiedMaterialUrl, setCopiedMaterialUrl] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [formType, setFormType] = useState<FormType>('consultation');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([newQuestion()]);
  const [privacyNotice, setPrivacyNotice] = useState(DEFAULT_PRIVACY_NOTICE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const visibleAnswers = answers.filter((answer) =>
    (!initialLeadId || answer.lead_id === initialLeadId) &&
    (!initialCompanyId || answer.company_id === initialCompanyId)
  );

  const selectForm = (form: DiagnosisForm) => {
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
    setName('経営ボトルネック診断フォーム');
    setCategory('経営の仕組み化 × 利益改善');
    setBookingUrl('');
    setFormType('diagnosis');
    setDescription('貴社の現状の経営課題（業務の手作業・売上利益・改善停滞原因・経営者の時間）のボトルネックを特定し、仕組み化と利益改善に向けた最適なロードマップを作成するための診断フォームです。');
    setQuestions(MST_OFFICIAL_BOTTLENECK_QUESTIONS);
    setPrivacyNotice(DEFAULT_PRIVACY_NOTICE);

    if (autoSave) {
      const supabase = getSupabase();
      if (!supabase) { setError('Supabaseに接続してください。'); return; }
      setLoading(true); setError(''); setNotice('');
      try {
        const payload = {
          name: '経営ボトルネック診断フォーム',
          form_type: 'diagnosis' as FormType,
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
        if (result.error) throw result.error;
        setNotice('営業資料準拠の最新ボトルネック診断設問を保存しました。');
        await load();
      } catch (e: any) {
        setError(e?.message || '保存できませんでした。');
      } finally {
        setLoading(false);
      }
    } else {
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
    if (!supabase) { setError('Supabaseに接続してください。'); return; }
    setLoading(true); setError('');
    try {
      const [formResult, answerResult, materialResult] = await Promise.all([
        supabase.from('diagnosis_forms').select('*').neq('status', 'archived').neq('public_slug', 'care-package-inquiry').not('name', 'ilike', '%経営課題%').order('created_at', { ascending: false }),
        supabase.from('diagnosis_submissions').select('*').order('submitted_at', { ascending: false }).limit(200),
        supabase.from('public_materials').select('*').order('sort_order', { ascending: true }),
      ]);
      if (formResult.error) throw formResult.error;
      if (answerResult.error) throw answerResult.error;
      const loadedForms = (formResult.data || []) as DiagnosisForm[];
      setForms(loadedForms);
      if (selectedId) {
        const stillSelected = loadedForms.find((f) => f.id === selectedId);
        if (stillSelected) selectForm(stillSelected);
        else resetForm();
      } else if (loadedForms.length > 0) {
        selectForm(loadedForms[0]);
      }
      setAnswers((answerResult.data || []) as Submission[]);
      if (!materialResult.error && materialResult.data) {
        setMaterials(materialResult.data as PublicMaterial[]);
      }
    } catch (e: any) {
      setError(e?.message || 'フォーム・回答・資料データを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaterialActive = async (material: PublicMaterial) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { error: updateErr } = await supabase
        .from('public_materials')
        .update({ is_active: !material.is_active })
        .eq('id', material.id);
      if (updateErr) throw updateErr;
      setMaterials((prev) => prev.map((m) => m.id === material.id ? { ...m, is_active: !m.is_active } : m));
      setNotice(`資料「${material.label}」を${!material.is_active ? '公開（有効）' : '非公開（無効）'}に切り替えました。`);
    } catch (e: any) {
      setError('ステータス変更に失敗しました: ' + (e?.message || ''));
    }
  };

  const handleDeleteMaterial = async (material: PublicMaterial) => {
    const confirmed = window.confirm(
      `資料「${material.label}」を完全に削除しますか？\n\n【注意】\n・削除すると、過去にメールやLINEで送信したダウンロードリンクが開けなくなります。\n・一時的に配布を止めたい場合は「有効 / 無効」の切り替えをご利用ください。\n\n本当に削除してよろしいですか？`
    );
    if (!confirmed) return;

    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Storageファイルが存在すれば削除
      if (material.file_path) {
        const { error: storageErr } = await supabase.storage.from('materials').remove([material.file_path]);
        if (storageErr) console.warn('Storage file deletion notice:', storageErr.message);
      }
      // 2. DBレコードを削除
      const { error: deleteErr, count } = await supabase
        .from('public_materials')
        .delete({ count: 'exact' })
        .eq('id', material.id);
      if (deleteErr) throw deleteErr;
      if (count === 0) throw new Error('資料レコードが見つかりませんでした。');

      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      setNotice(`資料「${material.label}」を完全に削除しました。`);
    } catch (e: any) {
      setError('削除に失敗しました: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleMoveMaterialOrder = async (material: PublicMaterial, direction: -1 | 1) => {
    const currentIndex = materials.findIndex((m) => m.id === material.id);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= materials.length) return;

    const targetMaterial = materials[targetIndex];
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const currentOrder = material.sort_order ?? (currentIndex + 1) * 10;
      const targetOrder = targetMaterial.sort_order ?? (targetIndex + 1) * 10;

      let newCurrentOrder = targetOrder;
      let newTargetOrder = currentOrder;
      if (newCurrentOrder === newTargetOrder) {
        newCurrentOrder = targetOrder + (direction > 0 ? 5 : -5);
      }

      const [res1, res2] = await Promise.all([
        supabase.from('public_materials').update({ sort_order: newCurrentOrder }).eq('id', material.id),
        supabase.from('public_materials').update({ sort_order: newTargetOrder }).eq('id', targetMaterial.id),
      ]);
      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      setNotice(`資料「${material.label}」の表示順を更新しました。`);
      await load();
    } catch (e: any) {
      setError('並び替えに失敗しました: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPdfFile = async (file: File, targetMaterial?: Partial<PublicMaterial>) => {
    if (file.type !== 'application/pdf') {
      alert('PDFファイル（.pdf）のみアップロード可能です。');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('ファイルサイズが20MBを超えています。20MB以下のPDFを選択してください。');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      alert('Supabaseに接続されていません。');
      return;
    }

    setUploadingPdf(true);
    setError('');
    setNotice('');

    try {
      const rawKey = (targetMaterial?.key || editingMaterial?.key || file.name.replace(/\.pdf$/i, '')).trim();
      const safeKey = rawKey.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-') || `doc-${Date.now().toString(36)}`;
      
      // 差し替え時は既存の file_path を優先してURL不変を維持
      const filePath = targetMaterial?.file_path || editingMaterial?.file_path || `${safeKey}.pdf`;

      // Supabase Storage に直接アップロード（Vercelプロキシ制限を回避）
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file, {
          cacheControl: '120',
          upsert: true,
          contentType: 'application/pdf',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('materials').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      // 編集フォームのステートを更新
      setEditingMaterial((prev) => ({
        ...prev,
        key: safeKey,
        label: prev?.label || file.name.replace(/\.pdf$/i, ''),
        file_path: filePath,
        public_url: publicUrl,
        size_bytes: file.size,
      }));

      // 即時差し替えモード（一覧の差し替えボタンから実行された場合）
      if (targetMaterial?.id) {
        const updatePayload: Record<string, any> = {
          file_path: filePath,
          public_url: publicUrl,
          updated_at: new Date().toISOString(),
        };
        if (typeof file.size === 'number') {
          updatePayload.size_bytes = file.size;
        }

        let { error: dbErr } = await supabase
          .from('public_materials')
          .update(updatePayload)
          .eq('id', targetMaterial.id);

        // スキーマキャッシュに size_bytes が未反映の場合は除外して安全に再試行
        if (dbErr && (dbErr.message?.includes('size_bytes') || String(dbErr.code || '').includes('PGRST'))) {
          delete updatePayload.size_bytes;
          const retry = await supabase
            .from('public_materials')
            .update(updatePayload)
            .eq('id', targetMaterial.id);
          dbErr = retry.error;
        }

        if (dbErr) throw dbErr;
        setNotice(`資料「${targetMaterial.label}」のPDFファイルを上書き差し替えしました（公開URLは維持されます）。`);
        await load();
      } else {
        setNotice('PDFファイルをアップロードしました。内容を確認して「保存」を押してください。');
      }
    } catch (e: any) {
      console.error('PDF upload failed:', e);
      setError('PDFのアップロード・差し替えに失敗しました: ' + (e?.message || ''));
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    const cleanKey = (editingMaterial.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const cleanLabel = (editingMaterial.label || '').trim();
    const cleanPublicUrl = (editingMaterial.public_url || editingMaterial.external_url || '').trim();

    if (!cleanKey) { setError('資料キー（半角英数・ハイフン）を入力してください。'); return; }
    if (!cleanLabel) { setError('資料の表示名を入力してください。'); return; }
    if (!cleanPublicUrl) { setError('公開URL、またはPDFファイルが必要です。'); return; }

    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true); setError(''); setNotice('');

    try {
      const payload: Record<string, any> = {
        key: cleanKey,
        label: cleanLabel,
        description: (editingMaterial.description || '').trim(),
        category: (editingMaterial.category || '経営実務').trim(),
        file_path: editingMaterial.file_path || null,
        external_url: editingMaterial.external_url?.trim() || null,
        public_url: cleanPublicUrl,
        size_bytes: editingMaterial.size_bytes || 0,
        is_active: editingMaterial.is_active !== false,
        sort_order: Number(editingMaterial.sort_order) || 0,
      };

      if (editingMaterial.id) {
        let { error: updateErr } = await supabase
          .from('public_materials')
          .update(payload)
          .eq('id', editingMaterial.id);

        if (updateErr && (updateErr.message?.includes('size_bytes') || String(updateErr.code || '').includes('PGRST'))) {
          delete payload.size_bytes;
          const retry = await supabase
            .from('public_materials')
            .update(payload)
            .eq('id', editingMaterial.id);
          updateErr = retry.error;
        }

        if (updateErr) throw updateErr;
        setNotice(`資料「${cleanLabel}」を更新しました。`);
      } else {
        let { error: insertErr } = await supabase
          .from('public_materials')
          .insert(payload);

        if (insertErr && (insertErr.message?.includes('size_bytes') || String(insertErr.code || '').includes('PGRST'))) {
          delete payload.size_bytes;
          const retry = await supabase
            .from('public_materials')
            .insert(payload);
          insertErr = retry.error;
        }

        if (insertErr) throw insertErr;
        setNotice(`新規資料「${cleanLabel}」を登録しました。HPに自動反映されます。`);
      }

      setMaterialFormOpen(false);
      setEditingMaterial(null);
      await load();
    } catch (e: any) {
      setError('資料の保存に失敗しました: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const copyMaterialUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMaterialUrl(url);
      setTimeout(() => setCopiedMaterialUrl(''), 2000);
    } catch {
      alert('URLをコピーできませんでした。');
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (activeSection) setSection(activeSection); }, [activeSection]);

  const saveForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase || !name.trim()) return;
    if (formType === 'diagnosis' && !questions.length) { setError('診断フォームには設問を1つ以上追加してください。'); return; }
    if (questions.some((question) => !question.label.trim())) { setError('設問文を入力してください。'); return; }
    if (questions.some((question) => (question.type === 'select' || question.type === 'radio') && question.options.filter(Boolean).length < 2)) {
      setError('選択式の設問には選択肢を2つ以上入力してください。'); return;
    }
    if (new Set(questions.map((question) => question.id)).size !== questions.length) { setError('設問IDが重複しています。'); return; }
    setError(''); setNotice('');
    const definition: FormDefinition = {
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
    if (result.error) { setError(result.error.message); return; }
    setNotice(selectedId ? 'フォーム定義を保存しました。' : 'フォームを下書き保存しました。フォーム一覧から選択して公開できます。');
    await load();
  };

  const updateStatus = async (form: DiagnosisForm, status: DiagnosisForm['status']) => {
    const supabase = getSupabase(); if (!supabase) return;
    if (status === 'published' && !form.privacy_notice?.trim()) {
      setError('公開する前にフォームを編集し、個人情報の取り扱い案内を保存してください。');
      return;
    }
    setError(''); setNotice('');
    const { error: updateError } = await supabase.from('diagnosis_forms').update({ status, published_at: status === 'published' ? new Date().toISOString() : null }).eq('id', form.id);
    if (updateError) { setError(updateError.message); return; }
    setNotice(status === 'published' ? 'フォームを公開しました。公開URLをコピーしてLPやLINEに掲載できます。' : status === 'paused' ? 'フォーム受付を停止しました。' : 'フォーム状態を更新しました。');
    await load();
  };

  const publishSelectedForm = () => {
    const form = forms.find(item => item.id === selectedId);
    if (!form) return;
    const currentDefinition: FormDefinition = {
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
    if (!form) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setError(''); setNotice('');
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
    if (!deleted) { setError('削除対象が見つからないか、削除権限がありません。'); return; }
    setNotice(`フォーム「${form.name}」と関連する回答データを削除しました。`);
    resetForm();
    await load();
  };

  const updateSubmission = async (submission: Submission, status: Submission['status']) => {
    const supabase = getSupabase(); if (!supabase) return;
    setError('');
    const { error: updateError } = await supabase.from('diagnosis_submissions').update({
      status, reviewed_at: new Date().toISOString(),
    }).eq('id', submission.id);
    if (updateError) { setError(updateError.message); return; }
    await load();
  };

  const publicUrl = (form: DiagnosisForm) => window.location.origin + '/f/' + encodeURIComponent(form.public_slug);
  const copyUrl = async (form: DiagnosisForm) => {
    try {
      await navigator.clipboard.writeText(publicUrl(form));
      setCopiedId(form.id); window.setTimeout(() => setCopiedId(''), 1800);
    } catch { setError('URLをコピーできませんでした。URLを選択してコピーしてください。'); }
  };

  const updateQuestion = (index: number, patch: Partial<FormQuestion>) => setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...patch } : question));
  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  };
  const addQuestion = () => {
    if (questions.length >= 40) { setError('設問は40個まで追加できます。'); return; }
    setQuestions((current) => [...current, newQuestion()]);
  };
  const removeQuestion = (index: number) => setQuestions((current) => current.filter((_, i) => i !== index));

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all';
  const labelClass = 'block text-xs font-semibold text-slate-700';

  return (
    <div className="space-y-4">
      {showHeader && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><h2 className="font-bold text-slate-900">フォーム・診断の受付管理</h2><p className="mt-1 text-xs text-slate-500">フォーム名・設問・説明文を自由に作成・管理できます。</p></div>
        <div className="flex gap-2">
          <button onClick={() => switchSection('forms')} className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (section === 'forms' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>フォーム設定</button>
          <button onClick={() => switchSection('answers')} className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (section === 'answers' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>フォーム回答 ({visibleAnswers.length})</button>
          <button onClick={() => switchSection('materials')} className={'rounded-lg px-3 py-2 text-sm font-medium transition-colors ' + (section === 'materials' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>配布資料・PDF管理 ({materials.length})</button>
          <button onClick={() => void load()} title="更新" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
      {section === 'forms' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">フォーム一覧</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{forms.length}件</span>
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm">
                  <Plus className="h-3 w-3" />新規作成
                </button>
              </div>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">読み込み中…</p>
            ) : forms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                フォームはまだ登録されていません。右側の入力欄から新規作成してください。
              </div>
            ) : (
              <ul className="space-y-2">
                {forms.map(form => (
                  <li key={form.id}>
                    <button onClick={() => selectForm(form)} className={'w-full rounded-lg border p-3 text-left transition-colors ' + (selectedId === form.id ? 'border-purple-400 bg-purple-50/70 shadow-sm' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70')}>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-slate-900">{form.name}</span>
                        <div className="flex items-center gap-1.5">
                          {((form.form_type === 'diagnosis' || form.name.includes('診断')) && !readDefinition(form.definition).questions.some((q) => q.id === 'q_ops_bottleneck')) && (
                            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">最新化推奨</span>
                          )}
                          <span className="text-xs text-slate-500">{FORM_TYPES.find(x => x.value === form.form_type)?.label || '診断申込'} · {form.status}</span>
                        </div>
                      </div>
                      <div className="mt-1 break-all text-xs text-slate-400">/{form.public_slug}</div>
                    </button>
                    {form.status === 'published' && (
                      <div className="mt-2 flex items-center gap-2 pl-2">
                        <a href={publicUrl(form)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700">
                          <ExternalLink className="h-3 w-3" />公開フォームを開く
                        </a>
                        <button type="button" onClick={() => void copyUrl(form)} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                          {copiedId === form.id ? <ClipboardCheck className="h-3 w-3 text-emerald-600" /> : <Clipboard className="h-3 w-3" />}
                          {copiedId === form.id ? 'コピー済み' : 'URLをコピー'}
                        </button>
                        <button type="button" onClick={() => onOpenSendCenter?.(form.id, publicUrl(form), form.form_type === 'diagnosis' ? 'diagnosis' : 'form')} className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer shadow-2xs" title="フォーム一覧を見ながら右側の送信ドロワーで案内を送信します">送信ドロワーで案内</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {selectedId && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {forms.find(x => x.id === selectedId)?.status !== 'published' ? (
                  <button type="button" onClick={publishSelectedForm} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm">公開する</button>
                ) : (
                  <button type="button" onClick={() => { const f = forms.find(x => x.id === selectedId); if (f) void updateStatus(f, 'paused'); }} className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">受付停止</button>
                )}
                <button type="button" onClick={() => { const f = forms.find(x => x.id === selectedId); if (f) void updateStatus(f, 'archived'); }} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">アーカイブ</button>
                <button type="button" onClick={() => { const f = forms.find(x => x.id === selectedId); if (f) void updateStatus(f, 'draft'); }} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">下書きに戻す</button>
                <InlineDeleteButton onConfirm={()=>void deleteSelectedForm()} warning={`フォーム「${forms.find(item => item.id === selectedId)?.name || ''}」と関連する回答データを完全に削除しますか？この操作は取り消せません。`} confirmLabel="フォーム削除を確定" className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">フォームを削除</InlineDeleteButton>
              </div>
            )}
          </section>

          <form onSubmit={saveForm} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                <Plus className="mr-1 inline h-4 w-4 text-purple-600" />{selectedId ? 'フォームを編集' : '新しいフォームを作成'}
              </h3>
              {selectedId && (
                <button type="button" onClick={resetForm} className="text-xs font-medium text-purple-600 hover:underline">新規フォームを作成</button>
              )}
            </div>

            {formType === 'diagnosis' && (
            <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-bold text-purple-900 text-sm">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    営業資料準拠：経営の仕組み化 × 利益改善 ボトルネック診断（公式プリセット）
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    日々の手作業・売上利益・改善停滞原因・目指したい未来の4大ボトルネックを特定する最新設問構成です。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyOfficialBottleneckPreset(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    編集欄に反映
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyOfficialBottleneckPreset(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition"
                  >
                    <Save className="h-3.5 w-3.5" />
                    反映して即時保存
                  </button>
                </div>
              </div>
            </div>

            )}

            {formType === 'diagnosis' && !questions.some((q) => q.id === 'q_ops_bottleneck') && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>現在の設問は旧構成です。「反映して即時保存」を押すと、営業資料に合わせた最新ボトルネック設問（4問＋自由記述）に一括更新されます。</span>
                </div>
                <button
                  type="button"
                  onClick={() => void applyOfficialBottleneckPreset(true)}
                  className="rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 transition shadow-sm"
                >
                  今すぐ更新して保存
                </button>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>受付の種類
                <select value={formType} onChange={event => setFormType(event.target.value as FormType)} className={inputClass}>
                  {FORM_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>サービス区分・上部ラベル（任意）
                <input value={category} onChange={event => setCategory(event.target.value)} className={inputClass} placeholder="例：経営の仕組み化 × 利益改善" />
              </label>
            </div>

            <label className={labelClass}>個別面談の予約カレンダーURL（任意・Spir / TimeRex / Calendly など）
              <input value={bookingUrl} onChange={event => setBookingUrl(event.target.value)} className={inputClass} placeholder="例：https://app.spirbot.com/... または https://timerex.net/..." />
              <span className="text-xs text-slate-500">設定すると、診断回答完了後の速報サンクスページに「面談日時を選ぶ（予約する）」ボタンとして表示されます。自動フォローの {'{booking_url}'} にも差し込まれます。</span>
            </label>

            <label className={labelClass}>配布資料・サービス概要資料のURL（任意・PDF / Google Drive / 閲覧URL など）
              <input value={materialUrl} onChange={event => setMaterialUrl(event.target.value)} className={inputClass} placeholder="例：https://example.com/materials/guide.pdf" />
              <span className="text-xs text-slate-500">自動フォローの {'{material_url}'} プレースホルダーに差し込まれます。未設定の場合、{'{material_url}'} を含む自動フォローメッセージは安全のため送信が停止（failed）されます。</span>
            </label>

            <label className={labelClass}>フォーム名 <span className="text-rose-400">*</span>
              <input required value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder="例：業務ヒアリングフォーム、初回相談受付" />
            </label>

            <label className={labelClass}>フォーム説明（任意）
              <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className={inputClass} placeholder="回答者に表示する説明文を入力してください" />
            </label>

            <label className={labelClass}>個人情報の取り扱い案内 <span className="text-rose-400">*</span>
              <textarea required value={privacyNotice} onChange={event => setPrivacyNotice(event.target.value)} rows={3} className={inputClass} placeholder="個人情報の取り扱いに関する方針を入力してください" />
            </label>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">設問 ({questions.length}/40)</h4>
                  <p className="mt-1 text-xs text-slate-500">設問文、形式、選択肢、必須フラグを自由に設定できます。</p>
                </div>
                <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors">
                  <Plus className="h-3.5 w-3.5" />設問を追加
                </button>
              </div>

              {questions.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">設問 {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} aria-label="上へ移動" className="rounded p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} aria-label="下へ移動" className="rounded p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" disabled={formType === 'diagnosis' && questions.length <= 1} onClick={() => removeQuestion(index)} aria-label="設問を削除" className="rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={labelClass}>設問文 <span className="text-rose-500">*</span>
                      <input value={question.label} onChange={event => updateQuestion(index, { label: event.target.value })} className={inputClass} placeholder="設問文を入力してください" />
                    </label>
                    <label className={labelClass}>回答形式
                      <select value={question.type} onChange={event => updateQuestion(index, { type: event.target.value as QuestionType })} className={inputClass}>
                        {QUESTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </label>
                  </div>
                  {(question.type === 'select' || question.type === 'radio') && (
                    <label className={'mt-3 ' + labelClass}>選択肢（1行に1つ） <span className="text-rose-500">*</span>
                      <textarea value={question.options.join('\n')} onChange={event => updateQuestion(index, { options: event.target.value.split('\n').map(option => option.trim()).filter(Boolean) })} rows={3} className={inputClass} placeholder={'選択肢1\n選択肢2\n選択肢3'} />
                    </label>
                  )}
                  {question.type === 'checkbox' && (
                    <label className={'mt-3 ' + labelClass}>チェック項目の表示名
                      <input value={question.options[0] || ''} onChange={event => updateQuestion(index, { options: event.target.value ? [event.target.value] : [] })} className={inputClass} placeholder="例：該当する / 同意する" />
                    </label>
                  )}
                  <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={question.required} onChange={event => updateQuestion(index, { required: event.target.checked })} className="h-4 w-4 rounded accent-purple-600" />
                    回答必須にする
                  </label>
                </div>
              ))}
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">公開画面プレビュー</h4>
                {category && <span className="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">{category}</span>}
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">{name || '（フォーム名未設定）'}</div>
              {description ? (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{description}</p>
              ) : (
                <p className="mt-2 text-xs italic text-slate-400">説明文は未設定です。</p>
              )}
              <div className="mt-3 space-y-2">
                {questions.map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="text-xs font-medium text-slate-800">
                      {index + 1}. {question.label || '設問文未入力'}
                      {question.required && <span className="ml-1 text-rose-500 font-bold">必須</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {QUESTION_TYPES.find(type => type.value === question.type)?.label}
                      {question.options.length ? ' · ' + question.options.join(' / ') : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <button disabled={loading} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50">
              <Save className="h-4 w-4" />{selectedId ? '変更を保存' : '下書き保存'}
            </button>
            <p className="text-xs text-slate-500">保存後、フォーム一覧から「公開する」を選択すると公開URLが発行されます。</p>
          </form>
        </div>
      )}

      {section === 'answers' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">読み込み中…</p>
          ) : visibleAnswers.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">フォーム回答はまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="p-3">回答者</th>
                    <th className="p-3">フォーム</th>
                    <th className="p-3">受付日時</th>
                    <th className="p-3">状態</th>
                    <th className="p-3">確認</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleAnswers.map(answer => (
                    <Fragment key={answer.id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 text-slate-900 font-medium">
                          {answer.respondent_name || answer.respondent_email || '回答者未特定'}
                          <div className="text-xs text-slate-500 font-normal">{answer.respondent_email || ''}</div>
                          {answer.respondent_company_name && <div className="mt-1 text-xs text-purple-700 font-medium">会社名・屋号: {answer.respondent_company_name}</div>}
                        </td>
                        <td className="p-3 text-slate-700">
                          {forms.find(form => form.id === answer.form_id)?.name || answer.form_id.slice(0, 8)}
                          <div className="mt-1 text-xs">
                            {answer.diagnosis_id ? (
                              <button type="button" onClick={() => onOpenDiagnosis?.(answer.diagnosis_id!)} className="text-purple-600 underline font-medium hover:text-purple-700">診断を開く</button>
                            ) : forms.find(form => form.id === answer.form_id)?.form_type === 'diagnosis' ? (
                              <span className="text-amber-700 font-medium">{answer.company_id ? '診断未作成' : '会社未紐付け'}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 text-slate-500 text-xs">{new Date(answer.submitted_at).toLocaleString('ja-JP')}</td>
                        <td className="p-3 text-slate-700">{answer.status}</td>
                        <td className="p-3">
                          <select value={answer.status} onChange={event => void updateSubmission(answer, event.target.value as Submission['status'])} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-purple-500">
                            <option value="received">受付</option>
                            <option value="reviewing">対応中</option>
                            <option value="completed">完了</option>
                            <option value="rejected">対象外</option>
                          </select>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 bg-slate-50/40">
                        <td colSpan={5} className="px-3 pb-3">
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-purple-600 hover:text-purple-700">回答内容を確認</summary>
                            {(() => {
                              const form = forms.find(item => item.id === answer.form_id);
                              const questions = readDefinition(form?.definition).questions;
                              const questionById = new Map(questions.map(question => [question.id, question]));
                              const entries = Object.entries(answer.answers || {});
                              if (!entries.length) return <p className="mt-2 text-xs text-slate-500">回答はありません。</p>;
                              return (
                                <dl className="mt-2 space-y-2">
                                  {entries.map(([id, value]) => {
                                    const question = questionById.get(id);
                                    const displayValue = typeof value === 'boolean'
                                      ? (value ? (question?.options[0] || 'はい') : 'いいえ')
                                      : Array.isArray(value) ? value.join('、') : String(value ?? '—');
                                    return (
                                      <div key={id} className="grid gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)] shadow-2xs">
                                        <dt className="text-xs font-semibold text-slate-600">{question?.label || '設問 (' + id + ')'}</dt>
                                        <dd className="whitespace-pre-wrap break-words text-sm text-slate-800">{displayValue}</dd>
                                      </div>
                                    );
                                  })}
                                </dl>
                              );
                            })()}
                            {answer.reviewer_memo && <p className="mt-2 text-xs text-slate-600">確認メモ: {answer.reviewer_memo}</p>}
                          </details>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-slate-100 p-3 text-xs text-slate-500">診断フォームの回答は、対象会社が紐付いている場合に「未確認」の診断として自動作成されます。回答行の「診断を開く」から内容を確認できます。会社を特定できない回答は受付記録に保持します。</p>
        </section>
      )}

      {section === 'materials' && (
        <section className="space-y-4">
          {/* 説明バナー */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sky-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="font-bold flex items-center gap-1.5 text-sm sm:text-base">
                <FileText className="w-4 h-4 text-sky-600" />
                公式配布資料・PDFマスタ管理（公式HP自動連動）
              </h3>
              <p className="text-xs text-sky-800 mt-1 leading-relaxed">
                ここで資料の追加・差し替え・非表示を行うと、公式HPの資料請求フォームの選択肢、完了画面のダウンロードボタン、および送信されるメール・LINEの案内URLに即時反映されます（HPの再デプロイ不要）。
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMaterial({
                  key: '',
                  label: '',
                  description: '',
                  category: '経営実務',
                  sort_order: (materials.length + 1) * 10,
                  is_active: true,
                  external_url: '',
                  public_url: '',
                });
                setMaterialFormOpen(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              新規資料を追加
            </button>
          </div>

          {/* 新規登録 / 編集モーダル */}
          {materialFormOpen && editingMaterial && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                    <FileText className="w-5 h-5 text-purple-600" />
                    {editingMaterial.id ? '資料情報の編集・差し替え' : '新規配布資料の登録'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => { setMaterialFormOpen(false); setEditingMaterial(null); }}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveMaterial} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelClass}>
                      資料キー（英数字・ハイフン） <span className="text-rose-500">*</span>
                      <input
                        value={editingMaterial.key || ''}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, key: e.target.value })}
                        disabled={Boolean(editingMaterial.id)}
                        className={inputClass}
                        placeholder="例: management-guide"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">URLやHPクエリ（?type=...）で参照</span>
                    </label>

                    <label className={labelClass}>
                      カテゴリ
                      <input
                        value={editingMaterial.category || ''}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, category: e.target.value })}
                        className={inputClass}
                        placeholder="例: 経営実務・仕組み化"
                      />
                    </label>
                  </div>

                  <label className={labelClass}>
                    資料の表示名（タイトル） <span className="text-rose-500">*</span>
                    <input
                      value={editingMaterial.label || ''}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, label: e.target.value })}
                      className={inputClass}
                      placeholder="例: 経営改善実務ガイドブック（要点解説スライド）"
                      required
                    />
                  </label>

                  <label className={labelClass}>
                    資料の説明（HPのチェックボックス下に表示）
                    <textarea
                      value={editingMaterial.description || ''}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, description: e.target.value })}
                      rows={2}
                      className={inputClass}
                      placeholder="例: 中小企業が「手作業の山」「属人化」から脱却し、利益を残すための仕組み化実践論。"
                    />
                  </label>

                  {/* PDFアップロード枠 */}
                  <div className="p-4 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-purple-600" />
                        PDF実体ファイルのアップロード（最大20MB）
                      </span>
                      {uploadingPdf && <span className="text-xs text-purple-700 animate-pulse font-medium">アップロード中...</span>}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal">
                      Supabase Storage（materialsバケット）に直接保存されます。差し替え時は同じファイル名・同じ公開URLで上書きされるため、既存の配布リンクが切れずに保たれます。
                    </p>

                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadPdfFile(file);
                      }}
                      disabled={uploadingPdf}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                    />

                    {editingMaterial.public_url && (
                      <div className="pt-2 text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          現在の公開URL:
                        </div>
                        <div className="p-2 bg-white rounded border border-purple-100 font-mono text-[11px] break-all select-all text-slate-800">
                          {editingMaterial.public_url}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 外部URL直接指定（Storageを使わない場合） */}
                  <label className={labelClass}>
                    外部URL（Supabase Storage以外のURLを直接指定する場合）
                    <input
                      value={editingMaterial.external_url || ''}
                      onChange={(e) => {
                        const ext = e.target.value;
                        setEditingMaterial({
                          ...editingMaterial,
                          external_url: ext,
                          public_url: ext.trim() || editingMaterial.public_url,
                        });
                      }}
                      className={inputClass}
                      placeholder="https://corp.mstcorp.info/materials/..."
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2 pt-1">
                    <label className={labelClass}>
                      表示順（小さい順）
                      <input
                        type="number"
                        value={editingMaterial.sort_order ?? 0}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, sort_order: Number(e.target.value) })}
                        className={inputClass}
                      />
                    </label>

                    <label className="flex items-center gap-2 pt-6 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingMaterial.is_active !== false}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, is_active: e.target.checked })}
                        className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800">公開（HPやフォームに表示）</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setMaterialFormOpen(false); setEditingMaterial(null); }}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      disabled={loading || uploadingPdf}
                      className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      資料情報を保存
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 資料一覧カード */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">登録済み配布資料 ({materials.length}件)</h4>
                <span className="text-xs text-slate-500">HPの資料請求フォームに自動反映</span>
              </div>
              {materials.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = getSupabase();
                    if (!supabase) return;
                    setLoading(true);
                    try {
                      await supabase.from('public_materials').upsert([
                        {
                          key: 'management-guide',
                          label: '経営改善実務ガイドブック（要点解説スライド）',
                          description: '中小企業が「手作業の山」「属人化」から脱却し、利益を残すための仕組み化実践論。',
                          category: '経営実務・仕組み化',
                          external_url: 'https://corp.mstcorp.info/materials/mst-management-guide.pdf',
                          public_url: 'https://corp.mstcorp.info/materials/mst-management-guide.pdf',
                          is_active: true,
                          sort_order: 10,
                        },
                        {
                          key: 'care-package-overview',
                          label: '介護保険外サービス開業パッケージ概要資料',
                          description: '介護事業所・法人が保険外の自費収益柱（月30万〜100万円超）を最短で立ち上げるための実務手順。',
                          category: '開業パッケージ',
                          external_url: 'https://corp.mstcorp.info/materials/care-package-proposal.pdf',
                          public_url: 'https://corp.mstcorp.info/materials/care-package-proposal.pdf',
                          is_active: true,
                          sort_order: 20,
                        },
                      ], { onConflict: 'key' });
                      setNotice('公式最新資料URL（介護保険外開業パッケージPDF等）に再同期しました。');
                      await load();
                    } catch (e: any) {
                      setError('最新URLへの同期に失敗しました: ' + (e?.message || ''));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium border border-purple-200 cursor-pointer transition"
                  title="公式の最新PDF公開URL（介護保険外パッケージ等）に登録内容を再同期します"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                  <span>公式最新URLに再同期</span>
                </button>
              )}
            </div>

            {materials.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 space-y-3">
                <p>登録された配布資料はありません。「新規資料を追加」からPDFを登録するか、公式初期資料を投入してください。</p>
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = getSupabase();
                    if (!supabase) return;
                    setLoading(true);
                    try {
                      await supabase.from('public_materials').upsert([
                        {
                          key: 'management-guide',
                          label: '経営改善実務ガイドブック（要点解説スライド）',
                          description: '中小企業が「手作業の山」「属人化」から脱却し、利益を残すための仕組み化実践論。',
                          category: '経営実務・仕組み化',
                          external_url: 'https://corp.mstcorp.info/materials/mst-management-guide.pdf',
                          public_url: 'https://corp.mstcorp.info/materials/mst-management-guide.pdf',
                          is_active: true,
                          sort_order: 10,
                        },
                        {
                          key: 'care-package-overview',
                          label: '介護保険外サービス開業パッケージ概要資料',
                          description: '介護事業所・法人が保険外の自費収益柱（月30万〜100万円超）を最短で立ち上げるための実務手順。',
                          category: '開業パッケージ',
                          external_url: 'https://corp.mstcorp.info/materials/care-package-proposal.pdf',
                          public_url: 'https://corp.mstcorp.info/materials/care-package-proposal.pdf',
                          is_active: true,
                          sort_order: 20,
                        },
                      ], { onConflict: 'key' });
                      setNotice('公式初期資料2件（経営改善ガイド・介護開業パッケージ）を登録しました。');
                      await load();
                    } catch (e: any) {
                      setError('初期資料の登録に失敗しました: ' + (e?.message || ''));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>公式初期資料（2件）を自動セットアップ</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {materials.map((m) => (
                  <div key={m.id} className="py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-slate-50/50 p-2 rounded-lg transition">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {m.is_active ? '公開中（有効）' : '非表示（無効）'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-100">
                          {m.category || '一般'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-700">
                          key: {m.key}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (順序: {m.sort_order})
                        </span>
                      </div>

                      <h5 className="font-bold text-sm text-slate-900">{m.label}</h5>
                      {m.description && <p className="text-xs text-slate-600 line-clamp-2">{m.description}</p>}

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 font-mono">
                        <span className="truncate max-w-xs sm:max-w-md">URL: {m.public_url}</span>
                        {m.size_bytes > 0 && <span>({(m.size_bytes / 1024 / 1024).toFixed(2)} MB)</span>}
                      </div>
                    </div>

                    {/* 操作アクションボタングループ */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end md:self-center">
                      {/* 並び替えボタン */}
                      <div className="flex items-center border border-slate-200 rounded overflow-hidden bg-white shadow-2xs" title="表示順序の並び替え">
                        <button
                          type="button"
                          onClick={() => void handleMoveMaterialOrder(m, -1)}
                          disabled={materials.indexOf(m) === 0 || loading}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                          title="上へ（表示順を繰り上げ）"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-[1px] h-4 bg-slate-200" />
                        <button
                          type="button"
                          onClick={() => void handleMoveMaterialOrder(m, 1)}
                          disabled={materials.indexOf(m) === materials.length - 1 || loading}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition"
                          title="下へ（表示順を繰り下げ）"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* URLコピー */}
                      <button
                        type="button"
                        onClick={() => void copyMaterialUrl(m.public_url)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
                        title="公開URLをコピー"
                      >
                        {copiedMaterialUrl === m.public_url ? (
                          <>
                            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">コピー済</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>URLコピー</span>
                          </>
                        )}
                      </button>

                      {/* プレビュー表示 */}
                      <a
                        href={
                          m.key === 'care-package-overview' && m.public_url?.includes('care-package-overview.pdf')
                            ? 'https://corp.mstcorp.info/materials/care-package-proposal.pdf'
                            : m.public_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
                        title="PDFを新規タブで開く"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>開く</span>
                      </a>

                      {/* PDF直接上書き差し替えボタン */}
                      <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-medium transition cursor-pointer" title="同じURLのまま新しいPDFファイルに差し替えます">
                        <Upload className="w-3.5 h-3.5 text-purple-600" />
                        <span>PDF差し替え</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleUploadPdfFile(file, m);
                          }}
                          className="hidden"
                        />
                      </label>

                      {/* 有効/無効トグル */}
                      <button
                        type="button"
                        onClick={() => void handleToggleMaterialActive(m)}
                        className={`px-2.5 py-1.5 rounded text-xs font-medium transition border cursor-pointer ${
                          m.is_active
                            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                        title={m.is_active ? 'HPの選択肢から非表示にします' : 'HPの選択肢に表示します'}
                      >
                        {m.is_active ? '非公開にする' : '公開する'}
                      </button>

                      {/* 編集 */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMaterial({ ...m });
                          setMaterialFormOpen(true);
                        }}
                        className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition cursor-pointer"
                        title="資料情報・表示順を編集"
                      >
                        編集
                      </button>

                      {/* 削除 */}
                      <button
                        type="button"
                        onClick={() => void handleDeleteMaterial(m)}
                        className="p-1.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs transition cursor-pointer"
                        title="資料を完全に削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
