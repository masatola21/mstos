import React, { useEffect, useState, useRef } from 'react';
import { getSalesEmailTemplate, getNurturingStepTemplate } from '../utils/salesOutreachTemplates';
import { Eye, Save, Send, Users, SendHorizonal, FileText, Library, Mail, MessageSquare, Paperclip, CheckCircle2, X, Inbox, ArrowLeft } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';
import { LineMessagePreview } from './LineMessagePreview';
import { renderPlaceholders } from '../utils/placeholders';
import { PlaceholderAssist } from './common/PlaceholderAssist';
import { MarketingBroadcastView } from './marketing/MarketingBroadcastView';
import { CommunicationTemplateLibraryView } from './marketing/CommunicationTemplateLibraryView';
import { CommunicationOutboxHistoryView } from './marketing/CommunicationOutboxHistoryView';

type Kind = 'document' | 'form' | 'diagnosis' | 'deal' | 'customer_meeting' | 'announcement' | 'sales_outreach' | 'nurturing_story';
type Channel = 'email' | 'line' | 'both';
type DeliveryChannel = 'email' | 'line';
type DocumentType = 'all' | 'diagnosis_report' | 'proposal' | 'estimate' | 'contract' | 'invoice' | 'monthly_report' | 'other';
type Contact = { id: string; full_name: string; email?: string | null; line_user_id?: string | null; company_id?: string | null };

type Props = {
  initialKind?: Kind;
  initialCompanyId?: string;
  initialDocumentId?: string;
  initialFormId?: string;
  initialDealId?: string;
  initialContactId?: string;
  initialMode?: 'send' | 'broadcast' | 'templates' | 'history';
  initialBroadcastChannel?: 'email' | 'line';
  initialChannel?: Channel;
  initialSubject?: string;
  initialBody?: string;
  variant?: 'page' | 'drawer';
  onClose?: () => void;
  onSent?: (result: { ok: boolean; summary: string }) => void;
  onDraftChange?: (isDirty: boolean) => void;
  originTab?: string;
  originTabLabel?: string;
  onReturnToOrigin?: () => void;
  onNavigateTab?: (tab: string) => void;
};

const labels: Record<Kind, string> = {
  document: '重要書類の送信（見積・契約・請求・レポート）',
  form: 'フォーム案内',
  diagnosis: '診断案内',
  deal: '商談日程案内',
  customer_meeting: '顧客面談日程案内',
  sales_outreach: '見込み企業営業メール（ステップ1〜5）',
  nurturing_story: '大橋ストーリー型ナーチャリング（全7話・LINE/メール）',
  announcement: 'その他の案内',
};

const documentCategory = (doc: any): DocumentType => {
  if (!doc || typeof doc !== 'object') return 'other';
  if (doc.document_type === 'proposal' && /見積/.test(doc.title || '')) return 'estimate';
  if (doc.document_type === 'report') return 'diagnosis_report';
  return (['diagnosis_report', 'proposal', 'estimate', 'contract', 'invoice', 'monthly_report'].includes(doc.document_type) ? doc.document_type : 'other') as DocumentType;
};

const documentOrder: Record<string, number> = {
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

const documentMessage = (type: string | undefined, channel: DeliveryChannel) => {
  const hi = '{お名前} 様';
  const intro = 'お世話になっております。有限会社MSTです。';
  const details = '書類名：{書類名}\n{書類URL}\n{書類本文}';
  const messages: Record<string, { subject: string; body: string; line: string }> = {
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
const ensureContractReplySection = (body: string) => body.includes('【メール返信による契約合意】') ? body : body.trimEnd() + '\n\n' + contractReplySection;
const fill = (s: string, v: Record<string, string>) => renderPlaceholders(s, v);
const htmlToText = (html: string) => {
  const withBreaks = html.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n').replace(/<\/td>/gi, '  ');
  return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent?.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || '';
};

export const CommunicationSendCenter: React.FC<Props> = ({
  initialKind = 'announcement',
  initialCompanyId,
  initialDocumentId,
  initialFormId,
  initialDealId,
  initialContactId,
  initialMode = 'send',
  initialBroadcastChannel = 'email',
  initialChannel,
  initialSubject,
  initialBody,
  variant = 'page',
  onClose,
  onSent,
  onDraftChange,
  originTab,
  originTabLabel,
  onReturnToOrigin,
  onNavigateTab,
}) => {
  const [screen, setScreen] = useState<'send' | 'broadcast' | 'templates' | 'history'>(variant === 'drawer' ? 'send' : initialMode);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [channel, setChannel] = useState<Channel>(initialChannel || 'email');
  const [templateChannel, setTemplateChannel] = useState<DeliveryChannel>(initialChannel === 'line' ? 'line' : 'email');
  const [documentType, setDocumentType] = useState<DocumentType>('all');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [bookingUrl, setBookingUrl] = useState('');
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [companyIndustries, setCompanyIndustries] = useState<Record<string, string>>({});
  const [salesStep, setSalesStep] = useState<number>(1);
  const [nurturingStep, setNurturingStep] = useState<number>(1);
  const [contactId, setContactId] = useState(initialContactId || '');
  const [docId, setDocId] = useState(initialDocumentId || '');
  const [formId, setFormId] = useState(initialFormId || '');
  const [url, setUrl] = useState('');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
  const hasCustomInitialContentRef = useRef(Boolean(initialSubject || initialBody));
  const [templates, setTemplates] = useState<any[]>(seed);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [lineTemplates, setLineTemplates] = useState<any[]>([]);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState('');
  const [selectedLineTemplateId, setSelectedLineTemplateId] = useState('');
  const [basis, setBasis] = useState('顧客からの依頼・業務連絡');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [templateDocumentType, setTemplateDocumentType] = useState<DocumentType>('contract');
  const [senderSettings, setSenderSettings] = useState<{ fromName: string; fromEmail: string; replyTo: string }>({
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
  const templateKeyFor = (deliveryChannel: DeliveryChannel) =>
    (kind === 'form' || kind === 'diagnosis') && form
      ? `${kind}_${form.id}_${deliveryChannel}`
      : kind === 'document' && screen === 'templates'
      ? `document_${templateDocumentType}_${deliveryChannel}`
      : kind === 'document' && doc
      ? `document_${doc.id}_${deliveryChannel}`
      : `${kind}_${deliveryChannel}`;

  const templateKey = templateKeyFor(templateChannel);
  const resolveTemplate = (deliveryChannel: DeliveryChannel) => {
    const key = templateKeyFor(deliveryChannel);
    const savedForItem = [...templates].reverse().find((x) => x.template_key === key);
    if (savedForItem) return savedForItem;
    if (kind === 'document') {
      const savedByType = [...templates].reverse().find((x) => x.template_key === 'document_' + activeDocumentType + '_' + deliveryChannel);
      if (savedByType) return savedByType;
      const savedGeneric = [...templates].reverse().find((x) => x.template_key === 'document_' + deliveryChannel);
      if (savedGeneric) return savedGeneric;
      return documentMessage(activeDocumentType, deliveryChannel);
    }
    return [...templates].reverse().find((x) => x.template_key === kind + '_' + deliveryChannel || (x.category === kind && x.channel === deliveryChannel)) || seed.find((x) => x.category === kind && x.channel === deliveryChannel);
  };

  const tmpl = resolveTemplate(templateChannel);
  const selectedEmailTemplate = emailTemplates.find((x) => x.id === selectedEmailTemplateId);
  const selectedLineTemplate = lineTemplates.find((x) => x.id === selectedLineTemplateId);

  const fillPayload = (value: any): any =>
    Array.isArray(value)
      ? value.map(fillPayload)
      : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'storagePaths').map(([key, item]) => [key, fillPayload(item)]))
      : typeof value === 'string'
      ? fill(value, vals)
      : value;

  const chooseEmailTemplate = (id: string) => {
    setSelectedEmailTemplateId(id);
    const item = emailTemplates.find((x) => x.id === id);
    if (item) {
      setSubject(item.subject || '');
      setBody(item.body_text || '');
    } else if (tmpl) {
      setSubject(tmpl.subject || '');
      setBody(tmpl.body_text || '');
    }
  };

  const chooseLineTemplate = (id: string) => {
    setSelectedLineTemplateId(id);
    const item = lineTemplates.find((x) => x.id === id);
    if (!item) return;
    const payload = item.payload || {};
    setBody(item.reply_type === 'text' ? String(payload.text || '') : '');
  };

  const currentLinkUrl =
    (kind === 'form' || kind === 'diagnosis') && form
      ? window.location.origin + '/f/' + encodeURIComponent(form.public_slug) + (contact ? `?cid=${encodeURIComponent(contact.id)}` + (contact.line_user_id ? `&luid=${encodeURIComponent(contact.line_user_id)}` : '') : '')
      : kind === 'deal' || kind === 'customer_meeting'
      ? url.trim() || bookingUrl
      : url.trim();

  const vals: Record<string, string> = {
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
    if (!db) return;
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
        if (!ok) return;
        if (c.error) throw c.error;
        if (d.error) throw d.error;
        if (f.error) throw f.error;
        if (settings.error) throw settings.error;
        if (emailSettings.error) throw emailSettings.error;
        setForms(f.data || []);
        setBookingUrl(settings.data?.booking_page_url || '');
        setSenderSettings({
          fromName: emailSettings.data?.sender_name || '有限会社MST｜経営・業務改善支援',
          fromEmail: emailSettings.data?.sender_email || 'contact@mstcorp.info',
          replyTo: emailSettings.data?.reply_to_email || 'mst.shikumikaizen@gmail.com',
        });
        if (!co.error) {
          setCompanies(Object.fromEntries((co.data || []).map((x: any) => [x.id, x.company_name])));
          setCompanyIndustries(Object.fromEntries((co.data || []).map((x: any) => [x.id, x.industry || ''])));
        }
        setContacts((c.data || []).filter((x: Contact) => !initialCompanyId || x.company_id === initialCompanyId));
        setDocs((d.data || []).filter((x: any) => !initialCompanyId || x.company_id === initialCompanyId || x.id === initialDocumentId));
        if (initialFormId) setFormId(initialFormId);
        if (initialContactId) setContactId(initialContactId);
        if (initialDocumentId) {
          setDocId(initialDocumentId);
          setKind('document');
          const targetDoc = (d.data || []).find((x: any) => x.id === initialDocumentId);
          if (targetDoc) {
            if (targetDoc.contact_id && !initialContactId) {
              setContactId(targetDoc.contact_id);
            } else if (targetDoc.company_id && !initialContactId) {
              const matchingContact = (c.data || []).find((ct: any) => ct.company_id === targetDoc.company_id);
              if (matchingContact) setContactId(matchingContact.id);
            }
          }
        }
        if (!t.error) {
          setEmailTemplates((t.data || []) as any[]);
          if (t.data?.length) setTemplates([...seed.filter((x) => !t.data.some((row: any) => row.template_key === x.category + '_' + x.channel)), ...t.data]);
        }
        if (!lineTemplateResult.error) setLineTemplates((lineTemplateResult.data || []) as any[]);
      })
      .catch((e) => ok && setError(e.message || '読み込みに失敗しました。'));
    return () => {
      ok = false;
    };
  }, [initialCompanyId, initialFormId, initialContactId, initialDocumentId]);

  useEffect(() => {
    if (variant === 'drawer') {
      const isDirty = Boolean(subject.trim() || body.trim() || (contactId && contactId !== initialContactId) || (docId && docId !== initialDocumentId));
      onDraftChange?.(isDirty);
    }
  }, [subject, body, contactId, docId, variant, onDraftChange, initialContactId, initialDocumentId]);

  useEffect(() => {
    if (hasCustomInitialContentRef.current) {
      hasCustomInitialContentRef.current = false;
      return;
    }
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

  const applySalesStep = (stepNum: number, c = contact) => {
    const compName = c?.company_id ? companies[c.company_id] || '貴社' : '貴社';
    const compInd = c?.company_id ? companyIndustries[c.company_id] || '' : '';
    const diagForm = forms.find((f: any) => f.form_type === 'diagnosis') || forms[0];
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

  const applyNurturingStep = (stepNum: number, c = contact, ch = channel) => {
    const compName = c?.company_id ? companies[c.company_id] || '貴社' : '貴社';
    const diagForm = forms.find((f: any) => f.form_type === 'diagnosis') || forms[0];
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
    } else if (kind === 'document' && doc) {
      setUrl(window.location.origin + '/docs/' + encodeURIComponent(doc.id));
    }
  }, [kind, formId, form?.public_slug, contact?.id, contact?.line_user_id, docId, doc?.id]);

  const save = async () => {
    if (!db) return;
    const { data } = await db.auth.getUser();
    if (!data.user) {
      setError('ログインしてください。');
      return;
    }
    const row = { owner_id: data.user.id, template_key: templateKey, category: kind, channel: templateChannel, subject, body_text: body };
    const { data: saved, error: e } = await db.from('communication_templates').upsert(row, { onConflict: 'owner_id,template_key' }).select('*').single();
    if (e) setError(e.message);
    else {
      const savedRow = saved || row;
      setTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
      setEmailTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
      setNotice('テンプレートを保存しました。');
    }
  };

  const saveSenderSettings = async () => {
    if (!db) return;
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
      const { error: e } = await db.from('email_send_settings').upsert(
        { owner_id: data.user.id, sender_name: senderName, sender_email: senderEmail, reply_to_email: replyTo || null, updated_at: new Date().toISOString() },
        { onConflict: 'owner_id' },
      );
      if (e) throw e;
      setSenderSettings({ fromName: senderName, fromEmail: senderEmail, replyTo });
      setNotice('メール送信の既定値を保存しました。全端末で共通して使われます。');
    } catch (e: any) {
      setError(e?.message || 'メール送信設定を保存できませんでした。');
    } finally {
      setSavingSenderSettings(false);
    }
  };

  const send = async () => {
    if (!db || !contact) return;
    setError('');
    const targets: DeliveryChannel[] = channel === 'both' ? ['email', 'line'] : [channel];
    if (targets.includes('email') && (!senderSettings.fromName.trim() || !senderSettings.fromEmail.trim())) {
      setError('送信時の差出人設定を入力して保存してください。');
      return;
    }
    const hasDocUrl = Boolean(url.trim() || vals.document_url?.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''));
    if (
      !basis.trim() ||
      (kind === 'document' && (!doc || !hasDocUrl)) ||
      (kind !== 'document' && kind !== 'announcement' && !vals.link_url.trim()) ||
      (targets.includes('email') && !contact.email) ||
      (targets.includes('line') && !contact.line_user_id)
    ) {
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
      if (!sessionData.session?.access_token) throw Error('ログイン状態を確認できません。');
      if (targets.includes('line')) {
        const { data: friend, error: friendError } = await db.from('line_friends').select('status,consent_status').eq('line_user_id', contact.line_user_id).maybeSingle();
        if (friendError) throw friendError;
        if (!friend || friend.status !== 'active' || friend.consent_status !== 'opted_in') throw Error('LINEの友だち状態と配信同意を確認できません。');
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
      if (insertError) throw insertError;
      const outcomes = await Promise.all(
        (outboxRows || []).map(async (row: any) => {
          const response = await fetch('/api/communications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session!.access_token },
            body: JSON.stringify({ outboxId: row.id }),
          });
          const result = await response.json().catch(() => ({}));
          return { channel: row.channel, ok: response.ok && result.status === 'sent', message: result.error || '' };
        }),
      );
      const summary = outcomes
        .map((x) => (x.channel === 'email' ? 'メール' : 'LINE'))
        .map((label, i) => {
          const outcome = outcomes[i];
          return label + (outcome.ok ? '送信済み' : '失敗') + (outcome.message ? '（' + outcome.message + '）' : '');
        })
        .join(' / ');
      setNotice(summary);
      setPreview(false);
      const allOk = outcomes.length > 0 && outcomes.every((x) => x.ok);
      if (allOk) {
        onDraftChange?.(false);
        onSent?.({ ok: true, summary });
      } else {
        const failedOutcomes = outcomes.filter((x) => !x.ok);
        setError(failedOutcomes.map((x) => `${x.channel === 'email' ? 'メール' : 'LINE'}送信エラー: ${x.message || '配信先の設定をご確認ください'}`).join(' / '));
      }
    } catch (e: any) {
      setError(e.message || '送信に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Return to origin button (when opened as full page from another screen) ── */}
      {variant === 'page' && originTab && onReturnToOrigin && (
        <div className="flex items-center justify-between bg-purple-50/70 border border-purple-200/80 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-purple-900">
            <span className="font-semibold">遷移元の画面:</span>
            <span className="font-bold">{originTabLabel || originTab}</span>
          </div>
          <button
            type="button"
            onClick={onReturnToOrigin}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>元の画面に戻る</span>
          </button>
        </div>
      )}

      {/* ── Top Header (Only on standalone page) ── */}
      {variant === 'page' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">送信履歴・一括配信・テンプレート</h1>

          {/* 画面切り替えタブ */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setScreen('send');
                setPreview(false);
                setError('');
              }}
              aria-pressed={screen === 'send'}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                screen === 'send'
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SendHorizonal className="h-3.5 w-3.5" />
              <span>個別送信（1対1）</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen('broadcast');
                setPreview(false);
                setError('');
              }}
              aria-pressed={screen === 'broadcast'}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                screen === 'broadcast'
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>一斉配信（1対N）</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen('history');
                setPreview(false);
                setError('');
              }}
              aria-pressed={screen === 'history'}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                screen === 'history'
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>送信履歴・送信待ち</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScreen('templates');
                setPreview(false);
                setError('');
              }}
              aria-pressed={screen === 'templates'}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                screen === 'templates'
                  ? 'bg-purple-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Library className="h-3.5 w-3.5" />
              <span>定型文テンプレート</span>
            </button>

            {onNavigateTab && (
              <div className="flex items-center gap-1.5 sm:ml-2 sm:pl-2 sm:border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => onNavigateTab('inbox_hub')}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="受信トレイを開く"
                >
                  <Inbox className="h-3.5 w-3.5 text-purple-600" />
                  <span>受信トレイ</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('document_templates')}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="提案書・診断レポート・見積書作成を開く"
                >
                  <FileText className="h-3.5 w-3.5 text-purple-600" />
                  <span>書類作成</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer Mode Top Summary Badge */}
      {variant === 'drawer' && (
        <div className="flex flex-wrap items-center gap-2 pb-1 text-xs">
          <span className="rounded-md bg-purple-100 text-purple-800 font-bold px-2.5 py-1 border border-purple-200">
            {labels[kind] || kind}
          </span>
          {contact && (
            <span className="text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md font-medium">
              宛先: <strong className="text-slate-900">{contact.full_name} 様</strong> {companies[contact.company_id || ''] && `(${companies[contact.company_id || '']})`}
            </span>
          )}
          {doc && (
            <span className="text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md font-medium">
              書類: <strong className="text-purple-700">{doc.title}</strong>
            </span>
          )}
        </div>
      )}

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-2xs font-medium">{error}</p>}
      {notice && (
        <div role="status" className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-900 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{notice}</span>
          {variant === 'page' && originTab && onReturnToOrigin && (
            <button
              type="button"
              onClick={onReturnToOrigin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3 py-1 text-xs font-bold text-white shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>元の画面に戻る（{originTabLabel || originTab}）</span>
            </button>
          )}
        </div>
      )}

      {/* 画面1: 一斉配信（1対N） */}
      {screen === 'broadcast' && (
        <MarketingBroadcastView initialChannel={initialBroadcastChannel} />
      )}

      {/* 画面2: 個別送信（1対1） */}
      {screen === 'send' && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              送信内容
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
              >
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              送信方法
              <select
                value={channel}
                onChange={(e) => {
                  const next = e.target.value as Channel;
                  setChannel(next);
                  if (next !== 'both') setTemplateChannel(next);
                }}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
              >
                <option value="email">メール</option>
                <option value="line">LINE</option>
                <option value="both">メール ＋ LINE（同時送信）</option>
              </select>
            </label>
            <label className="md:col-span-2 text-xs font-semibold text-slate-700">
              送信先
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
              >
                <option value="">連絡先を選択してください</option>
                {contacts.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.full_name} · {companies[x.company_id || ''] || '未設定'} ·{' '}
                    {channel === 'both'
                      ? `${x.email ? 'メールあり' : 'メール未登録'} · ${x.line_user_id ? 'LINE連携' : 'LINE未連携'}`
                      : channel === 'email'
                      ? x.email || 'メール未登録'
                      : x.line_user_id
                      ? 'LINE連携'
                      : 'LINE未連携'}
                  </option>
                ))}
              </select>
            </label>

            {kind === 'nurturing_story' && (
              <div className="md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5">
                <label className="block text-xs font-bold text-purple-900">
                  ストーリー型ナーチャリング話数（{channel === 'line' ? 'LINE形式' : 'メルマガ/メール形式'}）
                  <select
                    value={nurturingStep}
                    onChange={(e) => {
                      const s = Number(e.target.value) || 1;
                      setNurturingStep(s);
                      applyNurturingStep(s, contact, channel);
                    }}
                    className="mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600"
                  >
                    <option value={1}>第1話：大橋の原体験・FC本部突然倒産の危機</option>
                    <option value={2}>第2話：最初に徹底して仕組み化した2大業務（管理＆集客）</option>
                    <option value={3}>第3話：「何から手をつければいいかわからない」経営者様へ</option>
                    <option value={4}>第4話：流行りのツールを入れても失敗する会社、業務が激変する会社</option>
                    <option value={5}>第5話：「人を無理に増やさず、利益がしっかり残る会社」の共通点</option>
                    <option value={6}>第6話：私は「システム屋」でも「コンサルタント」でもありません</option>
                    <option value={7}>第7話：【最終話】自分がいないと現場が回らない状態から、脱却するチャンス</option>
                  </select>
                </label>
                <p className="text-[11px] text-purple-800">※ 送信方法（メール／LINE）に応じて、最適なレイアウト（メルマガ件名・本文 または LINE向けテキスト）が自動展開されます。</p>
              </div>
            )}

            {kind === 'sales_outreach' && (
              <div className="md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5">
                <label className="block text-xs font-bold text-purple-900">
                  営業メールステップ（{contact?.company_id ? (companies[contact.company_id] || '選択中') + (' · 業種: ' + (companyIndustries[contact.company_id] || '一般・未設定')) : '送信先を選ぶと業種別メッセージが自動挿入'}）
                  <select
                    value={salesStep}
                    onChange={(e) => {
                      const s = Number(e.target.value) || 1;
                      setSalesStep(s);
                      applySalesStep(s);
                    }}
                    className="mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600"
                  >
                    <option value={1}>第1通：業界急所の提起 ＆ 3分無料診断ギフト（返信不要）</option>
                    <option value={2}>第2通：人手不足ではなく「仕組み不足」の真実</option>
                    <option value={3}>第3通：具体的ビフォーアフター（月25時間削減の軌跡）</option>
                    <option value={4}>第4通：診断速報判定（チラ見せ）の強い動機づけ</option>
                    <option value={5}>第5通：【最終案内】現場の火消しから解放され利益が残る会社へ</option>
                  </select>
                </label>
                <p className="text-[11px] text-purple-800">※ 選択した会社の業種に応じた課題・メリットを自動挿入します。</p>
              </div>
            )}

            {(kind === 'form' || kind === 'diagnosis') && (
              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                公開フォーム
                <select
                  value={formId}
                  onChange={(e) => {
                    setFormId(e.target.value);
                    const f = forms.find((x: any) => x.id === e.target.value);
                    if (f) setUrl(window.location.origin + '/f/' + encodeURIComponent(f.public_slug));
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="">公開フォームを選択してください</option>
                  {forms.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.name} · {f.form_type}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {kind === 'document' && (
              <>
                <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                  書類の種類
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="all">すべての書類（診断レポート→提案書→見積書→契約書→請求書）</option>
                    <option value="diagnosis_report">診断レポート</option>
                    <option value="proposal">提案書</option>
                    <option value="estimate">見積書</option>
                    <option value="contract">契約書</option>
                    <option value="invoice">請求書</option>
                    <option value="monthly_report">月次報告書</option>
                    <option value="other">その他</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                  書類（{contact?.company_id ? (companies[contact.company_id] || '選択した会社') + 'の書類' : initialCompanyId ? (companies[initialCompanyId] || 'この会社') + 'の書類' : '送信先を選ぶと会社の書類で絞り込み'}・承認済みのみ送信可能）
                  <select
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="">書類を選択してください</option>
                    {availableDocs.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title} · {({ draft: '下書き', awaiting_approval: '確認待ち', approved: '承認済み', queued: '送信待ち', sent: '送信済み', failed: '送信失敗', archived: 'アーカイブ' } as Record<string, string>)[x.status] || x.status}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label className="md:col-span-2 text-xs font-semibold text-slate-700">
              {kind === 'document' ? '共有可能な書類URL' : kind === 'deal' || kind === 'customer_meeting' ? 'この案内専用URL（空欄なら共通予約URL）' : 'フォーム・案内URL'}
              <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs" placeholder="https://..." />
            </label>

            {(channel === 'email' || channel === 'both') && (
              <>
                <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                  差出人名
                  <input
                    value={senderSettings.fromName}
                    onChange={(e) => setSenderSettings((x) => ({ ...x, fromName: e.target.value }))}
                    maxLength={100}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                    placeholder="有限会社MST"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  差出人メールアドレス
                  <input
                    type="email"
                    value={senderSettings.fromEmail}
                    onChange={(e) => setSenderSettings((x) => ({ ...x, fromEmail: e.target.value }))}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                    placeholder="info@example.co.jp"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">RESEND_FROM_EMAILで認証済みのドメインを指定してください。</span>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  返信先メールアドレス（Reply-To）
                  <input
                    type="email"
                    value={senderSettings.replyTo}
                    onChange={(e) => setSenderSettings((x) => ({ ...x, replyTo: e.target.value }))}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                    placeholder="返信先を変更する場合に入力（任意）"
                  />
                </label>
              </>
            )}

            {templateChannel === 'email' && (
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    メール定型テンプレート（保管庫から引用）
                  </label>
                  <button
                    type="button"
                    onClick={() => setScreen('templates')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
                  >
                    <Library className="h-3.5 w-3.5" />
                    <span>テンプレート保管庫で作成・編集</span>
                  </button>
                </div>
                <select
                  value={selectedEmailTemplateId}
                  onChange={(e) => chooseEmailTemplate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="">現在の送信種別（{labels[kind]}）の標準初期文面</option>
                  {emailTemplates
                    .filter((x) => x.channel === 'email')
                    .map((x: any) => (
                      <option key={x.id} value={x.id}>
                        【{labels[x.category as Kind] || x.category}】{x.name?.trim() || x.template_key}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {templateChannel === 'line' && (
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    LINE定型テンプレート（保管庫から引用）
                  </label>
                  <button
                    type="button"
                    onClick={() => setScreen('templates')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
                  >
                    <Library className="h-3.5 w-3.5" />
                    <span>テンプレート保管庫で作成・編集</span>
                  </button>
                </div>
                <select
                  value={selectedLineTemplateId}
                  onChange={(e) => chooseLineTemplate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="">現在の送信種別（{labels[kind]}）の標準テキスト</option>
                  {lineTemplates.map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.name}（{x.reply_type === 'text' ? 'テキスト' : x.reply_type === 'image' ? '画像' : x.reply_type === 'video' ? '動画' : 'Flex'}）
                    </option>
                  ))}
                </select>
              </div>
            )}

            {templateChannel === 'email' && (
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">件名</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                  placeholder="件名を入力..."
                />
                <PlaceholderAssist text={subject} onInsert={(token) => setSubject((curr) => curr + token)} />
              </div>
            )}

            {(kind === 'deal' || kind === 'customer_meeting') && (
              <p className="md:col-span-2 text-xs text-slate-500">
                共通Google予約ページ: <span className="text-purple-700 font-mono font-medium">{bookingUrl || '未設定'}</span>
              </p>
            )}

            {channel === 'both' && (
              <div className="md:col-span-2 flex items-center gap-2 rounded-xl bg-purple-50/50 p-2.5 text-xs text-slate-700 border border-purple-200">
                <span className="font-semibold text-purple-900">編集対象:</span>
                <button
                  type="button"
                  onClick={() => setTemplateChannel('email')}
                  className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                >
                  メール文面
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateChannel('line')}
                  className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'line' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                >
                  LINE文面
                </button>
                <span className="text-slate-500 text-[11px]">※メールとLINEで別々の文面を設定・送信できます</span>
              </div>
            )}

            {(templateChannel !== 'line' || !selectedLineTemplate || selectedLineTemplate.reply_type === 'text') && (
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">テンプレート本文</label>
                  {(kind === 'document' || kind === 'form' || kind === 'diagnosis') && (
                    <span className="text-xs font-medium text-purple-700">
                      保存対象: {kind === 'document' ? doc?.title || '共通書類テンプレート' : form?.name || '共通テンプレート'}
                    </span>
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                  placeholder="本文を入力してください..."
                />
                <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
              </div>
            )}

            <label className="md:col-span-2 text-xs font-semibold text-slate-700">
              送信根拠（法規・同意記録）
              <input
                value={basis}
                onChange={(e) => setBasis(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {(channel === 'email' || channel === 'both') && (
              <button
                type="button"
                disabled={savingSenderSettings}
                onClick={() => void saveSenderSettings()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                <Save className="h-4 w-4" />
                {savingSenderSettings ? '保存中…' : '差出人既定値を保存'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
            >
              <Save className="h-4 w-4" />
              テンプレート保存（{templateChannel === 'email' ? 'メール' : 'LINE'}）
            </button>
            {!preview ? (
              <button
                type="button"
                onClick={() => {
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
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs shadow-purple-600/20 cursor-pointer"
              >
                <Eye className="h-4 w-4" />
                送信プレビューを確認
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void send()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {busy ? '送信中…' : '確定して送信する'}
              </button>
            )}
          </div>

          {preview && (
            <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 space-y-4 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
                    <Eye className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">送信直前プレビュー（差込変数反映済み）</h3>
                    <p className="text-xs text-slate-600">
                      変数（お名前・会社名・書類名・URL等）がすべて実データに置き換わった実際の表示です
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 cursor-pointer shadow-2xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    プレビューを閉じる
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send()}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {busy ? '送信中…' : '確定して送信する'}
                  </button>
                </div>
              </div>

              {(channel === 'email' || channel === 'both') && (
                <div className="rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden">
                  {/* メールクライアント風ヘッダー */}
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-900">メール送信プレビュー</span>
                      </div>
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-700 font-bold text-[10px]">
                        SMTP / Resend 送信
                      </span>
                    </div>

                    <div className="grid gap-1.5 text-xs text-slate-700 pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 font-bold text-slate-700">差出人:</span>
                        <span className="text-slate-900 font-medium">
                          <strong className="font-bold text-slate-950">{senderSettings.fromName}</strong> &lt;{senderSettings.fromEmail || '未設定'}&gt;
                          {senderSettings.replyTo.trim() && (
                            <span className="text-slate-600 ml-2">（返信先: {senderSettings.replyTo}）</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 font-bold text-slate-700">宛先:</span>
                        <span className="text-slate-900 font-medium">
                          <strong className="font-bold text-slate-950">{contact?.full_name} 様</strong>
                          {contact?.email ? (
                            <span className="text-slate-700 font-mono ml-1.5">&lt;{contact.email}&gt;</span>
                          ) : (
                            <span className="ml-1.5 text-rose-600 font-bold">⚠️ メールアドレス未登録</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 pt-1 border-t border-slate-200">
                        <span className="w-16 shrink-0 font-bold text-slate-700">件名:</span>
                        <span className="text-[14px] font-bold text-slate-950">
                          {fill(selectedEmailTemplate?.subject || (templateChannel === 'email' ? subject : resolveTemplate('email')?.subject || ''), vals)}
                        </span>
                      </div>
                    </div>

                    {/* 添付書類表示 */}
                    {kind === 'document' && doc && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800">
                        <Paperclip className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        <span className="font-bold text-slate-900">添付・送付書類:</span>
                        <span className="font-semibold text-purple-900">{doc.title}</span>
                        <span className="ml-auto text-[11px] text-slate-500 font-mono">（書類閲覧URLが本文に自動差込されます）</span>
                      </div>
                    )}
                  </div>

                  {/* メール本文プレビュー */}
                  <div className="p-6 bg-white">
                    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-900 selection:bg-purple-100">
                      {fill(
                        kind === 'document' && documentCategory(doc) === 'contract'
                          ? ensureContractReplySection(selectedEmailTemplate?.body_text || (templateChannel === 'email' ? body : resolveTemplate('email')?.body_text || ''))
                          : selectedEmailTemplate?.body_text || (templateChannel === 'email' ? body : resolveTemplate('email')?.body_text || ''),
                        vals,
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(channel === 'line' || channel === 'both') && (
                <div className="rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <MessageSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900">LINE送信プレビュー</span>
                      <span className="text-slate-600 text-xs">（宛先: {contact?.full_name} 様）</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-emerald-700 font-bold text-[10px]">
                      LINE Messaging API 送信
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50">
                    <LineMessagePreview
                      type={selectedLineTemplate?.reply_type || 'text'}
                      title={selectedLineTemplate?.name || 'LINE送信内容'}
                      payload={
                        selectedLineTemplate
                          ? fillPayload(selectedLineTemplate.payload)
                          : { text: fill(templateChannel === 'line' ? body : resolveTemplate('line')?.body_text || '', vals) }
                      }
                    />
                  </div>
                </div>
              )}

              {/* 下部アクション */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  ← プレビューを閉じて編集に戻る
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {busy ? '送信中…' : '確定して送信する'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 画面3: テンプレート保管庫（全社マスター） */}
      {screen === 'templates' && (
        <CommunicationTemplateLibraryView />
      )}

      {/* 画面4: 全社送信履歴・送信待ち（アウトボックス） */}
      {screen === 'history' && (
        <CommunicationOutboxHistoryView
          onNavigateToSend={() => setScreen('send')}
          onNavigateToBroadcast={() => setScreen('broadcast')}
          onNavigateToDocuments={() => onNavigateTab?.('document_templates')}
        />
      )}
    </div>
  );
};