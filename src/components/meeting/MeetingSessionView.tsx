import React, { useEffect, useRef, useState } from 'react';
import { X, Monitor, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { getSupabase, getAuthHeaders } from '../../lib/supabaseClient';
import {
  HEARING_QUESTIONS, HEARING_TYPE_QUESTIONS, HEARING_CORE_VERSION, MEMO_KEY, SUMMARY_KEY, DECISIONS_KEY,
  MAX_EXTRA_QUESTIONS, sanitizeCoreAnswers, sanitizeExtraQuestions, answeredCount, type CoreAnswers, type ExtraQuestion,
} from '../../constants/hearingSheet';
import { renderMeetingShareHtml } from '../../utils/meetingShare';

interface Props {
  diagnosisId: string;
  companyId: string | null;
  companyName: string;
  formAnswers: Record<string, unknown>;
  onClose: () => void;
}

const isMissingTable = (err: any) => ['PGRST205', '42P01'].includes(String(err?.code)) || /hearing_sheets/.test(String(err?.message || ''));

export const MeetingSessionView: React.FC<Props> = ({ diagnosisId, companyId, companyName, formAnswers, onClose }) => {
  const [answers, setAnswers] = useState<CoreAnswers>(sanitizeCoreAnswers({}));
  const [extra, setExtra] = useState<ExtraQuestion[]>([]);
  const [status, setStatus] = useState<'draft' | 'completed'>('draft');
  const [report, setReport] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [message, setMessage] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState<'' | 'organize' | 'extra'>('');
  const sheetId = useRef<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      if (!supabase) { setMessage('データベースに接続できません。'); setLoaded(true); return; }
      const rep = await supabase.from('ai_reports').select('full_report_text').eq('diagnosis_id', diagnosisId).eq('is_latest', true).maybeSingle();
      if (!cancelled) setReport(String(rep.data?.full_report_text || ''));
      const res = await supabase.from('hearing_sheets').select('*').eq('diagnosis_id', diagnosisId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (cancelled) return;
      if (res.error) {
        if (isMissingTable(res.error)) setTableMissing(true);
        else setMessage(`ヒアリングシートを読み込めませんでした: ${res.error.message}`);
      } else if (res.data) {
        sheetId.current = res.data.id;
        setAnswers(sanitizeCoreAnswers(res.data.core_answers));
        setExtra(sanitizeExtraQuestions(res.data.extra_questions));
        setStatus(res.data.status === 'completed' ? 'completed' : 'draft');
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [diagnosisId]);

  const save = async (nextStatus: 'draft' | 'completed' = status): Promise<boolean> => {
    if (tableMissing) return false;
    setSaveState('saving');
    const supabase = getSupabase();
    if (!supabase) { setSaveState('error'); setMessage('データベースに接続できません。'); return false; }
    const payload: any = {
      core_version: HEARING_CORE_VERSION, core_answers: answers, extra_questions: extra, status: nextStatus,
      updated_at: new Date().toISOString(),
      ...(nextStatus === 'completed' ? { conducted_at: new Date().toISOString() } : {}),
    };
    const result = sheetId.current
      ? await supabase.from('hearing_sheets').update(payload).eq('id', sheetId.current).select('id').maybeSingle()
      : await supabase.from('hearing_sheets').insert({ ...payload, diagnosis_id: diagnosisId, company_id: companyId }).select('id').maybeSingle();
    if (result.error) {
      if (isMissingTable(result.error)) setTableMissing(true);
      setSaveState('error');
      setMessage(`保存できませんでした: ${result.error.message}`);
      return false;
    }
    if (result.data?.id) sheetId.current = result.data.id;
    dirty.current = false;
    setSaveState('saved');
    return true;
  };

  // 入力が止まって1.5秒後に自動保存
  useEffect(() => {
    if (!loaded || !dirty.current || tableMissing) return;
    const t = setTimeout(() => { void save(); }, 1500);
    return () => clearTimeout(t);
  }, [answers, extra]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAnswer = (id: string, value: string) => { dirty.current = true; setAnswers((p) => ({ ...p, [id]: value })); };

  const callApi = async (path: string, body: unknown) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '処理できませんでした。');
    return data;
  };

  const organize = async () => {
    setBusy('organize'); setMessage('');
    try {
      const { notes } = await callApi('/api/meetings/organize-notes', { kind: 'sales', transcript: answers[MEMO_KEY] || '' });
      dirty.current = true;
      setAnswers((prev) => {
        const next = { ...prev };
        // 担当者が入力済みの欄は上書きしない。空の欄にだけ入れる
        if (notes.answers) for (const [k, v] of Object.entries(notes.answers as Record<string, string>)) if (v && !String(prev[k] || '').trim()) next[k] = v;
        if (notes.summary && !String(prev[SUMMARY_KEY] || '').trim()) next[SUMMARY_KEY] = notes.summary;
        const formattedDecisions = (notes.decisions || []).map((d: string) => `・${d}`).join('\n');
        if (formattedDecisions && !String(prev[DECISIONS_KEY] || '').trim()) next[DECISIONS_KEY] = formattedDecisions;
        return next;
      });
      setMessage('整理しました。内容を確認し、違うところは直してください(入力済みの欄は上書きしていません)。');
    } catch (e: any) { setMessage(e.message); } finally { setBusy(''); }
  };

  const suggestExtra = async () => {
    setBusy('extra'); setMessage('');
    try {
      const { questions } = await callApi('/api/meetings/extra-questions', { context: { report, answers: formAnswers } });
      dirty.current = true;
      setExtra((prev) => sanitizeExtraQuestions([...prev, ...(questions as string[]).map((q) => ({ q, a: '' }))]));
      if (!questions.length) setMessage('追加で確認したい点は見つかりませんでした。');
    } catch (e: any) { setMessage(e.message); } finally { setBusy(''); }
  };

  const openShare = () => {
    const w = window.open('', 'mst-share', 'width=1100,height=800');
    if (!w) { setMessage('共有用の画面を開けませんでした。ポップアップを許可してください。'); return; }
    w.document.open(); w.document.write(renderMeetingShareHtml(report, companyName)); w.document.close();
  };

  const complete = async () => { if (await save('completed')) { setStatus('completed'); setMessage('商談を完了にしました。提案書を作ると、この内容が商談メモに入ります。'); } };

  const close = async () => { if (dirty.current) await save(); onClose(); };
  const area = 'w-full rounded-lg border border-slate-300 p-2 text-sm';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-center overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-4xl my-6 rounded-xl shadow-xl p-6 space-y-5 h-fit">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">商談: {companyName || '(会社名なし)'}</h2>
            <p className="text-xs text-slate-500">この画面は社内用です。画面共有は「共有用の画面」を使ってください(診断D0〜D5だけを表示します)。</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openShare} disabled={!report} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold disabled:opacity-50">
              <Monitor className="w-3.5 h-3.5" />共有用の画面を開く
            </button>
            <button type="button" onClick={close} aria-label="閉じる" className="p-1.5 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {tableMissing && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            ヒアリングシートの保存先がまだ作られていません。管理者が docs/db-proposals/20261111100000_proposal_hearing_tables.sql を Supabase の SQL Editor で実行すると保存できます。それまでは入力しても保存されません。
          </div>
        )}
        {message && <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-sm">{message}</div>}
        {!loaded && <p className="text-sm text-slate-500">読み込み中…</p>}

        <section className="space-y-3">
          <h3 className="font-bold text-sm">ヒアリング({answeredCount(answers)}/{HEARING_QUESTIONS.length})</h3>
          {HEARING_QUESTIONS.map((q) => (
            <label key={q.id} className="block">
              <span className="text-sm font-medium">{q.label}</span>
              <span className="ml-2 text-[11px] text-slate-500">{q.why}</span>
              <textarea className={area} rows={2} value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)} />
            </label>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-bold text-sm">型の判断</h3>
          <label className="block"><span className="text-sm font-medium">{HEARING_TYPE_QUESTIONS.t01.label}</span>
            <select className={area} value={answers.t01 || ''} onChange={(e) => setAnswer('t01', e.target.value)}>
              <option value="">未確認</option>
              {HEARING_TYPE_QUESTIONS.t01.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></label>
          <label className="block"><span className="text-sm font-medium">{HEARING_TYPE_QUESTIONS.t02.label}</span>
            <select className={area} value={answers.t02 || ''} onChange={(e) => setAnswer('t02', e.target.value)}>
              <option value="">未確認</option>
              {HEARING_TYPE_QUESTIONS.t02.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></label>
          <label className="block"><span className="text-sm font-medium">{HEARING_TYPE_QUESTIONS.t03.label}</span>
            <textarea className={area} rows={2} value={answers.t03 || ''} onChange={(e) => setAnswer('t03', e.target.value)} /></label>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">AIの追加質問(最大{MAX_EXTRA_QUESTIONS}問・社内用)</h3>
            <button type="button" onClick={suggestExtra} disabled={busy !== '' || extra.length >= MAX_EXTRA_QUESTIONS} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs disabled:opacity-50">
              {busy === 'extra' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}質問を提案
            </button>
          </div>
          {extra.map((e, i) => (
            <label key={i} className="block"><span className="text-sm font-medium">{e.q}</span>
              <textarea className={area} rows={2} value={e.a} onChange={(ev) => { dirty.current = true; setExtra((p) => p.map((x, j) => (j === i ? { ...x, a: ev.target.value } : x))); }} /></label>
          ))}
        </section>

        <section className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm">文字起こしからAI整理（商談ヒアリング＋提案書メモ）</h3>
              <p className="text-xs text-slate-500">Zoom や Google Meet の文字起こしをそのまま貼り付けます。録画・文字起こしをする場合は、事前にお客様へ伝えて同意を得てください。</p>
            </div>
            <button type="button" onClick={organize} disabled={busy !== '' || (answers[MEMO_KEY] || '').trim().length < 20} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 shrink-0 cursor-pointer">
              {busy === 'organize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}AIで整理して空欄へ反映
            </button>
          </div>
          <textarea className={area} rows={7} placeholder="ここに文字起こしを貼り付け（20文字以上）" value={answers[MEMO_KEY] || ''} onChange={(e) => setAnswer(MEMO_KEY, e.target.value)} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">商談の要約（提案書へ自動転記）</span>
              <span className="block text-[11px] text-slate-500 mb-1">ヒアリング10問に入りきらない背景・温度感など</span>
              <textarea className={area} rows={3} value={answers[SUMMARY_KEY] || ''} onChange={(e) => setAnswer(SUMMARY_KEY, e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">商談での合意事項（提案書へ自動転記）</span>
              <span className="block text-[11px] text-slate-500 mb-1">見積条件・対象範囲・希望時期など提案書の前提となる合意</span>
              <textarea className={area} rows={3} value={answers[DECISIONS_KEY] || ''} onChange={(e) => setAnswer(DECISIONS_KEY, e.target.value)} />
            </label>
          </div>
        </section>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-xs text-slate-500">{saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '保存しました' : status === 'completed' ? '商談完了' : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={tableMissing} className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50">保存</button>
            <button type="button" onClick={complete} disabled={tableMissing} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />商談完了</button>
          </div>
        </div>
      </div>
    </div>
  );
};
