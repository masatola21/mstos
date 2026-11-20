import React, { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileText
} from 'lucide-react';
import { executeDealWonAutomation } from '../services/dealWonAutomationService';
import {
  appendUniqueNote,
  resolveNonDowngradingLeadStatus,
  resolveWebApplyDealPlanName,
  isGenericDocumentTitle,
} from '../utils/crmPipelineFlow';

interface PublicDocument {
  id: string;
  title: string;
  documentType: string;
  status: string;
  bodyHtml: string;
  companyId?: string;
  companyName?: string;
  dealId?: string;
  dealStatus?: string;
  dealAmount?: number;
  leadId?: string;
  contact_id?: string;
  contactId?: string;
  consentRecordedAt?: string | null;
  consentMethod?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface PublicDocumentApplyViewProps {
  documentId: string;
}

export const PublicDocumentApplyView: React.FC<PublicDocumentApplyViewProps> = ({ documentId }) => {
  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [resultDealId, setResultDealId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [consentInfo, setConsentInfo] = useState<{ recordedAt?: string; ip?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. まずサーバーAPIを試行
        let fetchedDoc: PublicDocument | null = null;
        try {
          const res = await fetch(`/api/public/documents/${encodeURIComponent(documentId)}`);
          if (res.ok) {
            const data = await res.json();
            fetchedDoc = data.document;
          }
        } catch {
          // API失敗時はクライアント側Supabaseへフォールバック
        }

        // 2. サーバーAPIで取得できなかった場合、Supabaseクライアントから直接取得
        if (!fetchedDoc) {
          const supabase = getSupabase();
          if (supabase) {
            let dbDoc: any = null;
            let dbErr: any = null;
            const fullRes = await supabase
              .from('customer_documents')
              .select('*')
              .eq('id', documentId)
              .maybeSingle();
            dbDoc = fullRes.data;
            dbErr = fullRes.error;
            if (dbErr) {
              const basicRes = await supabase
                .from('customer_documents')
                .select('id, title, document_type, status, body_html, company_id, created_at')
                .eq('id', documentId)
                .maybeSingle();
              dbDoc = basicRes.data;
              dbErr = basicRes.error;
            }

            if (!dbErr && dbDoc) {
              let companyName = '';
              if (dbDoc.company_id) {
                const { data: comp } = await supabase.from('companies').select('company_name').eq('id', dbDoc.company_id).maybeSingle();
                companyName = comp?.company_name || '';
              }

              let dealStatus = '';
              let dealAmount: number | undefined;
              if (dbDoc.deal_id) {
                const { data: deal } = await supabase.from('deals').select('proposal_status, total_amount').eq('id', dbDoc.deal_id).maybeSingle();
                dealStatus = deal?.proposal_status || '';
                dealAmount = deal?.total_amount;
              }

              fetchedDoc = {
                id: dbDoc.id,
                title: dbDoc.title,
                documentType: dbDoc.document_type,
                status: dbDoc.status,
                bodyHtml: dbDoc.body_html,
                companyId: dbDoc.company_id,
                companyName,
                dealId: dbDoc.deal_id,
                dealStatus,
                dealAmount,
                leadId: dbDoc.lead_id,
                consentRecordedAt: dbDoc.consent_recorded_at,
                consentMethod: dbDoc.consent_method,
                createdAt: dbDoc.created_at,
                updatedAt: dbDoc.updated_at,
              };
            }
          }
        }

        if (cancelled) return;

        if (!fetchedDoc) {
          throw new Error('書類が見つかりませんでした。URLが正しいかご確認ください。');
        }

        setDoc(fetchedDoc);
        // 社内承認 status === 'approved' ではなく、顧客が実際に「この内容で申し込む」を完了した証跡 (consentRecordedAt) がある場合のみ成約済み状態にする
        const hasCustomerApplied = Boolean(fetchedDoc.consentRecordedAt);
        if (hasCustomerApplied) {
          setApplied(true);
          setResultDealId(fetchedDoc.dealId || null);
          setConsentInfo({ recordedAt: fetchedDoc.consentRecordedAt || undefined });
        } else {
          setApplied(false);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || '書類の読み込みに失敗しました。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchDocument();
    return () => { cancelled = true; };
  }, [documentId]);

  // 書類本文内の「この内容で申し込む」ボタンを押した際、下部の確定エリアへスムーズスクロール
  useEffect(() => {
    const handleCtaClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('.web-apply-box a');
      if (target) {
        e.preventDefault();
        setAgreeChecked(true);
        const section = document.getElementById('apply-cta-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    document.addEventListener('click', handleCtaClick);
    return () => document.removeEventListener('click', handleCtaClick);
  }, []);

  const handleExecuteApply = async () => {
    try {
      setSubmitting(true);
      setError('');
      setShowConfirmModal(false);

      let appliedDealId: string | null = null;

      // 1. まずサーバーAPIを試行
      try {
        const consentEvidenceText = '上記の内容（金額、委託範囲、支払条件等）を確認し、本内容での発注および申し込みに同意します。';
        const res = await fetch(`/api/public/documents/${encodeURIComponent(documentId)}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consentMethod: 'web_apply',
            consentEvidenceText,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            appliedDealId = data.dealId;
            setConsentInfo({ recordedAt: data.consentRecordedAt, ip: data.consentIp });
          }
        }
      } catch {
        // フォールバックへ
      }

      // 2. サーバーAPIが未設定または失敗した場合、Supabaseクライアントから直接実行
      if (!appliedDealId) {
        const supabase = getSupabase();
        if (!supabase) throw new Error('データベース接続が見つかりません。');

        const nowIso = new Date().toISOString();
        const todayStr = nowIso.slice(0, 10);
        const rawDocType = String(doc?.documentType || '');
        const docTitle = String(doc?.title || '');
        const effectiveType =
          (rawDocType === 'proposal' || rawDocType === 'other') && /見積/.test(docTitle)
            ? 'estimate'
            : (rawDocType === 'diagnosis_report' || rawDocType === 'report' || rawDocType === 'proposal' || rawDocType === 'other') && /(月次|月報)/.test(docTitle)
              ? 'monthly_report'
              : rawDocType === 'report'
                ? 'diagnosis_report'
                : rawDocType;
        const isReceiptOnly = effectiveType === 'invoice' || effectiveType === 'monthly_report';

        if (isReceiptOnly) {
          const { error: recErr } = await supabase.from('customer_documents').update({
            status: 'approved',
            consent_method: 'web_apply',
            consent_recorded_at: nowIso,
            consent_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            consent_evidence_text: '上記書類の内容を確認し、受領したことを連絡します。',
            updated_at: nowIso,
          }).eq('id', documentId);
          if (recErr) {
            await supabase.from('customer_documents').update({ status: 'approved' }).eq('id', documentId);
          }
          setConsentInfo({ recordedAt: nowIso });
          setApplied(true);
          setResultDealId(doc?.dealId || null);
          return;
        }

        // 金額の抽出
        let totalAmount = doc?.dealAmount || 0;
        if (!totalAmount) {
          const matchAmount = (doc?.bodyHtml || '').replace(/&yen;|¥/g, '').match(/(?:合計|総額)[^\d]{0,15}([0-9,]+)\s*円?/);
          if (matchAmount && matchAmount[1]) {
            totalAmount = parseInt(matchAmount[1].replace(/,/g, ''), 10) || 0;
          }
        }

        // 会社IDの解決
        let targetCompanyId = doc?.companyId;
        if (!targetCompanyId) {
          const { data: firstComp } = await supabase.from('companies').select('id').limit(1).maybeSingle();
          targetCompanyId = firstComp?.id || 'COMP-DEFAULT';
        }

        // 既存商談の検索（doc.dealId -> doc.leadId -> targetCompanyId の順で重複作成を防止）
        let resolvedExistingDealId: string | null = doc?.dealId || null;
        if (!resolvedExistingDealId && doc?.leadId) {
          const { data: leadDeal } = await supabase
            .from('deals')
            .select('id')
            .eq('lead_id', doc.leadId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (leadDeal?.id) resolvedExistingDealId = String(leadDeal.id);
        }
        if (!resolvedExistingDealId && targetCompanyId) {
          const { data: compDeal } = await supabase
            .from('deals')
            .select('id')
            .eq('company_id', targetCompanyId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (compDeal?.id) resolvedExistingDealId = String(compDeal.id);
        }

        let resolvedCompanyName = doc?.companyName || '';
        if (!resolvedCompanyName && targetCompanyId) {
          const { data: compRow } = await supabase.from('companies').select('company_name').eq('id', targetCompanyId).maybeSingle();
          resolvedCompanyName = compRow?.company_name || '';
        }

        let resolvedPlanName = resolveWebApplyDealPlanName({
          docTitle: doc?.title,
          bodyHtml: doc?.bodyHtml,
          companyName: resolvedCompanyName,
        });

        if (resolvedExistingDealId) {
          // 既存商談を成約に更新
          appliedDealId = resolvedExistingDealId;
          const { data: curDeal } = await supabase
            .from('deals')
            .select('memo, total_amount, proposal_plan_name')
            .eq('id', appliedDealId)
            .maybeSingle();
          resolvedPlanName = resolveWebApplyDealPlanName({
            existingPlanName: curDeal?.proposal_plan_name,
            docTitle: doc?.title,
            bodyHtml: doc?.bodyHtml,
            companyName: resolvedCompanyName,
          });
          const shouldUpgradePlanName = Boolean(
            resolvedPlanName &&
            (!curDeal?.proposal_plan_name || isGenericDocumentTitle(curDeal?.proposal_plan_name))
          );
          const memo = appendUniqueNote(
            curDeal?.memo,
            `【Web申込】顧客がWeb上で「この内容で申し込む」をタップして即時成約（日時: ${nowIso} / 書類: ${doc?.title || documentId}）`
          );
          await supabase.from('deals').update({
            proposal_status: '成約',
            ...(shouldUpgradePlanName ? { proposal_plan_name: resolvedPlanName } : {}),
            ...(totalAmount > 0 && !curDeal?.total_amount ? { total_amount: totalAmount } : {}),
            ...(doc?.leadId ? { lead_id: doc.leadId } : {}),
            memo,
            updated_at: nowIso,
          }).eq('id', appliedDealId);
        } else {
          // 新規商談を自動起票（「業務委託基本契約書」等の汎用書類タイトルは使わない）
          appliedDealId = `DEAL-WEB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          const { error: insDealErr } = await supabase.from('deals').insert({
            id: appliedDealId,
            company_id: targetCompanyId,
            lead_id: doc?.leadId || null,
            proposal_plan_name: resolvedPlanName,
            proposal_status: '成約',
            proposal_date: todayStr,
            total_amount: totalAmount > 0 ? totalAmount : null,
            memo: `【Web申込自動起票・即時成約】書類「${doc?.title}」（ID: ${doc?.id}）より即時自動起票・成約`,
            created_at: nowIso,
            updated_at: nowIso,
          });
          if (insDealErr) throw insDealErr;
        }

        const consentEvidenceText = '上記の内容（金額、委託範囲、支払条件等）を確認し、本内容での発注および申し込みに同意します。';
        const userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isContractDoc = effectiveType === 'contract';

        // 書類ステータスを approved に更新（電子承諾ログも保存）
        await supabase.from('customer_documents').update({
          status: 'approved',
          deal_id: appliedDealId,
          company_id: targetCompanyId,
          consent_method: 'web_apply',
          consent_recorded_at: nowIso,
          consent_user_agent: userAgentStr,
          consent_evidence_text: consentEvidenceText,
          updated_at: nowIso,
        }).eq('id', documentId);

        // 契約書テーブルに電子合意レコードを記録（契約書の承認時のみ signed、提案書・見積書申込時は draft で契約手続き待ち）
        try {
          const { data: existingContracts } = await supabase
            .from('customer_contracts')
            .select('id, status')
            .or(`document_id.eq.${documentId},deal_id.eq.${appliedDealId}`)
            .order('created_at', { ascending: true })
            .limit(1);
          let existingContract = existingContracts?.[0] || null;
          if (!existingContract && targetCompanyId) {
            const { data: compContracts } = await supabase
              .from('customer_contracts')
              .select('id, status, deal_id, title')
              .eq('company_id', targetCompanyId)
              .in('status', ['draft', 'under_review', 'sent', 'signed', 'active', 'effective', 'in_force'])
              .order('created_at', { ascending: true })
              .limit(10);
            existingContract = (compContracts || []).find((c: any) =>
              !c.deal_id ||
              c.title === `${resolvedPlanName} 契約書` ||
              (doc?.title && String(c.title || '').includes(String(doc.title)))
            ) || null;
          }

          if (existingContract) {
            const nextContractStatus = isContractDoc
              ? 'signed'
              : (['signed', 'active', 'effective', 'in_force'].includes(String(existingContract.status || '').toLowerCase()) ? existingContract.status : 'draft');
            await supabase.from('customer_contracts').update({
              status: nextContractStatus,
              deal_id: appliedDealId,
              ...(isContractDoc ? {
                consent_method: 'web_apply',
                consent_recorded_at: nowIso,
                consent_user_agent: userAgentStr,
                consent_evidence_text: consentEvidenceText,
              } : {}),
              updated_at: nowIso,
            }).eq('id', existingContract.id);
          } else {
            await supabase.from('customer_contracts').insert({
              company_id: targetCompanyId,
              contact_id: (doc as any)?.contact_id || null,
              deal_id: appliedDealId,
              document_id: documentId,
              title: doc?.title ? `${doc.title}${isContractDoc ? '（電子合意）' : '（申込控）'}` : 'Web申込契約合意',
              contract_type: 'service_agreement',
              amount: totalAmount > 0 ? totalAmount : 0,
              status: isContractDoc ? 'signed' : 'draft',
              start_date: todayStr,
              consent_method: 'web_apply',
              consent_recorded_at: nowIso,
              consent_user_agent: userAgentStr,
              consent_evidence_text: consentEvidenceText,
              notes: `【Web申込・電子承諾エビデンス】\n承諾方式: web_apply\n承諾日時: ${nowIso}\n合意文面: ${consentEvidenceText}`,
              created_at: nowIso,
              updated_at: nowIso,
            });
          }
        } catch (contractErr) {
          console.warn('Customer contract fallback consent sync warning:', contractErr);
        }

        // 成約自動化（顧客・請求・顧問構築支援の不足分を自動起票）
        if (appliedDealId) {
          await executeDealWonAutomation(appliedDealId).catch((autoErr) => {
            console.warn('Deal won automation fallback warning:', autoErr);
          });
        }

        setConsentInfo({ recordedAt: nowIso });

        // 顧客マスタに登録（契約書同意なら「契約中」、提案書・見積書申込なら「申込済み」）
        if (targetCompanyId) {
          const { data: existingCust } = await supabase.from('customers').select('id, contract_status').eq('company_id', targetCompanyId).maybeSingle();
          if (!existingCust) {
            await supabase.from('customers').insert({
              company_id: targetCompanyId,
              contract_status: isContractDoc ? '契約中' : '申込済み',
              contract_start_date: todayStr,
              memo: `Web申込（商談ID: ${appliedDealId}）により自動登録`,
              created_at: nowIso,
              last_updated_at: nowIso,
            });
          } else if (isContractDoc && (!existingCust.contract_status || existingCust.contract_status === '申込済み')) {
            await supabase.from('customers').update({
              contract_status: '契約中',
              last_updated_at: nowIso,
            }).eq('id', existingCust.id);
          }
        }

        // リードステータスを成約に更新
        if (doc?.leadId) {
          const { data: leadRow } = await supabase.from('leads').select('status').eq('id', doc.leadId).maybeSingle();
          await supabase.from('leads').update({
            status: resolveNonDowngradingLeadStatus(leadRow?.status, '成約'),
            last_contacted_at: nowIso,
          }).eq('id', doc.leadId);
        }

        // 社内タスク起票
        try {
          await supabase.from('tasks').insert({
            title: `【🎉即時成約】${doc?.companyName || '顧客企業'} 様よりWeb申込・発注を受領しました`,
            description: `書類「${doc?.title}」のWeb申込ボタンより発注が確定し、商談（${appliedDealId}）が即座に「成約」となりました。金額: ${totalAmount > 0 ? totalAmount.toLocaleString('ja-JP') + '円' : '未定'}。初回キックオフや契約締結手続きを進めてください。`,
            status: 'todo',
            priority: 'high',
            due_date: todayStr,
            created_at: nowIso,
          });
        } catch {
          // ignore task error
        }
      }

      setApplied(true);
      setResultDealId(appliedDealId);
      if (doc) {
        setDoc({
          ...doc,
          status: 'approved',
          dealId: appliedDealId || undefined,
          dealStatus: '成約',
        });
      }
    } catch (err: any) {
      setError(err.message || 'お申し込みを完了できませんでした。');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 p-6">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
        <p className="text-sm font-medium">書類情報を確認しています…</p>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">書類を表示できません</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <a
            href="https://corp.mstcorp.info/"
            className="inline-block px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            有限会社MST 公式サイトへ
          </a>
        </div>
      </div>
    );
  }

  const rawDocTypeGlobal = String(doc?.documentType || '');
  const docTitleGlobal = String(doc?.title || '');
  const effectiveDocTypeGlobal =
    (rawDocTypeGlobal === 'proposal' || rawDocTypeGlobal === 'other') && /見積/.test(docTitleGlobal)
      ? 'estimate'
      : (rawDocTypeGlobal === 'diagnosis_report' || rawDocTypeGlobal === 'report' || rawDocTypeGlobal === 'proposal' || rawDocTypeGlobal === 'other') && /(月次|月報)/.test(docTitleGlobal)
        ? 'monthly_report'
        : rawDocTypeGlobal === 'report'
          ? 'diagnosis_report'
          : rawDocTypeGlobal;
  const isReceiptDocGlobal = effectiveDocTypeGlobal === 'invoice' || effectiveDocTypeGlobal === 'monthly_report';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      {/* ヘッダー */}
      <header className="no-print sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-emerald-600/30">
            MST
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">有限会社MST</div>
            <div className="text-[10px] text-slate-400">
              {isReceiptDocGlobal ? '公式Web確認・受領連絡ページ' : '公式Web申込・電子承諾ポータル'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={`/api/public/documents/${encodeURIComponent(documentId)}/pdf?download=1`}
            download
            className="px-3.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 hover:bg-emerald-900/70 text-xs font-semibold text-emerald-200 flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>PDFダウンロード</span>
          </a>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">印刷 / PDF保存</span>
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* 成約/受領完了バナー */}
        {applied && (
          <div className="no-print rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
                    {isReceiptDocGlobal ? '受領連絡完了' : '成約・お申し込み完了'}
                  </span>
                  {resultDealId && !isReceiptDocGlobal && (
                    <span className="text-xs font-mono text-slate-400">
                      商談管理番号: {resultDealId}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {isReceiptDocGlobal ? '内容確認・受領のご連絡ありがとうございます' : 'お申し込み誠にありがとうございます！'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {isReceiptDocGlobal ? (
                    <>
                      本書面の確認・受領連絡が正常に受け付けられました。<br />
                      控えが必要な場合は、上部の「PDFダウンロード」または下記の印刷ボタンより保存してください。
                    </>
                  ) : (
                    <>
                      本提案・見積内容でのお申し込みが正常に受理され、システム上で<strong className="text-emerald-400 font-semibold">「即時成約（受注）」</strong>として確定いたしました。<br />
                      担当責任者（大橋真人）より、初回キックオフおよび今後の進め方について折り返しご連絡差し上げます。
                    </>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 rounded-xl px-3.5 py-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {isReceiptDocGlobal
                      ? `確認・受領記録済（記録日時: ${consentInfo?.recordedAt ? new Date(consentInfo.recordedAt).toLocaleString('ja-JP') : new Date().toLocaleString('ja-JP')}）`
                      : `電子合意エビデンス記録済（承諾日時: ${consentInfo?.recordedAt ? new Date(consentInfo.recordedAt).toLocaleString('ja-JP') : new Date().toLocaleString('ja-JP')} / 方式: Web即時合意・改ざん防止ログ保持）`}
                  </span>
                </div>
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isReceiptDocGlobal ? '確認控えを印刷・PDF保存' : '成約控えを印刷・PDF保存'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 書類カード */}
        <div className="print-area rounded-2xl border border-slate-800 bg-white text-slate-900 shadow-2xl overflow-hidden">
          {/* 書類タイトルバー（Web閲覧時） */}
          <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-800">{doc?.title}</span>
            </div>
            {doc?.companyName && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Building2 className="w-3.5 h-3.5" />
                <span>宛先: <strong>{doc.companyName}</strong> 御中</span>
              </div>
            )}
          </div>

          {/* 書類本文HTML */}
          <div
            className="p-6 sm:p-12 document-body"
            dangerouslySetInnerHTML={{ __html: doc?.bodyHtml || '' }}
          />
        </div>

        {/* Web申込 / 受領連絡CTAセクション */}
        {!applied && (() => {
          const effectiveType = effectiveDocTypeGlobal;
          const isReceiptDoc = isReceiptDocGlobal;
          return (
          <div id="apply-cta-section" className="no-print rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
                    {isReceiptDoc ? '内容確認・受領連絡' : 'ワンタップオンライン発注'}
                  </span>
                  <span className="text-xs text-slate-400">{isReceiptDoc ? '受領連絡システム' : '即時成約システム'}</span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {effectiveType === 'contract'
                    ? '契約内容に同意して申し込む（締結確定）'
                    : isReceiptDoc
                      ? '内容を確認して受領連絡を送る'
                      : 'この内容で申し込む（発注を確定する）'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {isReceiptDoc
                    ? '上記の内容をご確認いただき、必要に応じて上部の「PDFダウンロード」より保存のうえ、下記より受領完了のご連絡をお送りください。'
                    : (
                      <>
                        上記のお見積もり・契約・ご提案内容をご確認いただき、よろしければ下記よりお申し込みください。<br className="hidden sm:inline" />
                        Web上で確定された瞬間に手続きが完了し、担当責任者へ通知されます。
                      </>
                    )}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* 同意/確認チェック */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  {isReceiptDoc
                    ? '上記書類の内容を確認し、受領したことを連絡します。'
                    : '上記の内容（金額、委託範囲、支払条件等）を確認し、本内容での発注および申し込みに同意します。'}
                </span>
              </label>
            </div>

            {/* 申込 / 受領連絡ボタン */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isReceiptDoc ? '有限会社MST セキュア確認システム' : '有限会社MST SSL暗号化セキュア成約システム'}</span>
              </div>

              <button
                type="button"
                disabled={!agreeChecked || submitting}
                onClick={() => setShowConfirmModal(true)}
                className={`px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                  agreeChecked && !submitting
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 hover:scale-[1.01]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isReceiptDoc ? '送信中…' : '成約処理中…'}</span>
                  </>
                ) : (
                  <>
                    <span>{isReceiptDoc ? '内容確認・受領完了を連絡する' : 'この内容で申し込む'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
          );
        })()}
      </main>

      {/* 確認モーダル */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {isReceiptDocGlobal ? '受領連絡の確認' : 'お申し込みの最終確認'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isReceiptDocGlobal ? '内容確認・受領連絡の送信' : '成約の確定手続き'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">書類件名:</span>
                <span className="font-medium text-white text-right">{doc?.title}</span>
              </div>
              {doc?.companyName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">宛先企業:</span>
                  <span className="font-medium text-white">{doc.companyName} 様</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isReceiptDocGlobal
                ? '「受領連絡を送信」を押すと、内容確認・受領完了の記録が保存され担当者へ通知されます。よろしいですか？'
                : '「確定して申し込む」を押すと、即座に商談が起票され成約（受注）として受理されます。よろしいですか？'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecuteApply}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {isReceiptDocGlobal ? '受領連絡を送信' : '確定して申し込む'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <footer className="no-print mt-auto border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} 有限会社MST. All rights reserved.
      </footer>
    </div>
  );
};
