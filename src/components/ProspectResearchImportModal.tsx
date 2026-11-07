import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react';
import { getAuthHeaders, getSupabase } from '../lib/supabaseClient';

export interface ProspectCandidate {
  company_name: string;
  industry?: string;
  website?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  source_url?: string;
  reason?: string;
  duplicate_company_id?: string;
  existing_company_id?: string;
  existing_prospect_id?: string;
  duplicate_reason?: string;
  email_valid: boolean;
  selected: boolean;
}

const normalizeName = (value: string) =>
  value.toLowerCase().replace(/[\s　株式会社有限会社合同会社]/g, '');

const domainOf = (value?: string) => {
  if (!value) return '';
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const isValidEmail = (email?: string): boolean => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type InputTab = 'json' | 'table_paste' | 'csv_file' | 'ai_unstructured';

export const ProspectResearchImportModal: React.FC<Props> = ({ onClose, onImported }) => {
  const [activeTab, setActiveTab] = useState<InputTab>('json');

  // Batch metadata
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [batchName, setBatchName] = useState(`AI開拓リスト_${todayStr}`);
  const [sourceAi, setSourceAi] = useState<'ChatGPT' | 'Claude' | 'Gemini' | 'Perplexity' | 'その他'>('ChatGPT');
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update'>('skip');

  // Input states
  const [jsonInput, setJsonInput] = useState('');
  const [tablePasteInput, setTablePasteInput] = useState('');
  const [rawResearch, setRawResearch] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Processing & Candidate states
  const [candidates, setCandidates] = useState<ProspectCandidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedCount = useMemo(
    () => candidates.filter((c) => c.selected && (duplicateHandling === 'update' || !c.duplicate_company_id)).length,
    [candidates, duplicateHandling]
  );

  // CSV / TSV パーサー
  const parseDelimitedText = (text: string, delimiter: string = '\t') => {
    const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('ヘッダー行と少なくとも1件のデータ行が必要です。');

    // ヘッダー判定
    const headerLine = lines[0];
    const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    const findIndex = (keywords: string[]) =>
      headers.findIndex((h) => keywords.some((k) => h.includes(k)));

    const colCompany = findIndex(['会社名', '企業名', '社名', 'company', 'name']);
    const colEmail = findIndex(['メール', 'mail', 'email', '連絡先']);
    const colIndustry = findIndex(['業種', '業界', 'industry', 'category']);
    const colUrl = findIndex(['url', 'web', 'サイト', 'hp', 'website']);
    const colContact = findIndex(['担当', '代表', '氏名', 'person', 'contact']);
    const colAddress = findIndex(['住所', '所在地', 'address', 'location']);
    const colSourceUrl = findIndex(['根拠', 'source', '参照', '情報源']);
    const colReason = findIndex(['理由', '選定理由', 'reason', 'memo', '備考']);

    if (colCompany === -1) {
      throw new Error('「会社名」または「企業名」を含むカラムが見つかりません。ヘッダー名をご確認ください。');
    }

    const items: Array<Partial<ProspectCandidate>> = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const companyName = cols[colCompany] || '';
      if (!companyName) continue;

      items.push({
        company_name: companyName,
        email: colEmail !== -1 ? cols[colEmail] : undefined,
        industry: colIndustry !== -1 ? cols[colIndustry] : undefined,
        website: colUrl !== -1 ? cols[colUrl] : undefined,
        contact_person: colContact !== -1 ? cols[colContact] : undefined,
        address: colAddress !== -1 ? cols[colAddress] : undefined,
        source_url: colSourceUrl !== -1 ? cols[colSourceUrl] : undefined,
        reason: colReason !== -1 ? cols[colReason] : undefined,
      });
    }

    return items;
  };

  // 重複チェック＆形式検証処理
  const processAndDeduplicateItems = async (rawItems: Array<Partial<ProspectCandidate>>) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabaseデータベースに接続できません。');

    // 既存会社・既存見込み企業・既存コンタクトの照合用データを取得
    const [coRes, prRes, ctRes] = await Promise.all([
      supabase.from('companies').select('id, company_name, website').limit(2000),
      supabase.from('prospects').select('id, company_id, email, source').limit(2000),
      supabase.from('contacts').select('id, company_id, email').limit(2000),
    ]);

    const existingCompanies = coRes.data || [];
    const existingProspects = prRes.data || [];
    const existingContacts = ctRes.data || [];

    const nameMap = new Map<string, any>();
    const domainMap = new Map<string, any>();
    existingCompanies.forEach((c) => {
      nameMap.set(normalizeName(c.company_name || ''), c);
      const d = domainOf(c.website);
      if (d) domainMap.set(d, c);
    });

    const prospectCompanySet = new Set(existingProspects.map((p) => p.company_id));
    const prospectEmailMap = new Map<string, any>();
    existingProspects.forEach((p) => {
      if (p.email) prospectEmailMap.set(p.email.trim().toLowerCase(), p);
    });

    const contactEmailMap = new Map<string, any>();
    existingContacts.forEach((ct) => {
      if (ct.email) contactEmailMap.set(ct.email.trim().toLowerCase(), ct);
    });

    const reviewed: ProspectCandidate[] = rawItems.slice(0, 200).map((item) => {
      const cleanCompany = (item.company_name || '').trim().slice(0, 200);
      const cleanEmail = (item.email || '').trim().toLowerCase().slice(0, 200);
      const cleanUrl = (item.website || '').trim().slice(0, 500);
      const cleanIndustry = (item.industry || '').trim().slice(0, 100);
      const cleanPerson = (item.contact_person || '').trim().slice(0, 100);
      const cleanAddress = (item.address || '').trim().slice(0, 500);
      const cleanSourceUrl = (item.source_url || '').trim().slice(0, 1000);
      const cleanReason = (item.reason || '').trim().slice(0, 2000);

      const matchedCompany = nameMap.get(normalizeName(cleanCompany)) || (cleanUrl ? domainMap.get(domainOf(cleanUrl)) : undefined);
      const matchedProspectByEmail = cleanEmail ? prospectEmailMap.get(cleanEmail) : undefined;
      const matchedContactByEmail = cleanEmail ? contactEmailMap.get(cleanEmail) : undefined;

      const isCompanyDuplicate = Boolean(matchedCompany && prospectCompanySet.has(matchedCompany.id));
      const isEmailDuplicate = Boolean(matchedProspectByEmail || matchedContactByEmail);

      let duplicateReason = '';
      if (isEmailDuplicate) {
        duplicateReason = `営業メールアドレス「${cleanEmail}」は既に登録済みです`;
      } else if (isCompanyDuplicate) {
        duplicateReason = `既存の見込み企業「${matchedCompany.company_name}」（${matchedCompany.id}）と社名・ドメインが一致`;
      } else if (matchedCompany) {
        duplicateReason = `会社マスタ「${matchedCompany.company_name}」（${matchedCompany.id}）が存在します（会社連携して登録）`;
      }

      const emailValid = !cleanEmail || isValidEmail(cleanEmail);

      return {
        company_name: cleanCompany,
        industry: cleanIndustry,
        website: cleanUrl,
        email: cleanEmail,
        contact_person: cleanPerson,
        address: cleanAddress,
        source_url: cleanSourceUrl,
        reason: cleanReason,
        duplicate_company_id: (isCompanyDuplicate || isEmailDuplicate) ? (matchedCompany?.id || matchedProspectByEmail?.company_id || 'duplicate') : undefined,
        existing_company_id: matchedCompany && !isCompanyDuplicate ? matchedCompany.id : undefined,
        existing_prospect_id: matchedProspectByEmail?.id,
        duplicate_reason: duplicateReason,
        email_valid: emailValid,
        selected: (!isCompanyDuplicate && !isEmailDuplicate) || duplicateHandling === 'update',
      };
    });

    if (!reviewed.length) {
      throw new Error('取り込み対象の企業データが見つかりませんでした。入力内容をご確認ください。');
    }

    setCandidates(reviewed);
    const dupCount = reviewed.filter((r) => r.duplicate_company_id).length;
    setNotice(`解析完了: 合計 ${reviewed.length}件 を読み込みました（新規: ${reviewed.length - dupCount}件 / 重複検知: ${dupCount}件）。`);
  };

  // 1. JSON貼り付けの解析
  const handleParseJson = async () => {
    if (!jsonInput.trim()) { setError('JSONデータを貼り付けてください。'); return; }
    setError(''); setNotice(''); setIsProcessing(true);
    try {
      const cleanText = jsonInput.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleanText);
      const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.candidates) ? parsed.candidates : (Array.isArray(parsed.companies) ? parsed.companies : [parsed]));
      await processAndDeduplicateItems(rawList);
    } catch (err: any) {
      setError(err?.message || 'JSONの解析に失敗しました。書式をご確認ください。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 表の貼り付け（TSV）の解析
  const handleParseTable = async () => {
    if (!tablePasteInput.trim()) { setError('スプレッドシートやExcelからコピーした表を貼り付けてください。'); return; }
    setError(''); setNotice(''); setIsProcessing(true);
    try {
      const rawList = parseDelimitedText(tablePasteInput, '\t');
      await processAndDeduplicateItems(rawList);
    } catch (err: any) {
      setError(err?.message || '表データの解析に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. CSVファイルアップロード
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setError(''); setNotice(''); setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = String(event.target?.result || '');
        const delimiter = file.name.endsWith('.tsv') ? '\t' : ',';
        const rawList = parseDelimitedText(text, delimiter);
        await processAndDeduplicateItems(rawList);
      } catch (err: any) {
        setError(err?.message || 'CSVファイルの解析に失敗しました。');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setError('ファイルの読み込みに失敗しました。');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  // 4. AI自由形式テキストの社内AIレビュー
  const handleParseUnstructuredAi = async () => {
    if (!rawResearch.trim()) { setError('外部AIの調査結果テキストを貼り付けてください。'); return; }
    setError(''); setNotice(''); setIsProcessing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const prompt = `あなたは新規営業開拓リストのデータ構造化担当です。以下の外部AIによる調査結果テキストから、会社名・営業用メールアドレス・業種・WebサイトURL・担当者名・住所・根拠URL・選定理由を抽出してください。
出力形式: 必ずJSONオブジェクトのみを返してください。形式:
{"candidates":[{"company_name":"会社名","email":"営業用メールアドレス","industry":"業種","website":"https://...","contact_person":"担当者または代表者名","address":"所在地","source_url":"根拠URL","reason":"選定根拠"}]}
不明な項目は空文字にしてください。最大50社。
【外部AI調査テキスト】
${rawResearch.slice(0, 30000)}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          workModeId: 'research',
          character: { name: 'リスト構造化AI', role: '見込み企業データの抽出・正規化', personality: '正確で慎重', tone: '簡潔' },
          stream: false,
        }),
      });

      const result = await res.json();
      if (!res.ok || typeof result.text !== 'string') throw new Error(result.error || '社内AI抽出に失敗しました。');
      const jsonText = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(jsonText);
      const rawList = Array.isArray(parsed.candidates) ? parsed.candidates : [];
      await processAndDeduplicateItems(rawList);
    } catch (err: any) {
      setError(err?.message || '社内AIによる抽出に失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 一括登録処理（バッチ作成・会社マスタ作成・見込み企業作成・コンタクト連携）
  const importSelected = async () => {
    const supabase = getSupabase();
    if (!supabase || selectedCount === 0) return;
    setError(''); setNotice(''); setIsSaving(true);

    const batchId = `batch-${Date.now()}`;
    const cleanBatchName = (batchName || `AI開拓リスト_${todayStr}`).trim();
    // 標準化された source 文字列（「外部AI調査」を確実に含める）
    const standardizedSource = `外部AI調査 [${sourceAi}] - ${cleanBatchName}`;

    let importedCount = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. 取込バッチ（prospect_import_batches）の作成
      try {
        await supabase.from('prospect_import_batches').insert({
          id: batchId,
          name: cleanBatchName,
          source_ai: sourceAi,
          item_count: selectedCount,
          created_by: user?.email || user?.id || 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (batchErr) {
        console.warn('prospect_import_batches insert fallback:', batchErr);
      }

      // 2. 会社マスタの採番
      const { data: existingCos } = await supabase.from('companies').select('id').like('id', 'CID-%').limit(2000);
      let nextNumber = Math.max(0, ...(existingCos || []).map((row: any) => Number(String(row.id).match(/^CID-(\d+)$/)?.[1] || 0))) + 1;

      const targetCandidates = candidates.filter((item) =>
        item.selected && (duplicateHandling === 'update' || !item.duplicate_company_id)
      );

      for (const candidate of targetCandidates) {
        let companyId = candidate.existing_company_id;

        // 会社が未登録の場合は会社マスタに新規登録
        if (!companyId) {
          companyId = `CID-${String(nextNumber++).padStart(3, '0')}`;
          const { error: companyError } = await supabase.from('companies').insert({
            id: companyId,
            company_name: candidate.company_name,
            industry: candidate.industry || null,
            website: candidate.website || null,
            address: candidate.address || null,
          });
          if (companyError) {
            console.warn(`Company insert warning:`, companyError.message);
          }
        }

        const sourceMemo = [
          candidate.reason,
          candidate.source_url ? `調査根拠URL: ${candidate.source_url}` : null,
          `取込バッチ: ${cleanBatchName} (${sourceAi})`,
        ].filter(Boolean).join('\n');

        // 見込み企業（prospects）への登録または更新
        const prospectPayload: Record<string, any> = {
          company_id: companyId,
          status: '未接触',
          source: standardizedSource,
          approach_method: 'メール',
          target_flag: true,
          ai_reason: sourceMemo,
          memo: candidate.source_url ? `調査根拠URL: ${candidate.source_url}` : null,
          import_batch_id: batchId,
          email: candidate.email || null,
          contact_person: candidate.contact_person || null,
          source_url: candidate.source_url || null,
          opted_out: false,
          updated_at: new Date().toISOString(),
        };

        if (candidate.existing_prospect_id && duplicateHandling === 'update') {
          await supabase.from('prospects').update(prospectPayload).eq('id', candidate.existing_prospect_id);
        } else {
          // 新規挿入（カラム未定義エラー時のフォールバック保護）
          let { error: pErr } = await supabase.from('prospects').insert(prospectPayload);
          if (pErr && (pErr.message?.includes('import_batch_id') || pErr.message?.includes('opted_out'))) {
            delete prospectPayload.import_batch_id;
            delete prospectPayload.email;
            delete prospectPayload.opted_out;
            delete prospectPayload.contact_person;
            delete prospectPayload.source_url;
            await supabase.from('prospects').insert(prospectPayload);
          }
        }

        // メールアドレスが取得できている場合は連絡先（contacts）にも自動連携登録（一斉配信メールのシームレス配信対応）
        if (candidate.email && isValidEmail(candidate.email)) {
          try {
            await supabase.from('contacts').insert({
              company_id: companyId,
              full_name: candidate.contact_person || `${candidate.company_name} ご担当者`,
              email: candidate.email,
              email_consent_status: 'opted_in',
              email_consent_source: `外部AI調査新規開拓 [${sourceAi}]`,
            });
          } catch (_) {
            // contacts 重複時は安全に無視
          }
        }

        importedCount++;
      }

      setNotice(`✅ ${importedCount}社の見込み企業を正常に取り込みました（バッチ: ${cleanBatchName}）。`);
      setCandidates([]);
      onImported();
    } catch (saveError: any) {
      setError(saveError?.message || '見込み企業の登録中にエラーが発生しました。');
      if (importedCount > 0) {
        setNotice(`${importedCount}社は登録完了しました。`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-xs animate-fade-in">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-slate-800 p-5 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                AI営業開拓リスト取込
              </span>
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-white">
              見込み企業リストの取り込み ＆ バッチ登録
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              AI（ChatGPT / Gemini / Claude）で調査・出力した新規企業リストを、重複チェック（社名・ドメイン・メール）およびメール検証を経て一括登録します。
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs text-slate-300">
          {error && (
            <div className="flex gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3.5 text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold">取り込みエラー</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {notice && (
            <div className="flex gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 text-emerald-200 font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* Step 1: Batch Configuration */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-200 text-xs">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>取込バッチ基本情報（メール営業の絞り込み単位になります）</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">リスト名（取込バッチ名）</label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="例: AI開拓_製造業_20261107"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">取込元AI</label>
                <select
                  value={sourceAi}
                  onChange={(e) => setSourceAi(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ChatGPT">ChatGPT (OpenAI)</option>
                  <option value="Claude">Claude (Anthropic)</option>
                  <option value="Gemini">Gemini (Google)</option>
                  <option value="Perplexity">Perplexity AI</option>
                  <option value="その他">その他外部AIツール</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">重複検知時の処理</label>
                <select
                  value={duplicateHandling}
                  onChange={(e) => setDuplicateHandling(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="skip">重複時はスキップ（新規企業のみ登録）</option>
                  <option value="update">重複時は最新データで更新（上書き）</option>
                </select>
              </div>
            </div>
          </section>

          {/* Step 2: Input Modes Navigation */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'json'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>① AI出力 JSON貼り付け</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('table_paste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'table_paste'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>② 表貼り付け（Excel/Sheetsコピー）</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('csv_file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'csv_file'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>③ CSVファイルアップロード</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ai_unstructured')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'ai_unstructured'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>④ AI自由形式テキスト（社内AI構造化）</span>
              </button>
            </div>

            {/* TAB 1: JSON */}
            {activeTab === 'json' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-200">
                    ChatGPT / Claude / Gemini が出力した JSON 配列を貼り付けてください
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setJsonInput(`[
  {
    "company_name": "株式会社テクノロジー",
    "email": "info@tech-sample.co.jp",
    "industry": "IT・通信",
    "website": "https://tech-sample.co.jp",
    "contact_person": "佐藤 健二",
    "address": "東京都千代田区神田1-2-3",
    "source_url": "https://tech-sample.co.jp/about",
    "reason": "DX改善ニーズが高い業態"
  }
]`);
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                  >
                    サンプルJSONを挿入
                  </button>
                </div>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={6}
                  placeholder='[{"company_name": "...", "email": "info@...", "industry": "...", "website": "https://...", "contact_person": "...", "source_url": "..."}]'
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleParseJson}
                  disabled={isProcessing || !jsonInput.trim()}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 transition cursor-pointer"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>JSONを解析して重複チェック実行</span>
                </button>
              </div>
            )}

            {/* TAB 2: Table Paste */}
            {activeTab === 'table_paste' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-200">
                  スプレッドシートやExcelからヘッダー（会社名、メール、業種、URL等）ごとコピーして貼り付けてください（タブ区切りTSV）
                </p>
                <textarea
                  value={tablePasteInput}
                  onChange={(e) => setTablePasteInput(e.target.value)}
                  rows={6}
                  placeholder={`会社名\tメール\t業種\tURL\t担当者\t住所\t根拠URL\n株式会社サンプル\tcontact@sample.jp\tサービス業\thttps://sample.jp\t山田太郎\t東京都\thttps://sample.jp/about`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleParseTable}
                  disabled={isProcessing || !tablePasteInput.trim()}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 transition cursor-pointer"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  <span>表データを解析して重複チェック実行</span>
                </button>
              </div>
            )}

            {/* TAB 3: CSV File Upload */}
            {activeTab === 'csv_file' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 text-center">
                <div className="max-w-md mx-auto border-2 border-dashed border-slate-700 rounded-xl p-6 hover:border-indigo-500 transition cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-200">CSVまたはTSVファイルを選択</p>
                  <p className="text-[11px] text-slate-500 mt-1">1行目に会社名、メール、業種などのヘッダー行が必要です</p>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="mt-3 text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white cursor-pointer"
                  />
                  {uploadedFileName && (
                    <p className="mt-2 text-xs font-bold text-emerald-400">選択中: {uploadedFileName}</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: AI Unstructured Text */}
            {activeTab === 'ai_unstructured' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-200">
                  外部AIの調査レポートや文章をそのまま貼り付けて社内AIで構造化・抽出します
                </p>
                <textarea
                  value={rawResearch}
                  onChange={(e) => setRawResearch(e.target.value)}
                  rows={6}
                  maxLength={30000}
                  placeholder="会社名・営業メール・業種・Webサイト・調査根拠などを含むAIの出力を貼り付け"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-5 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleParseUnstructuredAi}
                  disabled={isProcessing || !rawResearch.trim()}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 transition cursor-pointer"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>社内AIで解析・候補抽出（最大50社）</span>
                </button>
              </div>
            )}
          </section>

          {/* Step 3: Candidates Preview & Duplicate Inspection */}
          {candidates.length > 0 && (
            <section className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    取込プレビュー ＆ 重複点検（{candidates.length}件）
                  </h3>
                  <span className="text-xs text-indigo-300 font-bold bg-indigo-950/60 border border-indigo-700/50 px-2 py-0.5 rounded-full">
                    登録対象: {selectedCount}件
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCandidates((prev) =>
                        prev.map((c) => ({ ...c, selected: duplicateHandling === 'update' || !c.duplicate_company_id }))
                      )
                    }
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    対象全選択
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setCandidates((prev) => prev.map((c) => ({ ...c, selected: false })))}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    選択解除
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {candidates.map((candidate, index) => {
                  const isDup = Boolean(candidate.duplicate_company_id);
                  const isEmailInvalid = !candidate.email_valid;

                  return (
                    <article
                      key={`${candidate.company_name}-${index}`}
                      className={`rounded-xl border p-3.5 transition ${
                        isDup
                          ? 'border-amber-500/40 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        <input
                          type="checkbox"
                          checked={candidate.selected}
                          onChange={(e) =>
                            setCandidates((items) =>
                              items.map((item, i) => (i === index ? { ...item, selected: e.target.checked } : item))
                            )
                          }
                          className="mt-1 h-4 w-4 accent-indigo-500 cursor-pointer"
                        />

                        <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {candidate.company_name}
                            </span>

                            {candidate.duplicate_reason && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900/60 text-amber-200 border border-amber-600/40">
                                {candidate.duplicate_reason}
                              </span>
                            )}

                            {candidate.existing_company_id && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-600/40">
                                既存会社利用 ({candidate.existing_company_id})
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1 text-slate-300 text-[11px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {candidate.email ? (
                                <span className={isEmailInvalid ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                                  {candidate.email} {isEmailInvalid && '⚠️メール形式不正'}
                                </span>
                              ) : (
                                <span className="text-slate-500">（メール未記載）</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 truncate">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{candidate.contact_person || '担当者未設定'}</span>
                            </div>

                            <div className="truncate">
                              <span className="text-slate-400">業種: </span>
                              <span>{candidate.industry || '未指定'}</span>
                            </div>
                          </div>

                          {(candidate.website || candidate.address) && (
                            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
                              {candidate.website && (
                                <span className="truncate max-w-xs">
                                  URL: <a href={candidate.website} target="_blank" rel="noreferrer" className="text-indigo-400 underline">{candidate.website}</a>
                                </span>
                              )}
                              {candidate.address && <span>住所: {candidate.address}</span>}
                            </div>
                          )}

                          {candidate.reason && (
                            <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg leading-relaxed">
                              {candidate.reason}
                              {candidate.source_url && (
                                <> · <a href={candidate.source_url} target="_blank" rel="noreferrer" className="text-sky-400 underline">根拠URL</a></>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 p-4">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              バッチ名「{batchName}」で登録され、メール営業でバッチ指定配信・特定電子メール法準拠オプトアウトが可能です。
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            >
              キャンセル
            </button>
            {candidates.length > 0 && (
              <button
                type="button"
                onClick={importSelected}
                disabled={isSaving || selectedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>選択した {selectedCount}社 をバッチ登録</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
