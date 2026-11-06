import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getSalesEmailTemplate, getNurturingStepTemplate } from '../utils/salesOutreachTemplates';
import { Eye, Save, Send, Users, SendHorizonal, FileText, Library, Mail, MessageSquare, Paperclip, X, Inbox } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';
import { LineMessagePreview } from './LineMessagePreview';
import { renderPlaceholders } from '../utils/placeholders';
import { PlaceholderAssist } from './common/PlaceholderAssist';
import { MarketingBroadcastView } from './marketing/MarketingBroadcastView';
import { CommunicationTemplateLibraryView } from './marketing/CommunicationTemplateLibraryView';
const labels = {
    document: '重要書類の送信（見積・契約・請求・レポート）',
    form: 'フォーム案内',
    diagnosis: '診断案内',
    deal: '商談日程案内',
    customer_meeting: '顧客面談日程案内',
    sales_outreach: '見込み企業営業メール（ステップ1〜5）',
    nurturing_story: '大橋ストーリー型ナーチャリング（全7話・LINE/メール）',
    announcement: 'その他の案内',
};
const documentCategory = (doc) => {
    if (!doc || typeof doc !== 'object')
        return 'other';
    if (doc.document_type === 'proposal' && /見積/.test(doc.title || ''))
        return 'estimate';
    if (doc.document_type === 'report')
        return 'diagnosis_report';
    return (['diagnosis_report', 'proposal', 'estimate', 'contract', 'invoice', 'monthly_report'].includes(doc.document_type) ? doc.document_type : 'other');
};
const documentOrder = {
    diagnosis_report: 0,
    proposal: 1,
    estimate: 2,
    contract: 3,
    invoice: 4,
    monthly_report: 5,
    other: 6,
};
const seed = [
    {
        category: 'document',
        channel: 'email',
        subject: '【書類送付】{書類名}｜{会社名} 様',
        body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n下記の書類をご確認ください。\n書類名：{書類名}\n{書類URL}\n\n{書類本文}\n\nご不明点は本メールにご返信ください。\n有限会社MST',
    },
    {
        category: 'document',
        channel: 'line',
        subject: '',
        body_text: '{お名前} 様\n書類「{書類名}」をご確認ください。\n{書類URL}',
    },
    {
        category: 'form',
        channel: 'email',
        subject: '【ご回答のお願い】{フォーム名}｜{会社名} 様',
        body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n「{フォーム名}」へのご回答をお願いいたします。下記URLからご利用いただけます。\n{案内URL}\n\nご不明点は本メールにご返信ください。\n有限会社MST',
    },
    {
        category: 'form',
        channel: 'line',
        subject: '',
        body_text: '{お名前} 様\n「{フォーム名}」へのご回答をお願いいたします。\n{案内URL}',
    },
    {
        category: 'diagnosis',
        channel: 'email',
        subject: '【診断のご案内】{フォーム名}｜{会社名} 様',
        body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n「{フォーム名}」をご案内いたします。下記URLから診断を開始してください。\n{案内URL}\n\nご不明点は本メールにご返信ください。\n有限会社MST',
    },
    {
        category: 'diagnosis',
        channel: 'line',
        subject: '',
        body_text: '{お名前} 様\n「{フォーム名}」をご案内いたします。こちらからご利用ください。\n{案内URL}',
    },
    {
        category: 'deal',
        channel: 'email',
        subject: '【商談日程のご案内】{会社名} 様',
        body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n商談の日程調整についてご案内いたします。下記予約ページから、ご都合のよい日時をお選びください。\n{案内URL}\n\n予約確定後、Googleカレンダーに予定が登録され、Google Meetの情報が案内されます。\nご不明点は本メールにご返信ください。\n有限会社MST',
    },
    {
        category: 'deal',
        channel: 'line',
        subject: '',
        body_text: '{お名前} 様\n商談の日程はこちらからお選びください。\n{案内URL}\n予約確定後、GoogleカレンダーとMeetの情報が案内されます。',
    },
    {
        category: 'customer_meeting',
        channel: 'email',
        subject: '【顧客面談の日程調整】{会社名} 様',
        body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n次回のお打ち合わせ日程をご案内いたします。下記予約ページから、ご都合のよい日時をお選びください。\n{案内URL}\n\n予約確定後、Googleカレンダーに予定が登録され、Google Meetの情報が案内されます。\nご不明点は本メールにご返信ください。\n有限会社MST',
    },
    {
        category: 'customer_meeting',
        channel: 'line',
        subject: '',
        body_text: '{お名前} 様\n次回のお打ち合わせ日程はこちらからご選択ください。\n{案内URL}',
    },
    {
        category: 'announcement',
        channel: 'email',
        subject: '【ご案内】{会社名} 様',
        body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n{案内URL}\n\nご不明点は本メールにご返信ください。\n有限会社MST',
    },
    {
        category: 'announcement',
        channel: 'line',
        subject: '',
        body_text: '{お名前} 様\n{案内URL}',
    },
];
const documentMessage = (type, channel) => {
    const hi = '{お名前} 様';
    const intro = 'お世話になっております。有限会社MSTです。';
    const details = '書類名：{書類名}\n{書類URL}\n{書類本文}';
    const messages = {
        proposal: {
            subject: '【ご提案書の送付】{書類名}｜{会社名} 様',
            body: hi + '\n\n' + intro + '\n\nご提案書をお送りします。内容をご確認いただき、ご不明点やご希望がございましたらお知らせください。\n\n' + details + '\n\n有限会社MST',
            line: hi + '\nご提案書をお送りします。内容をご確認ください。\n{書類名}\n{書類URL}',
        },
        diagnosis_report: {
            subject: '【診断レポートのご送付】{書類名}｜{会社名} 様',
            body: hi + '\n\n' + intro + '\n\n診断結果をまとめたレポートをお送りします。内容をご確認いただき、結果や今後の進め方についてご不明点があればお知らせください。\n\n' + details + '\n\n有限会社MST',
            line: hi + '\n診断レポートをお送りします。結果と今後の進め方をご確認ください。\n{書類名}\n{書類URL}',
        },
        contract: {
            subject: '【契約内容のご確認・同意のお願い】{書類名}｜{会社名} 様',
            body: hi + '\n\n' + intro + '\n\n契約書をお送りします。内容をご確認ください。契約内容に同意いただける場合は、契約締結の権限をお持ちの方から、このメールへの返信で次の文面をお送りください。\n\n「{会社名}を代表して、契約書『{書類名}』の内容を確認し、有限会社MSTとの契約締結に同意します。氏名：［氏名］　役職：［役職］」\n\n内容に修正希望がある場合は、同意文ではなく修正箇所をご返信ください。返信を確認後、契約状態を締結済みに更新します。ご返信いただいたメールと契約書は契約記録として保存します。\n\n' + details + '\n\n有限会社MST',
            line: hi + '\n契約書をお送りします。内容をご確認ください。同意いただける場合は、契約締結の権限をお持ちの方からメールで明示的にご返信ください。\n{書類名}\n{書類URL}',
        },
        estimate: {
            subject: '【お見積書の送付】{書類名}｜{会社名} 様',
            body: hi + '\n\n' + intro + '\n\nお見積書をお送りします。お見積金額・有効期限・ご提案内容をご確認ください。内容の調整やご不明点がございましたらお知らせください。\n\n' + details + '\n\n有限会社MST',
            line: hi + '\nお見積書をお送りします。金額・有効期限・内容をご確認ください。\n{書類名}\n{書類URL}',
        },
        invoice: {
            subject: '【請求書のご送付】{書類名}｜{会社名} 様',
            body: hi + '\n\n' + intro + '\n\n請求書をお送りします。請求金額・お支払期日・振込先などの記載をご確認のうえ、お手続きをお願いいたします。すでにお手続き済みの場合はご容赦ください。\n\n' + details + '\n\n有限会社MST',
            line: hi + '\n請求書をお送りします。金額・お支払期日・振込先をご確認ください。\n{書類名}\n{書類URL}',
        },
    };
    const message = messages[type || ''] || {
        subject: '【書類のご送付】{書類名}｜{会社名} 様',
        body: hi + '\n\n' + intro + '\n\n書類をお送りします。内容をご確認ください。ご不明点がございましたらお知らせください。\n\n' + details + '\n\n有限会社MST',
        line: hi + '\n書類をお送りします。内容をご確認ください。\n{書類名}\n{書類URL}',
    };
    return channel === 'email' ? { category: 'document', channel, subject: message.subject, body_text: message.body } : { category: 'document', channel, subject: '', body_text: message.line };
};
const contractReplySection = '【メール返信による契約合意】\n契約内容に同意いただける場合は、契約締結の権限をお持ちの方から、このメールへの返信で次の文面をお送りください。\n\n「{会社名}を代表して、契約書『{書類名}』の内容を確認し、有限会社MSTとの契約締結に同意します。氏名：［氏名］　役職：［役職］」\n\n内容に修正希望がある場合は、同意文ではなく修正箇所をご返信ください。返信を確認後、契約状態を締結済みに更新します。ご返信いただいたメールと契約書は契約記録として保存してください。';
const ensureContractReplySection = (body) => body.includes('【メール返信による契約合意】') ? body : body.trimEnd() + '\n\n' + contractReplySection;
const fill = (s, v) => renderPlaceholders(s, v);
const htmlToText = (html) => {
    const withBreaks = html.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<\/td>/gi, '  ');
    return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent?.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || '';
};
export const CommunicationSendCenter = ({ initialKind = 'announcement', initialCompanyId, initialDocumentId, initialFormId, initialDealId, initialContactId, initialMode = 'send', initialBroadcastChannel = 'email', onNavigateTab, }) => {
    const [screen, setScreen] = useState(initialMode);
    const [kind, setKind] = useState(initialKind);
    const [channel, setChannel] = useState('email');
    const [templateChannel, setTemplateChannel] = useState('email');
    const [documentType, setDocumentType] = useState('all');
    const [contacts, setContacts] = useState([]);
    const [docs, setDocs] = useState([]);
    const [forms, setForms] = useState([]);
    const [bookingUrl, setBookingUrl] = useState('');
    const [companies, setCompanies] = useState({});
    const [companyIndustries, setCompanyIndustries] = useState({});
    const [salesStep, setSalesStep] = useState(1);
    const [nurturingStep, setNurturingStep] = useState(1);
    const [contactId, setContactId] = useState(initialContactId || '');
    const [docId, setDocId] = useState(initialDocumentId || '');
    const [formId, setFormId] = useState(initialFormId || '');
    const [url, setUrl] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [templates, setTemplates] = useState(seed);
    const [emailTemplates, setEmailTemplates] = useState([]);
    const [lineTemplates, setLineTemplates] = useState([]);
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState('');
    const [selectedLineTemplateId, setSelectedLineTemplateId] = useState('');
    const [basis, setBasis] = useState('顧客からの依頼・業務連絡');
    const [preview, setPreview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [templateDocumentType, setTemplateDocumentType] = useState('contract');
    const [senderSettings, setSenderSettings] = useState({
        fromName: '有限会社MST｜経営・業務改善支援',
        fromEmail: 'contact@mstcorp.info',
        replyTo: 'mst.shikumikaizen@gmail.com',
    });
    const [savingSenderSettings, setSavingSenderSettings] = useState(false);
    const db = getSupabase();
    const contact = contacts.find((x) => x.id === contactId);
    const doc = docs.find((x) => x.id === docId);
    const form = forms.find((x) => x.id === formId);
    const activeDocumentType = screen === 'templates' ? templateDocumentType : doc ? documentCategory(doc) : 'other';
    const templateKeyFor = (deliveryChannel) => (kind === 'form' || kind === 'diagnosis') && form
        ? `${kind}_${form.id}_${deliveryChannel}`
        : kind === 'document' && screen === 'templates'
            ? `document_${templateDocumentType}_${deliveryChannel}`
            : kind === 'document' && doc
                ? `document_${doc.id}_${deliveryChannel}`
                : `${kind}_${deliveryChannel}`;
    const templateKey = templateKeyFor(templateChannel);
    const resolveTemplate = (deliveryChannel) => {
        const key = templateKeyFor(deliveryChannel);
        const savedForItem = [...templates].reverse().find((x) => x.template_key === key);
        if (savedForItem)
            return savedForItem;
        if (kind === 'document') {
            const savedByType = [...templates].reverse().find((x) => x.template_key === 'document_' + activeDocumentType + '_' + deliveryChannel);
            if (savedByType)
                return savedByType;
            const savedGeneric = [...templates].reverse().find((x) => x.template_key === 'document_' + deliveryChannel);
            if (savedGeneric)
                return savedGeneric;
            return documentMessage(activeDocumentType, deliveryChannel);
        }
        return [...templates].reverse().find((x) => x.template_key === kind + '_' + deliveryChannel || (x.category === kind && x.channel === deliveryChannel)) || seed.find((x) => x.category === kind && x.channel === deliveryChannel);
    };
    const tmpl = resolveTemplate(templateChannel);
    const selectedEmailTemplate = emailTemplates.find((x) => x.id === selectedEmailTemplateId);
    const selectedLineTemplate = lineTemplates.find((x) => x.id === selectedLineTemplateId);
    const fillPayload = (value) => Array.isArray(value)
        ? value.map(fillPayload)
        : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'storagePaths').map(([key, item]) => [key, fillPayload(item)]))
            : typeof value === 'string'
                ? fill(value, vals)
                : value;
    const chooseEmailTemplate = (id) => {
        setSelectedEmailTemplateId(id);
        const item = emailTemplates.find((x) => x.id === id);
        if (item) {
            setSubject(item.subject || '');
            setBody(item.body_text || '');
        }
        else if (tmpl) {
            setSubject(tmpl.subject || '');
            setBody(tmpl.body_text || '');
        }
    };
    const chooseLineTemplate = (id) => {
        setSelectedLineTemplateId(id);
        const item = lineTemplates.find((x) => x.id === id);
        if (!item)
            return;
        const payload = item.payload || {};
        setBody(item.reply_type === 'text' ? String(payload.text || '') : '');
    };
    const currentLinkUrl = (kind === 'form' || kind === 'diagnosis') && form
        ? window.location.origin + '/f/' + encodeURIComponent(form.public_slug) + (contact ? `?cid=${encodeURIComponent(contact.id)}` + (contact.line_user_id ? `&luid=${encodeURIComponent(contact.line_user_id)}` : '') : '')
        : kind === 'deal' || kind === 'customer_meeting'
            ? url.trim() || bookingUrl
            : url.trim();
    const vals = {
        お名前: contact?.full_name || 'ご担当者',
        会社名: companies[contact?.company_id || ''] || '貴社',
        フォーム名: form?.name || 'フォーム',
        書類名: doc?.title || '書類',
        書類URL: url.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''),
        書類本文: doc ? htmlToText(doc.body_html || '') : '',
        面談予約URL: bookingUrl || '',
        案内URL: currentLinkUrl,
        // 英語キー互換
        recipient_name: contact?.full_name || 'ご担当者',
        name: contact?.full_name || 'ご担当者',
        company_name: companies[contact?.company_id || ''] || '貴社',
        form_title: form?.name || 'フォーム',
        document_title: doc?.title || '書類',
        document_url: url.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''),
        document_content: doc ? htmlToText(doc.body_html || '') : '',
        booking_url: bookingUrl || '',
        link_url: currentLinkUrl,
    };
    const selectedCompanyId = contact?.company_id || initialCompanyId;
    const availableDocs = docs
        .filter((x) => (!selectedCompanyId || x.company_id === selectedCompanyId || x.id === docId || x.id === initialDocumentId) && (documentType === 'all' || documentCategory(x) === documentType || x.id === docId || x.id === initialDocumentId))
        .sort((a, b) => documentOrder[documentCategory(a)] - documentOrder[documentCategory(b)]);
    useEffect(() => {
        if (docId && docs.length > 0 && !availableDocs.some((x) => x.id === docId)) {
            setDocId('');
        }
    }, [docId, contact?.company_id, initialCompanyId, docs, documentType]);
    useEffect(() => {
        if (initialDocumentId) {
            setDocId(initialDocumentId);
            setKind('document');
        }
    }, [initialDocumentId]);
    useEffect(() => {
        let ok = true;
        if (!db)
            return;
        Promise.all([
            db.from('contacts').select('id,full_name,email,line_user_id,company_id').order('full_name'),
            db.from('customer_documents').select('id,title,status,document_type,company_id,contact_id,body_html').order('created_at', { ascending: false }).limit(1000),
            db.from('communication_templates').select('*'),
            db.from('companies').select('id,company_name,industry'),
            db.from('diagnosis_forms').select('id,name,public_slug,form_type,status').eq('status', 'published').order('created_at', { ascending: false }),
            db.from('sales_workspace_settings').select('booking_page_url').maybeSingle(),
            db.from('email_send_settings').select('sender_name,sender_email,reply_to_email').maybeSingle(),
            db.from('line_auto_reply_templates').select('*').order('created_at', { ascending: false }),
        ])
            .then(([c, d, t, co, f, settings, emailSettings, lineTemplateResult]) => {
            if (!ok)
                return;
            if (c.error)
                throw c.error;
            if (d.error)
                throw d.error;
            if (f.error)
                throw f.error;
            if (settings.error)
                throw settings.error;
            if (emailSettings.error)
                throw emailSettings.error;
            setForms(f.data || []);
            setBookingUrl(settings.data?.booking_page_url || '');
            setSenderSettings({
                fromName: emailSettings.data?.sender_name || '有限会社MST｜経営・業務改善支援',
                fromEmail: emailSettings.data?.sender_email || 'contact@mstcorp.info',
                replyTo: emailSettings.data?.reply_to_email || 'mst.shikumikaizen@gmail.com',
            });
            if (!co.error) {
                setCompanies(Object.fromEntries((co.data || []).map((x) => [x.id, x.company_name])));
                setCompanyIndustries(Object.fromEntries((co.data || []).map((x) => [x.id, x.industry || ''])));
            }
            setContacts((c.data || []).filter((x) => !initialCompanyId || x.company_id === initialCompanyId));
            setDocs((d.data || []).filter((x) => !initialCompanyId || x.company_id === initialCompanyId || x.id === initialDocumentId));
            if (initialFormId)
                setFormId(initialFormId);
            if (initialContactId)
                setContactId(initialContactId);
            if (initialDocumentId) {
                setDocId(initialDocumentId);
                setKind('document');
                const targetDoc = (d.data || []).find((x) => x.id === initialDocumentId);
                if (targetDoc) {
                    if (targetDoc.contact_id && !initialContactId) {
                        setContactId(targetDoc.contact_id);
                    }
                    else if (targetDoc.company_id && !initialContactId) {
                        const matchingContact = (c.data || []).find((ct) => ct.company_id === targetDoc.company_id);
                        if (matchingContact)
                            setContactId(matchingContact.id);
                    }
                }
            }
            if (!t.error) {
                setEmailTemplates((t.data || []));
                if (t.data?.length)
                    setTemplates([...seed.filter((x) => !t.data.some((row) => row.template_key === x.category + '_' + x.channel)), ...t.data]);
            }
            if (!lineTemplateResult.error)
                setLineTemplates((lineTemplateResult.data || []));
        })
            .catch((e) => ok && setError(e.message || '読み込みに失敗しました。'));
        return () => {
            ok = false;
        };
    }, [initialCompanyId, initialFormId, initialContactId, initialDocumentId]);
    useEffect(() => {
        if (tmpl) {
            setSubject(tmpl.subject || '');
            const templateBody = tmpl.body_text || '';
            if (templateChannel === 'email' && selectedEmailTemplate) {
                setSubject(selectedEmailTemplate.subject || '');
                setBody(selectedEmailTemplate.body_text || '');
                return;
            }
            if (templateChannel === 'line' && selectedLineTemplate) {
                setBody(selectedLineTemplate.reply_type === 'text' ? String(selectedLineTemplate.payload?.text || '') : '');
                return;
            }
            setSubject(tmpl.subject || '');
            setBody(kind === 'document' && activeDocumentType === 'contract' && templateChannel === 'email' ? ensureContractReplySection(templateBody) : templateBody);
        }
    }, [kind, channel, templateKey, templates, doc?.id, templateChannel]);
    const applySalesStep = (stepNum, c = contact) => {
        const compName = c?.company_id ? companies[c.company_id] || '貴社' : '貴社';
        const compInd = c?.company_id ? companyIndustries[c.company_id] || '' : '';
        const diagForm = forms.find((f) => f.form_type === 'diagnosis') || forms[0];
        const diagUrl = diagForm ? `${window.location.origin}/f/${encodeURIComponent(diagForm.public_slug)}${c ? `?cid=${encodeURIComponent(c.id)}` : ''}` : bookingUrl || url.trim();
        const outreach = getSalesEmailTemplate(stepNum, compName, c?.full_name, compInd, diagUrl);
        setSubject(outreach.subject);
        setBody(outreach.body);
        setBasis('特定電子メール法に基づく業務改善情報の提供（オプトアウト明記）');
    };
    useEffect(() => {
        if (kind === 'sales_outreach') {
            applySalesStep(salesStep, contact);
        }
    }, [kind, salesStep, contact?.id, contact?.company_id]);
    const applyNurturingStep = (stepNum, c = contact, ch = channel) => {
        const compName = c?.company_id ? companies[c.company_id] || '貴社' : '貴社';
        const diagForm = forms.find((f) => f.form_type === 'diagnosis') || forms[0];
        const diagUrl = diagForm ? `${window.location.origin}/f/${encodeURIComponent(diagForm.public_slug)}${c ? `?cid=${encodeURIComponent(c.id)}` : ''}` : bookingUrl || url.trim();
        const tpl = getNurturingStepTemplate(stepNum, c?.full_name || '様', compName, diagUrl);
        setSubject(tpl.emailSubject);
        setBody(ch === 'line' ? tpl.lineBody : tpl.emailBody);
        setBasis('配信同意に基づくストーリー型教育メッセージ');
    };
    useEffect(() => {
        if (kind === 'nurturing_story') {
            applyNurturingStep(nurturingStep, contact, channel);
        }
    }, [kind, nurturingStep, channel, contact?.id, contact?.company_id]);
    useEffect(() => {
        if ((kind === 'form' || kind === 'diagnosis') && form) {
            const tracking = contact ? `?cid=${encodeURIComponent(contact.id)}` + (contact.line_user_id ? `&luid=${encodeURIComponent(contact.line_user_id)}` : '') : '';
            setUrl(window.location.origin + '/f/' + encodeURIComponent(form.public_slug) + tracking);
        }
        else if (kind === 'document' && doc) {
            setUrl(window.location.origin + '/docs/' + encodeURIComponent(doc.id));
        }
    }, [kind, formId, form?.public_slug, contact?.id, contact?.line_user_id, docId, doc?.id]);
    const save = async () => {
        if (!db)
            return;
        const { data } = await db.auth.getUser();
        if (!data.user) {
            setError('ログインしてください。');
            return;
        }
        const row = { owner_id: data.user.id, template_key: templateKey, category: kind, channel: templateChannel, subject, body_text: body };
        const { data: saved, error: e } = await db.from('communication_templates').upsert(row, { onConflict: 'owner_id,template_key' }).select('*').single();
        if (e)
            setError(e.message);
        else {
            const savedRow = saved || row;
            setTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
            setEmailTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
            setNotice('テンプレートを保存しました。');
        }
    };
    const saveSenderSettings = async () => {
        if (!db)
            return;
        const { data, error: authError } = await db.auth.getUser();
        if (authError) {
            setError(authError.message);
            return;
        }
        if (!data.user) {
            setError('ログインしてください。');
            return;
        }
        const senderName = senderSettings.fromName.trim();
        const senderEmail = senderSettings.fromEmail.trim().toLowerCase();
        const replyTo = senderSettings.replyTo.trim().toLowerCase();
        const emailPattern = /^\S+@\S+\.\S+$/;
        if (!senderName || senderName.length > 100 || /[\r\n<>]/.test(senderName) || !emailPattern.test(senderEmail) || (replyTo && !emailPattern.test(replyTo))) {
            setError('差出人名・差出人メールアドレス・返信先の入力を確認してください。');
            return;
        }
        setSavingSenderSettings(true);
        setError('');
        setNotice('');
        try {
            const { error: e } = await db.from('email_send_settings').upsert({ owner_id: data.user.id, sender_name: senderName, sender_email: senderEmail, reply_to_email: replyTo || null, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
            if (e)
                throw e;
            setSenderSettings({ fromName: senderName, fromEmail: senderEmail, replyTo });
            setNotice('メール送信の既定値を保存しました。全端末で共通して使われます。');
        }
        catch (e) {
            setError(e?.message || 'メール送信設定を保存できませんでした。');
        }
        finally {
            setSavingSenderSettings(false);
        }
    };
    const send = async () => {
        if (!db || !contact)
            return;
        setError('');
        const targets = channel === 'both' ? ['email', 'line'] : [channel];
        if (targets.includes('email') && (!senderSettings.fromName.trim() || !senderSettings.fromEmail.trim())) {
            setError('送信時の差出人設定を入力して保存してください。');
            return;
        }
        const hasDocUrl = Boolean(url.trim() || vals.document_url?.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''));
        if (!basis.trim() ||
            (kind === 'document' && (!doc || !hasDocUrl)) ||
            (kind !== 'document' && kind !== 'announcement' && !vals.link_url.trim()) ||
            (targets.includes('email') && !contact.email) ||
            (targets.includes('line') && !contact.line_user_id)) {
            setError('送信先、メール・LINEの登録状況、必要な書類またはURLを確認してください。');
            return;
        }
        if (initialCompanyId && contact.company_id && contact.company_id !== initialCompanyId) {
            setError('会社に紐づく連絡先を選択してください。');
            return;
        }
        setBusy(true);
        try {
            if (doc && doc.status !== 'approved') {
                await db.from('customer_documents').update({ status: 'approved' }).eq('id', doc.id);
                doc.status = 'approved';
            }
            const { data: sessionData } = await db.auth.getSession();
            if (!sessionData.session?.access_token)
                throw Error('ログイン状態を確認できません。');
            if (targets.includes('line')) {
                const { data: friend, error: friendError } = await db.from('line_friends').select('status,consent_status').eq('line_user_id', contact.line_user_id).maybeSingle();
                if (friendError)
                    throw friendError;
                if (!friend || friend.status !== 'active' || friend.consent_status !== 'opted_in')
                    throw Error('LINEの友だち状態と配信同意を確認できません。');
            }
            const rows = targets.map((target) => {
                const targetTemplate = target === 'email' && selectedEmailTemplate ? selectedEmailTemplate : resolveTemplate(target);
                const targetSubject = target === templateChannel ? subject : targetTemplate?.subject || '';
                const rawTargetBody = target === templateChannel ? body : targetTemplate?.body_text || '';
                const targetBody = kind === 'document' && activeDocumentType === 'contract' && target === 'email' ? ensureContractReplySection(rawTargetBody) : rawTargetBody;
                const targetLineTemplate = target === 'line' ? selectedLineTemplate : null;
                const linePayload = targetLineTemplate && targetLineTemplate.reply_type !== 'text' ? { type: targetLineTemplate.reply_type, ...fillPayload(targetLineTemplate.payload || {}) } : null;
                const finalBody = targetLineTemplate?.reply_type === 'text' ? String(targetLineTemplate.payload?.text || '') : linePayload ? `[${targetLineTemplate.reply_type === 'image' ? '画像' : targetLineTemplate.reply_type === 'video' ? '動画' : 'Flex'}メッセージ]` : targetBody;
                return {
                    channel: target,
                    recipient_contact_id: contact.id,
                    recipient_address: target === 'email' ? contact.email : contact.line_user_id,
                    subject: target === 'email' ? fill(targetSubject, vals) : null,
                    body_text: fill(finalBody, vals),
                    line_message_payload: linePayload,
                    document_id: doc?.id || null,
                    company_id: contact.company_id || null,
                    deal_id: initialDealId || null,
                    source_type: kind === 'document' ? 'customer_document' : kind === 'deal' ? 'deal_invitation' : kind === 'customer_meeting' ? 'customer_meeting_invitation' : kind + '_announcement',
                    status: 'queued',
                    consent_confirmed_at: new Date().toISOString(),
                    consent_basis: basis,
                };
            });
            const { data: outboxRows, error: insertError } = await db.from('communication_outbox').insert(rows).select('id,channel');
            if (insertError)
                throw insertError;
            const outcomes = await Promise.all((outboxRows || []).map(async (row) => {
                const response = await fetch('/api/communications/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session.access_token },
                    body: JSON.stringify({ outboxId: row.id }),
                });
                const result = await response.json().catch(() => ({}));
                return { channel: row.channel, ok: response.ok && result.status === 'sent', message: result.error || '' };
            }));
            const summary = outcomes
                .map((x) => (x.channel === 'email' ? 'メール' : 'LINE'))
                .map((label, i) => {
                const outcome = outcomes[i];
                return label + (outcome.ok ? '送信済み' : '失敗') + (outcome.message ? '（' + outcome.message + '）' : '');
            })
                .join(' / ');
            setNotice(summary);
            setPreview(false);
        }
        catch (e) {
            setError(e.message || '送信に失敗しました。');
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2", children: [_jsx("h1", { className: "text-[19px] font-bold text-slate-800 tracking-tight", children: "\u9001\u4FE1\u30BB\u30F3\u30BF\u30FC" }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [_jsxs("button", { type: "button", onClick: () => {
                                    setScreen('send');
                                    setPreview(false);
                                    setError('');
                                }, "aria-pressed": screen === 'send', className: `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${screen === 'send'
                                    ? 'bg-purple-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`, children: [_jsx(SendHorizonal, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u500B\u5225\u9001\u4FE1\uFF081\u5BFE1\uFF09" })] }), _jsxs("button", { type: "button", onClick: () => {
                                    setScreen('broadcast');
                                    setPreview(false);
                                    setError('');
                                }, "aria-pressed": screen === 'broadcast', className: `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${screen === 'broadcast'
                                    ? 'bg-purple-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`, children: [_jsx(Users, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u4E00\u6589\u914D\u4FE1\uFF081\u5BFEN\uFF09" })] }), _jsxs("button", { type: "button", onClick: () => {
                                    setScreen('templates');
                                    setPreview(false);
                                    setError('');
                                }, "aria-pressed": screen === 'templates', className: `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${screen === 'templates'
                                    ? 'bg-purple-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`, children: [_jsx(Library, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u5B9A\u578B\u6587\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8" })] }), onNavigateTab && (_jsxs("div", { className: "flex items-center gap-1.5 sm:ml-2 sm:pl-2 sm:border-l border-slate-200", children: [_jsxs("button", { type: "button", onClick: () => onNavigateTab('inbox_hub'), className: "flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer", title: "\u53D7\u4FE1\u30C8\u30EC\u30A4\u3092\u958B\u304F", children: [_jsx(Inbox, { className: "h-3.5 w-3.5 text-purple-600" }), _jsx("span", { children: "\u53D7\u4FE1\u30C8\u30EC\u30A4" })] }), _jsxs("button", { type: "button", onClick: () => onNavigateTab('document_templates'), className: "flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer", title: "\u63D0\u6848\u66F8\u30FB\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8\u30FB\u898B\u7A4D\u66F8\u4F5C\u6210\u3092\u958B\u304F", children: [_jsx(FileText, { className: "h-3.5 w-3.5 text-purple-600" }), _jsx("span", { children: "\u66F8\u985E\u4F5C\u6210" })] })] }))] })] }), error && _jsx("p", { role: "alert", className: "rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs", children: error }), notice && _jsx("p", { role: "status", className: "rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-800 shadow-2xs", children: notice }), screen === 'broadcast' && (_jsx(MarketingBroadcastView, { initialChannel: initialBroadcastChannel })), screen === 'send' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u9001\u4FE1\u5185\u5BB9", _jsx("select", { value: kind, onChange: (e) => setKind(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: Object.entries(labels).map(([k, v]) => (_jsx("option", { value: k, children: v }, k))) })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u9001\u4FE1\u65B9\u6CD5", _jsxs("select", { value: channel, onChange: (e) => {
                                            const next = e.target.value;
                                            setChannel(next);
                                            if (next !== 'both')
                                                setTemplateChannel(next);
                                        }, className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "email", children: "\u30E1\u30FC\u30EB" }), _jsx("option", { value: "line", children: "LINE" }), _jsx("option", { value: "both", children: "\u30E1\u30FC\u30EB \uFF0B LINE\uFF08\u540C\u6642\u9001\u4FE1\uFF09" })] })] }), _jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: ["\u9001\u4FE1\u5148", _jsxs("select", { value: contactId, onChange: (e) => setContactId(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u9023\u7D61\u5148\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044" }), contacts.map((x) => (_jsxs("option", { value: x.id, children: [x.full_name, " \u00B7 ", companies[x.company_id || ''] || '未設定', " \u00B7", ' ', channel === 'both'
                                                        ? `${x.email ? 'メールあり' : 'メール未登録'} · ${x.line_user_id ? 'LINE連携' : 'LINE未連携'}`
                                                        : channel === 'email'
                                                            ? x.email || 'メール未登録'
                                                            : x.line_user_id
                                                                ? 'LINE連携'
                                                                : 'LINE未連携'] }, x.id)))] })] }), kind === 'nurturing_story' && (_jsxs("div", { className: "md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5", children: [_jsxs("label", { className: "block text-xs font-bold text-purple-900", children: ["\u30B9\u30C8\u30FC\u30EA\u30FC\u578B\u30CA\u30FC\u30C1\u30E3\u30EA\u30F3\u30B0\u8A71\u6570\uFF08", channel === 'line' ? 'LINE形式' : 'メルマガ/メール形式', "\uFF09", _jsxs("select", { value: nurturingStep, onChange: (e) => {
                                                    const s = Number(e.target.value) || 1;
                                                    setNurturingStep(s);
                                                    applyNurturingStep(s, contact, channel);
                                                }, className: "mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600", children: [_jsx("option", { value: 1, children: "\u7B2C1\u8A71\uFF1A\u5927\u6A4B\u306E\u539F\u4F53\u9A13\u30FBFC\u672C\u90E8\u7A81\u7136\u5012\u7523\u306E\u5371\u6A5F" }), _jsx("option", { value: 2, children: "\u7B2C2\u8A71\uFF1A\u6700\u521D\u306B\u5FB9\u5E95\u3057\u3066\u4ED5\u7D44\u307F\u5316\u3057\u305F2\u5927\u696D\u52D9\uFF08\u7BA1\u7406\uFF06\u96C6\u5BA2\uFF09" }), _jsx("option", { value: 3, children: "\u7B2C3\u8A71\uFF1A\u300C\u4F55\u304B\u3089\u624B\u3092\u3064\u3051\u308C\u3070\u3044\u3044\u304B\u308F\u304B\u3089\u306A\u3044\u300D\u7D4C\u55B6\u8005\u69D8\u3078" }), _jsx("option", { value: 4, children: "\u7B2C4\u8A71\uFF1A\u6D41\u884C\u308A\u306E\u30C4\u30FC\u30EB\u3092\u5165\u308C\u3066\u3082\u5931\u6557\u3059\u308B\u4F1A\u793E\u3001\u696D\u52D9\u304C\u6FC0\u5909\u3059\u308B\u4F1A\u793E" }), _jsx("option", { value: 5, children: "\u7B2C5\u8A71\uFF1A\u300C\u4EBA\u3092\u7121\u7406\u306B\u5897\u3084\u3055\u305A\u3001\u5229\u76CA\u304C\u3057\u3063\u304B\u308A\u6B8B\u308B\u4F1A\u793E\u300D\u306E\u5171\u901A\u70B9" }), _jsx("option", { value: 6, children: "\u7B2C6\u8A71\uFF1A\u79C1\u306F\u300C\u30B7\u30B9\u30C6\u30E0\u5C4B\u300D\u3067\u3082\u300C\u30B3\u30F3\u30B5\u30EB\u30BF\u30F3\u30C8\u300D\u3067\u3082\u3042\u308A\u307E\u305B\u3093" }), _jsx("option", { value: 7, children: "\u7B2C7\u8A71\uFF1A\u3010\u6700\u7D42\u8A71\u3011\u81EA\u5206\u304C\u3044\u306A\u3044\u3068\u73FE\u5834\u304C\u56DE\u3089\u306A\u3044\u72B6\u614B\u304B\u3089\u3001\u8131\u5374\u3059\u308B\u30C1\u30E3\u30F3\u30B9" })] })] }), _jsx("p", { className: "text-[11px] text-purple-800", children: "\u203B \u9001\u4FE1\u65B9\u6CD5\uFF08\u30E1\u30FC\u30EB\uFF0FLINE\uFF09\u306B\u5FDC\u3058\u3066\u3001\u6700\u9069\u306A\u30EC\u30A4\u30A2\u30A6\u30C8\uFF08\u30E1\u30EB\u30DE\u30AC\u4EF6\u540D\u30FB\u672C\u6587 \u307E\u305F\u306F LINE\u5411\u3051\u30C6\u30AD\u30B9\u30C8\uFF09\u304C\u81EA\u52D5\u5C55\u958B\u3055\u308C\u307E\u3059\u3002" })] })), kind === 'sales_outreach' && (_jsxs("div", { className: "md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5", children: [_jsxs("label", { className: "block text-xs font-bold text-purple-900", children: ["\u55B6\u696D\u30E1\u30FC\u30EB\u30B9\u30C6\u30C3\u30D7\uFF08", contact?.company_id ? (companies[contact.company_id] || '選択中') + (' · 業種: ' + (companyIndustries[contact.company_id] || '一般・未設定')) : '送信先を選ぶと業種別メッセージが自動挿入', "\uFF09", _jsxs("select", { value: salesStep, onChange: (e) => {
                                                    const s = Number(e.target.value) || 1;
                                                    setSalesStep(s);
                                                    applySalesStep(s);
                                                }, className: "mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600", children: [_jsx("option", { value: 1, children: "\u7B2C1\u901A\uFF1A\u696D\u754C\u6025\u6240\u306E\u63D0\u8D77 \uFF06 3\u5206\u7121\u6599\u8A3A\u65AD\u30AE\u30D5\u30C8\uFF08\u8FD4\u4FE1\u4E0D\u8981\uFF09" }), _jsx("option", { value: 2, children: "\u7B2C2\u901A\uFF1A\u4EBA\u624B\u4E0D\u8DB3\u3067\u306F\u306A\u304F\u300C\u4ED5\u7D44\u307F\u4E0D\u8DB3\u300D\u306E\u771F\u5B9F" }), _jsx("option", { value: 3, children: "\u7B2C3\u901A\uFF1A\u5177\u4F53\u7684\u30D3\u30D5\u30A9\u30FC\u30A2\u30D5\u30BF\u30FC\uFF08\u670825\u6642\u9593\u524A\u6E1B\u306E\u8ECC\u8DE1\uFF09" }), _jsx("option", { value: 4, children: "\u7B2C4\u901A\uFF1A\u8A3A\u65AD\u901F\u5831\u5224\u5B9A\uFF08\u30C1\u30E9\u898B\u305B\uFF09\u306E\u5F37\u3044\u52D5\u6A5F\u3065\u3051" }), _jsx("option", { value: 5, children: "\u7B2C5\u901A\uFF1A\u3010\u6700\u7D42\u6848\u5185\u3011\u73FE\u5834\u306E\u706B\u6D88\u3057\u304B\u3089\u89E3\u653E\u3055\u308C\u5229\u76CA\u304C\u6B8B\u308B\u4F1A\u793E\u3078" })] })] }), _jsx("p", { className: "text-[11px] text-purple-800", children: "\u203B \u9078\u629E\u3057\u305F\u4F1A\u793E\u306E\u696D\u7A2E\u306B\u5FDC\u3058\u305F\u8AB2\u984C\u30FB\u30E1\u30EA\u30C3\u30C8\u3092\u81EA\u52D5\u633F\u5165\u3057\u307E\u3059\u3002" })] })), (kind === 'form' || kind === 'diagnosis') && (_jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: ["\u516C\u958B\u30D5\u30A9\u30FC\u30E0", _jsxs("select", { value: formId, onChange: (e) => {
                                            setFormId(e.target.value);
                                            const f = forms.find((x) => x.id === e.target.value);
                                            if (f)
                                                setUrl(window.location.origin + '/f/' + encodeURIComponent(f.public_slug));
                                        }, className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u516C\u958B\u30D5\u30A9\u30FC\u30E0\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044" }), forms.map((f) => (_jsxs("option", { value: f.id, children: [f.name, " \u00B7 ", f.form_type] }, f.id)))] })] })), kind === 'document' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: ["\u66F8\u985E\u306E\u7A2E\u985E", _jsxs("select", { value: documentType, onChange: (e) => setDocumentType(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "all", children: "\u3059\u3079\u3066\u306E\u66F8\u985E\uFF08\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8\u2192\u63D0\u6848\u66F8\u2192\u898B\u7A4D\u66F8\u2192\u5951\u7D04\u66F8\u2192\u8ACB\u6C42\u66F8\uFF09" }), _jsx("option", { value: "diagnosis_report", children: "\u8A3A\u65AD\u30EC\u30DD\u30FC\u30C8" }), _jsx("option", { value: "proposal", children: "\u63D0\u6848\u66F8" }), _jsx("option", { value: "estimate", children: "\u898B\u7A4D\u66F8" }), _jsx("option", { value: "contract", children: "\u5951\u7D04\u66F8" }), _jsx("option", { value: "invoice", children: "\u8ACB\u6C42\u66F8" }), _jsx("option", { value: "monthly_report", children: "\u6708\u6B21\u5831\u544A\u66F8" }), _jsx("option", { value: "other", children: "\u305D\u306E\u4ED6" })] })] }), _jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: ["\u66F8\u985E\uFF08", contact?.company_id ? (companies[contact.company_id] || '選択した会社') + 'の書類' : initialCompanyId ? (companies[initialCompanyId] || 'この会社') + 'の書類' : '送信先を選ぶと会社の書類で絞り込み', "\u30FB\u627F\u8A8D\u6E08\u307F\u306E\u307F\u9001\u4FE1\u53EF\u80FD\uFF09", _jsxs("select", { value: docId, onChange: (e) => setDocId(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsx("option", { value: "", children: "\u66F8\u985E\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044" }), availableDocs.map((x) => (_jsxs("option", { value: x.id, children: [x.title, " \u00B7 ", { draft: '下書き', awaiting_approval: '確認待ち', approved: '承認済み', queued: '送信待ち', sent: '送信済み', failed: '送信失敗', archived: 'アーカイブ' }[x.status] || x.status] }, x.id)))] })] })] })), _jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: [kind === 'document' ? '共有可能な書類URL' : kind === 'deal' || kind === 'customer_meeting' ? 'この案内専用URL（空欄なら共通予約URL）' : 'フォーム・案内URL', _jsx("input", { value: url, onChange: (e) => setUrl(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", placeholder: "https://..." })] }), (channel === 'email' || channel === 'both') && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: ["\u5DEE\u51FA\u4EBA\u540D", _jsx("input", { value: senderSettings.fromName, onChange: (e) => setSenderSettings((x) => ({ ...x, fromName: e.target.value })), maxLength: 100, className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", placeholder: "\u6709\u9650\u4F1A\u793EMST" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u5DEE\u51FA\u4EBA\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9", _jsx("input", { type: "email", value: senderSettings.fromEmail, onChange: (e) => setSenderSettings((x) => ({ ...x, fromEmail: e.target.value })), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", placeholder: "info@example.co.jp" }), _jsx("span", { className: "mt-1 block text-[11px] text-slate-500", children: "RESEND_FROM_EMAIL\u3067\u8A8D\u8A3C\u6E08\u307F\u306E\u30C9\u30E1\u30A4\u30F3\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002" })] }), _jsxs("label", { className: "text-xs font-semibold text-slate-700", children: ["\u8FD4\u4FE1\u5148\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\uFF08Reply-To\uFF09", _jsx("input", { type: "email", value: senderSettings.replyTo, onChange: (e) => setSenderSettings((x) => ({ ...x, replyTo: e.target.value })), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", placeholder: "\u8FD4\u4FE1\u5148\u3092\u5909\u66F4\u3059\u308B\u5834\u5408\u306B\u5165\u529B\uFF08\u4EFB\u610F\uFF09" })] })] })), templateChannel === 'email' && (_jsxs("div", { className: "md:col-span-2 space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700", children: "\u30E1\u30FC\u30EB\u5B9A\u578B\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\uFF08\u4FDD\u7BA1\u5EAB\u304B\u3089\u5F15\u7528\uFF09" }), _jsxs("button", { type: "button", onClick: () => setScreen('templates'), className: "inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer", children: [_jsx(Library, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u4FDD\u7BA1\u5EAB\u3067\u4F5C\u6210\u30FB\u7DE8\u96C6" })] })] }), _jsxs("select", { value: selectedEmailTemplateId, onChange: (e) => chooseEmailTemplate(e.target.value), className: "block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsxs("option", { value: "", children: ["\u73FE\u5728\u306E\u9001\u4FE1\u7A2E\u5225\uFF08", labels[kind], "\uFF09\u306E\u6A19\u6E96\u521D\u671F\u6587\u9762"] }), emailTemplates
                                                .filter((x) => x.channel === 'email')
                                                .map((x) => (_jsxs("option", { value: x.id, children: ["\u3010", labels[x.category] || x.category, "\u3011", x.name?.trim() || x.template_key] }, x.id)))] })] })), templateChannel === 'line' && (_jsxs("div", { className: "md:col-span-2 space-y-1.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700", children: "LINE\u5B9A\u578B\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\uFF08\u4FDD\u7BA1\u5EAB\u304B\u3089\u5F15\u7528\uFF09" }), _jsxs("button", { type: "button", onClick: () => setScreen('templates'), className: "inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer", children: [_jsx(Library, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u4FDD\u7BA1\u5EAB\u3067\u4F5C\u6210\u30FB\u7DE8\u96C6" })] })] }), _jsxs("select", { value: selectedLineTemplateId, onChange: (e) => chooseLineTemplate(e.target.value), className: "block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", children: [_jsxs("option", { value: "", children: ["\u73FE\u5728\u306E\u9001\u4FE1\u7A2E\u5225\uFF08", labels[kind], "\uFF09\u306E\u6A19\u6E96\u30C6\u30AD\u30B9\u30C8"] }), lineTemplates.map((x) => (_jsxs("option", { value: x.id, children: [x.name, "\uFF08", x.reply_type === 'text' ? 'テキスト' : x.reply_type === 'image' ? '画像' : x.reply_type === 'video' ? '動画' : 'Flex', "\uFF09"] }, x.id)))] })] })), templateChannel === 'email' && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700", children: "\u4EF6\u540D" }), _jsx("input", { value: subject, onChange: (e) => setSubject(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", placeholder: "\u4EF6\u540D\u3092\u5165\u529B..." }), _jsx(PlaceholderAssist, { text: subject, onInsert: (token) => setSubject((curr) => curr + token) })] })), (kind === 'deal' || kind === 'customer_meeting') && (_jsxs("p", { className: "md:col-span-2 text-xs text-slate-500", children: ["\u5171\u901AGoogle\u4E88\u7D04\u30DA\u30FC\u30B8: ", _jsx("span", { className: "text-purple-700 font-mono font-medium", children: bookingUrl || '未設定' })] })), channel === 'both' && (_jsxs("div", { className: "md:col-span-2 flex items-center gap-2 rounded-xl bg-purple-50/50 p-2.5 text-xs text-slate-700 border border-purple-200", children: [_jsx("span", { className: "font-semibold text-purple-900", children: "\u7DE8\u96C6\u5BFE\u8C61:" }), _jsx("button", { type: "button", onClick: () => setTemplateChannel('email'), className: `rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`, children: "\u30E1\u30FC\u30EB\u6587\u9762" }), _jsx("button", { type: "button", onClick: () => setTemplateChannel('line'), className: `rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'line' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`, children: "LINE\u6587\u9762" }), _jsx("span", { className: "text-slate-500 text-[11px]", children: "\u203B\u30E1\u30FC\u30EB\u3068LINE\u3067\u5225\u3005\u306E\u6587\u9762\u3092\u8A2D\u5B9A\u30FB\u9001\u4FE1\u3067\u304D\u307E\u3059" })] })), (templateChannel !== 'line' || !selectedLineTemplate || selectedLineTemplate.reply_type === 'text') && (_jsxs("div", { className: "md:col-span-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-xs font-semibold text-slate-700", children: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u672C\u6587" }), (kind === 'document' || kind === 'form' || kind === 'diagnosis') && (_jsxs("span", { className: "text-xs font-medium text-purple-700", children: ["\u4FDD\u5B58\u5BFE\u8C61: ", kind === 'document' ? doc?.title || '共通書類テンプレート' : form?.name || '共通テンプレート'] }))] }), _jsx("textarea", { value: body, onChange: (e) => setBody(e.target.value), rows: 8, className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs", placeholder: "\u672C\u6587\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044..." }), _jsx(PlaceholderAssist, { text: body, onInsert: (token) => setBody((curr) => curr + token) })] })), _jsxs("label", { className: "md:col-span-2 text-xs font-semibold text-slate-700", children: ["\u9001\u4FE1\u6839\u62E0\uFF08\u6CD5\u898F\u30FB\u540C\u610F\u8A18\u9332\uFF09", _jsx("input", { value: basis, onChange: (e) => setBasis(e.target.value), className: "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs" })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2.5 pt-2", children: [(channel === 'email' || channel === 'both') && (_jsxs("button", { type: "button", disabled: savingSenderSettings, onClick: () => void saveSenderSettings(), className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs", children: [_jsx(Save, { className: "h-4 w-4" }), savingSenderSettings ? '保存中…' : '差出人既定値を保存'] })), _jsxs("button", { type: "button", onClick: () => void save(), className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs", children: [_jsx(Save, { className: "h-4 w-4" }), "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u4FDD\u5B58\uFF08", templateChannel === 'email' ? 'メール' : 'LINE', "\uFF09"] }), !preview ? (_jsxs("button", { type: "button", onClick: () => {
                                    setError('');
                                    if (!contact) {
                                        setError('送信先を選択してください。');
                                        return;
                                    }
                                    if (kind === 'document' && !doc) {
                                        setError('送信する書類を選択してください。');
                                        return;
                                    }
                                    if ((kind === 'form' || kind === 'diagnosis') && !form) {
                                        setError('フォームを選択してください。');
                                        return;
                                    }
                                    setPreview(true);
                                }, className: "inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs shadow-purple-600/20 cursor-pointer", children: [_jsx(Eye, { className: "h-4 w-4" }), "\u9001\u4FE1\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u78BA\u8A8D"] })) : (_jsxs("button", { type: "button", disabled: busy, onClick: () => void send(), className: "inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer", children: [_jsx(Send, { className: "h-4 w-4" }), busy ? '送信中…' : '確定して送信する'] }))] }), preview && (_jsxs("div", { className: "rounded-2xl border-2 border-slate-300 bg-white p-5 space-y-4 shadow-md", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("span", { className: "flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-slate-900 text-sm", children: "\u9001\u4FE1\u76F4\u524D\u30D7\u30EC\u30D3\u30E5\u30FC\uFF08\u5DEE\u8FBC\u5909\u6570\u53CD\u6620\u6E08\u307F\uFF09" }), _jsx("p", { className: "text-xs text-slate-600", children: "\u5909\u6570\uFF08\u304A\u540D\u524D\u30FB\u4F1A\u793E\u540D\u30FB\u66F8\u985E\u540D\u30FBURL\u7B49\uFF09\u304C\u3059\u3079\u3066\u5B9F\u30C7\u30FC\u30BF\u306B\u7F6E\u304D\u63DB\u308F\u3063\u305F\u5B9F\u969B\u306E\u8868\u793A\u3067\u3059" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => setPreview(false), className: "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 cursor-pointer shadow-2xs", children: [_jsx(X, { className: "h-3.5 w-3.5" }), "\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u9589\u3058\u308B"] }), _jsxs("button", { type: "button", disabled: busy, onClick: () => void send(), className: "inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50", children: [_jsx(Send, { className: "h-3.5 w-3.5" }), busy ? '送信中…' : '確定して送信する'] })] })] }), (channel === 'email' || channel === 'both') && (_jsxs("div", { className: "rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden", children: [_jsxs("div", { className: "border-b border-slate-200 bg-slate-50 px-5 py-3.5 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-800", children: [_jsx(Mail, { className: "h-4 w-4 text-blue-600 shrink-0" }), _jsx("span", { className: "font-bold text-slate-900", children: "\u30E1\u30FC\u30EB\u9001\u4FE1\u30D7\u30EC\u30D3\u30E5\u30FC" })] }), _jsx("span", { className: "rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-700 font-bold text-[10px]", children: "SMTP / Resend \u9001\u4FE1" })] }), _jsxs("div", { className: "grid gap-1.5 text-xs text-slate-700 pt-1", children: [_jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "w-16 shrink-0 font-bold text-slate-700", children: "\u5DEE\u51FA\u4EBA:" }), _jsxs("span", { className: "text-slate-900 font-medium", children: [_jsx("strong", { className: "font-bold text-slate-950", children: senderSettings.fromName }), " <", senderSettings.fromEmail || '未設定', ">", senderSettings.replyTo.trim() && (_jsxs("span", { className: "text-slate-600 ml-2", children: ["\uFF08\u8FD4\u4FE1\u5148: ", senderSettings.replyTo, "\uFF09"] }))] })] }), _jsxs("div", { className: "flex items-baseline gap-2", children: [_jsx("span", { className: "w-16 shrink-0 font-bold text-slate-700", children: "\u5B9B\u5148:" }), _jsxs("span", { className: "text-slate-900 font-medium", children: [_jsxs("strong", { className: "font-bold text-slate-950", children: [contact?.full_name, " \u69D8"] }), contact?.email ? (_jsxs("span", { className: "text-slate-700 font-mono ml-1.5", children: ["<", contact.email, ">"] })) : (_jsx("span", { className: "ml-1.5 text-rose-600 font-bold", children: "\u26A0\uFE0F \u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u672A\u767B\u9332" }))] })] }), _jsxs("div", { className: "flex items-baseline gap-2 pt-1 border-t border-slate-200", children: [_jsx("span", { className: "w-16 shrink-0 font-bold text-slate-700", children: "\u4EF6\u540D:" }), _jsx("span", { className: "text-[14px] font-bold text-slate-950", children: fill(selectedEmailTemplate?.subject || (templateChannel === 'email' ? subject : resolveTemplate('email')?.subject || ''), vals) })] })] }), kind === 'document' && doc && (_jsxs("div", { className: "mt-2 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800", children: [_jsx(Paperclip, { className: "h-3.5 w-3.5 text-purple-600 shrink-0" }), _jsx("span", { className: "font-bold text-slate-900", children: "\u6DFB\u4ED8\u30FB\u9001\u4ED8\u66F8\u985E:" }), _jsx("span", { className: "font-semibold text-purple-900", children: doc.title }), _jsx("span", { className: "ml-auto text-[11px] text-slate-500 font-mono", children: "\uFF08\u66F8\u985E\u95B2\u89A7URL\u304C\u672C\u6587\u306B\u81EA\u52D5\u5DEE\u8FBC\u3055\u308C\u307E\u3059\uFF09" })] }))] }), _jsx("div", { className: "p-6 bg-white", children: _jsx("div", { className: "whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-900 selection:bg-purple-100", children: fill(kind === 'document' && documentCategory(doc) === 'contract'
                                                ? ensureContractReplySection(selectedEmailTemplate?.body_text || (templateChannel === 'email' ? body : resolveTemplate('email')?.body_text || ''))
                                                : selectedEmailTemplate?.body_text || (templateChannel === 'email' ? body : resolveTemplate('email')?.body_text || ''), vals) }) })] })), (channel === 'line' || channel === 'both') && (_jsxs("div", { className: "rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden", children: [_jsxs("div", { className: "border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx(MessageSquare, { className: "h-4 w-4 text-emerald-600 shrink-0" }), _jsx("span", { className: "font-bold text-slate-900", children: "LINE\u9001\u4FE1\u30D7\u30EC\u30D3\u30E5\u30FC" }), _jsxs("span", { className: "text-slate-600 text-xs", children: ["\uFF08\u5B9B\u5148: ", contact?.full_name, " \u69D8\uFF09"] })] }), _jsx("span", { className: "rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-emerald-700 font-bold text-[10px]", children: "LINE Messaging API \u9001\u4FE1" })] }), _jsx("div", { className: "p-4 bg-slate-50", children: _jsx(LineMessagePreview, { type: selectedLineTemplate?.reply_type || 'text', title: selectedLineTemplate?.name || 'LINE送信内容', payload: selectedLineTemplate
                                                ? fillPayload(selectedLineTemplate.payload)
                                                : { text: fill(templateChannel === 'line' ? body : resolveTemplate('line')?.body_text || '', vals) } }) })] })), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [_jsx("button", { type: "button", onClick: () => setPreview(false), className: "text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer", children: "\u2190 \u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u9589\u3058\u3066\u7DE8\u96C6\u306B\u623B\u308B" }), _jsxs("button", { type: "button", disabled: busy, onClick: () => void send(), className: "inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50", children: [_jsx(Send, { className: "h-4 w-4" }), busy ? '送信中…' : '確定して送信する'] })] })] }))] })), screen === 'templates' && (_jsx(CommunicationTemplateLibraryView, {}))] }));
};
