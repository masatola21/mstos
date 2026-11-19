import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getSalesEmailTemplate,
  resolveOneShotOutreachDraft,
  ONE_SHOT_SCENARIO_ID,
  type CustomOneShotConfig,
} from '../utils/salesOutreachTemplates';
import { EmailHtmlPreviewCard } from './common/EmailHtmlPreviewCard';
import { Eye, Save, Send, Users, SendHorizonal, FileText, Library, Mail, MessageSquare, Paperclip, CheckCircle2, X, Inbox, ArrowLeft, AlertTriangle, Maximize2, Minimize2, Eraser, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { getSupabase } from '../lib/supabaseClient';
import { LineMessagePreview } from './LineMessagePreview';
import { renderPlaceholders } from '../utils/placeholders';
import { PlaceholderAssist } from './common/PlaceholderAssist';
import { MarketingBroadcastView } from './marketing/MarketingBroadcastView';
import { CommunicationTemplateLibraryView } from './marketing/CommunicationTemplateLibraryView';
import { CommunicationOutboxHistoryView } from './marketing/CommunicationOutboxHistoryView';
import { DocumentPreviewModal } from './common/DocumentPreviewModal';

type Kind = 'document' | 'form' | 'diagnosis' | 'deal' | 'customer_meeting' | 'announcement' | 'sales_outreach' | 'freeform';
type Channel = 'email' | 'line' | 'both';
type DeliveryChannel = 'email' | 'line';
type DocumentType = 'estimate' | 'invoice' | 'contract' | 'proposal' | 'diagnosis_report' | 'monthly_report' | 'other';
type DocumentDeliveryFormat = 'web_link' | 'pdf_attachment';
type Contact = { id: string; full_name: string; email?: string | null; line_user_id?: string | null; company_id?: string | null };

type Props = {
  initialKind?: Kind;
  initialCompanyId?: string;
  initialDocumentId?: string;
  initialFormId?: string;
  initialDealId?: string;
  initialContactId?: string;
  initialRecipientEmail?: string;
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
  document: '重要書類�E送信�E�提案書・見積�E契紁E�E請求�E月次報告！E,
  form: 'フォーム案�E',
  diagnosis: '診断案�E',
  deal: '啁E��E��程案�E',
  customer_meeting: '顧客面諁E��程案�E',
  sales_outreach: '新規営業メール�E�一発提案／スチE��プ�E回！E,
  announcement: 'そ�E他�E案�E',
  freeform: '自由作�E�E�白紙から�E力！E,
};

const DEFAULT_TIMEREX_URL = 'https://timerex.net/s/mstcorp/c3dd3eea';

const documentCategory = (doc: any): DocumentType => {
  if (!doc || typeof doc !== 'object') return 'other';
  const docType = String(doc.document_type || '');
  const title = String(doc.title || '');
  if ((docType === 'proposal' || docType === 'other') && /見積/.test(title)) return 'estimate';
  if ((docType === 'diagnosis_report' || docType === 'report' || docType === 'proposal' || docType === 'other') && /月次|月報/.test(title)) return 'monthly_report';
  if (docType === 'report' || ((docType === 'proposal' || docType === 'other') && /診断レポート/.test(title))) return 'diagnosis_report';
  return (['diagnosis_report', 'proposal', 'estimate', 'contract', 'invoice', 'monthly_report'].includes(docType) ? docType : 'other') as DocumentType;
  if (doc.document_type === 'proposal' && /見穁E.test(doc.title || '')) return 'estimate';
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
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです。\n\n書類「{書類名}」をお送りいたします。メール本文内の書類内容、または下記のWeb確認ページ・PDFダウンロードURLよりご確認ください。\n\n書類名：{書類名}\nWeb確認・お申し込みURL：{書類URL}\nPDFダウンロードURL：{PDFダウンロードURL}\n\nご不明点やご質問がございましたら、本メールにご返信ください。',
    subject: '【書類送付】{書類名}�E�{会社名} 槁E,
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです、En\n下記�E書類！EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記URLよりWeb上でも�E容をご確認�Eお手続きぁE��だけます、En\n書類名�E�{書類名}\n確認URL�E�{書類URL}\n\nご不�E点めE��質問がござぁE��したら、本メールにご返信ください、E,
  },
  {
    category: 'document',
    channel: 'line',
    subject: '',
    body_text: '{お名前} 様\n書類「{書類名}」をご確認ください、En{書類URL}',
  },
  {
    category: 'form',
    channel: 'email',
    subject: '【ご回答�Eお願い】{フォーム名}�E�{会社名} 槁E,
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです、En\n「{フォーム名}」へのご回答をお願いぁE��します。下記URLからご利用ぁE��だけます、En{案�EURL}\n\nご不�E点は本メールにご返信ください、E,
  },
  {
    category: 'form',
    channel: 'line',
    subject: '',
    body_text: '{お名前} 様\n「{フォーム名}」へのご回答をお願いぁE��します、En{案�EURL}',
  },
  {
    category: 'diagnosis',
    channel: 'email',
    subject: '【診断のご案�E】{フォーム名}�E�{会社名} 槁E,
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです、En\n「{フォーム名}」をご案�EぁE��します。下記URLから診断を開始してください、En{案�EURL}\n\nご不�E点は本メールにご返信ください、E,
  },
  {
    category: 'diagnosis',
    channel: 'line',
    subject: '',
    body_text: '{お名前} 様\n「{フォーム名}」をご案�EぁE��します。こちらからご利用ください、En{案�EURL}',
  },
  {
    category: 'deal',
    channel: 'email',
    subject: '【商諁E��程�Eご案�E】{会社名} 槁E,
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです、En\n啁E��E�E日程調整につぁE��ご案�EぁE��します。下記予紁E�Eージから、ご都合�Eよい日時をお選びください、En{案�EURL}\n\n予紁E��定後、Googleカレンダーに予定が登録され、{ビデオチE�Eル名}の惁E��が案�Eされます、Enご不�E点は本メールにご返信ください、E,
  },
  {
    category: 'deal',
    channel: 'line',
    subject: '',
    body_text: '{お名前} 様\n啁E��E�E日程�Eこちらからお選びください、En{案�EURL}\n予紁E��定後、Googleカレンダーと{ビデオチE�Eル名}の惁E��が案�Eされます、E,
  },
  {
    category: 'customer_meeting',
    channel: 'email',
    subject: '【顧客面諁E�E日程調整】{会社名} 槁E,
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです、En\n次回�Eお打ち合わせ日程をご案�EぁE��します。下記予紁E�Eージから、ご都合�Eよい日時をお選びください、En{案�EURL}\n\n予紁E��定後、Googleカレンダーに予定が登録され、{ビデオチE�Eル名}の惁E��が案�Eされます、Enご不�E点は本メールにご返信ください、E,
  },
  {
    category: 'customer_meeting',
    channel: 'line',
    subject: '',
    body_text: '{お名前} 様\n次回�Eお打ち合わせ日程�Eこちらからご選択ください、En{案�EURL}',
  },
  {
    category: 'announcement',
    channel: 'email',
    subject: '【ご案�E】{会社名} 槁E,
    body_text: '{お名前} 様\n\nお世話になっております。有限会社MSTです、En\n{案�EURL}\n\nご不�E点は本メールにご返信ください、E,
  },
  {
    category: 'announcement',
    channel: 'line',
    subject: '',
    body_text: '{お名前} 様\n{案�EURL}',
  },
  {
    category: 'freeform',
    channel: 'email',
    subject: '',
    body_text: '',
  },
  {
    category: 'freeform',
    channel: 'line',
    subject: '',
    body_text: '',
  },
];

const documentMessage = (type: string | undefined, channel: DeliveryChannel, deliveryFormat: DocumentDeliveryFormat = 'web_link') => {
  const hi = '{お名前} 様';
  const intro = 'お世話になっております。有限会社MSTです。';
  const isReceiptOnly = type === 'invoice' || type === 'monthly_report';
  const details = isReceiptOnly
    ? '書類名：{書類名}\nWeb確認・受領連絡URL：{書類URL}\nPDFダウンロードURL：{PDFダウンロードURL}'
    : '書類名：{書類名}\nWeb確認・お申し込みURL：{書類URL}\nPDFダウンロードURL：{PDFダウンロードURL}';
  const attachDesc = (label: string) =>
    deliveryFormat === 'pdf_attachment'
      ? `${label}（PDF）を添付いたしましたので、ご確認のほどよろしくお願い申し上げます。\n下記Web確認ページからも${isReceiptOnly ? '内容の確認・受領連絡' : '内容の確認・お申し込み'}が可能です。`
      : `${label}をお送りいたします。本メール末尾の書面プレビュー、または下記のWeb確認ページ・PDFダウンロードURLよりご確認ください。`;
  const messages: Record<string, { subject: string; body: string; line: string }> = {
    proposal: {
      subject: '【ご提案書の送付】{書類名}｜{会社名} 様',
      body: hi + '\n\n' + intro + '\n\n' + attachDesc('診断結果・ご提案書') + '\n\n' + details,
      line: hi + '\n診断結果・ご提案書をお送りします。下記より内容をご確認ください。\n{書類名}\n{書類URL}',
    },
    diagnosis_report: {
      subject: '【診断レポート兼ご提案書のご送付】{書類名}｜{会社名} 様',
      body: hi + '\n\n' + intro + '\n\n' + attachDesc('診断レポート兼ご提案書') + '\n\n' + details,
      line: hi + '\n診断レポート兼ご提案書をお送りします。結果と今後の進め方をご確認ください。\n{書類名}\n{書類URL}',
const documentMessage = (type: string | undefined, channel: DeliveryChannel) => {
  const hi = '{お名前} 槁E;
  const intro = 'お世話になっております。有限会社MSTです、E;
  const details = '書類名�E�{書類名}\n確認URL�E�{書類URL}';
      subject: '【ご提案書の送付】{書類名}�E�{会社名} 槁E,
      body: hi + '\n\n' + intro + '\n\n診断結果・ご提案書�E�EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記リンクよりWeb上でも�E容をご確認いただけます。ご不�E点めE��希望がございましたらお知らせください、En\n' + details,
      line: hi + '\n診断結果・ご提案書をお送りします。�E容をご確認ください、En{書類名}\n{書類URL}',
      subject: '【診断レポ�Eト�Eご送付】{書類名}�E�{会社名} 槁E,
      body: hi + '\n\n' + intro + '\n\n診断結果をまとめたレポ�Eト！EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記リンクよりWeb上でも結果と今後�E進め方をご確認いただけます、En\n' + details,
      line: hi + '\n診断レポ�Eトをお送りします。結果と今後�E進め方をご確認ください、En{書類名}\n{書類URL}',
    },
    contract: {
      subject: '【契紁E�E容のご確認�E同意のお願い】{書類名}�E�{会社名} 槁E,
      body:
        hi +
        '\n\n' +
        intro +
        '\n\n' +
        attachDesc('業務委託基本契約書') +
        details +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '■ Webお申し込み・またはメール返信による契約合意\n' +
        'Web確認ページ内の「この内容で申し込む」ボタンからお手続きいただくか、契約締結の権限をお持ちの方より本メールへそのままご返信をお願いいたします。\n\n' +
        '【メール返信いただく場合の文面】\n' +
        '「{会社名}を代表して、契約書『{書類名}』の内容を確認し、有限会社MSTとの契約締結に同意します。\n' +
        '氏名：［氏名］\n' +
        '役職：［役職］」\n\n' +
        '※内容に修正希望がある場合は、同意文ではなく修正箇所をご返信ください。\n' +
        '※確認後、契約状態を締結済みに更新し契約記録として保存します。\n\n' +
        'ご確認のほど、何卒よろしくお願い申し上げます。',
      line: hi + '\n契約書をお送りします。内容をご確認のうえ、Web申込ボタンまたは契約権限をお持ちの方からのメール返信にてご承諾ください。\n{書類名}\n{書類URL}',
    },
    estimate: {
      subject: '【お見積書の送付】{書類名}｜{会社名} 様',
      body: hi + '\n\n' + intro + '\n\n' + attachDesc('お見積書') + '\n\n' + details,
      line: hi + '\nお見積書をお送りします。金額・有効期限・内容をご確認ください。\n{書類名}\n{書類URL}',
    invoice: {
      subject: '【請求書のご送付】{書類名}｜{会社名} 様',
      body: hi + '\n\n' + intro + '\n\n' + attachDesc('請求書') + '\n\n' + details,
      line: hi + '\n請求書をお送りします。金額・お支払期日・振込先をご確認のうえ、Web確認ページより受領連絡をお願いいたします。\n{書類名}\n{書類URL}',
    monthly_report: {
      subject: '【月次報告書のご送付】{書類名}｜{会社名} 様',
      body: hi + '\n\n' + intro + '\n\n' + attachDesc('月次報告書') + '\n\n' + details,
      line: hi + '\n月次報告書をお送りします。内容をご確認のうえ、Web確認ページより受領連絡をお願いいたします。\n{書類名}\n{書類URL}',
  };
  const message = messages[type || ''] || {
    subject: '【書類のご送付】{書類名}｜{会社名} 様',
    body: hi + '\n\n' + intro + '\n\n' + attachDesc('書類') + '\n\n' + details,
    line: hi + '\n書類をお送りします。内容をご確認ください。\n{書類名}\n{書類URL}',
        '\n\n業務委託基本契紁E���E�EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記リンクよりWeb上でも契紁E�E容をご確認いただけます、En\n' +
        '■ メール返信による契紁E��意�Eお願い\n' +
        '契紁E�E容をご確認いただき、問題がござぁE��せんでしたら、契紁E��結�E権限をお持ちの方より本メールへそ�Eままご返信をお願いぁE��します、En\n' +
        '【ご返信ぁE��だく文面】\n' +
        '「{会社名}を代表して、契紁E��『{書類名}』�E冁E��を確認し、有限会社MSTとの契紁E��結に同意します、En' +
        '氏名�E�［氏名�E�\n' +
        '役職�E�［役職�E�」\n\n' +
        '※冁E��に修正希望がある場合�E、同意文ではなく修正箁E��をご返信ください、En' +
        '※返信を確認後、契紁E��態を締結済みに更新します。ご返信ぁE��だぁE��メールと契紁E��は契紁E��録として保存します、En\n' +
        'ご確認�Eほど、何卒よろしくお願い申し上げます、E,
      line: hi + '\n契紁E��をお送りします。�E容をご確認ください。同意いただける場合�E、契紁E��結�E権限をお持ちの方からメールで明示皁E��ご返信ください、En{書類名}\n{書類URL}',
      subject: '【お見積書の送付】{書類名}�E�{会社名} 槁E,
      body: hi + '\n\n' + intro + '\n\nお見積書�E�EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記リンクよりWeb上でもお見積��額�E有効期限・ご提案�E容をご確認いただけます。�E容の調整めE��不�E点がございましたらお知らせください、En\n' + details,
      line: hi + '\nお見積書をお送りします。��額�E有効期限・冁E��をご確認ください、En{書類名}\n{書類URL}',
      subject: '【請求書のご送付】{書類名}�E�{会社名} 槁E,
      body: hi + '\n\n' + intro + '\n\n請求書�E�EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記リンクよりWeb上でも請求��額�Eお支払期日・振込先などの記載をご確認いただけます。お手続きのほどよろしくお願いぁE��します、En\n' + details,
      line: hi + '\n請求書をお送りします。��額�Eお支払期日・振込先をご確認ください、En{書類名}\n{書類URL}',
    subject: '【書類�Eご送付】{書類名}�E�{会社名} 槁E,
    body: hi + '\n\n' + intro + '\n\n書類！EDF�E�を添付いたしましたので、ご確認�Eほどよろしくお願い申し上げます、Enまた、下記リンクよりWeb上でも�E容をご確認いただけます。ご不�E点がございましたらお知らせください、En\n' + details,
    line: hi + '\n書類をお送りします。�E容をご確認ください、En{書類名}\n{書類URL}',
  };
  return channel === 'email' ? { category: 'document', channel, subject: message.subject, body_text: message.body } : { category: 'document', channel, subject: '', body_text: message.line };
};

const isStaleLegacyDocumentTemplate = (row: any, deliveryFormat: DocumentDeliveryFormat = 'web_link'): boolean => {
  if (!row || typeof row !== 'object') return false;
  const text = `${String(row.subject || '')}\n${String(row.body_text || '')}`;
  if (/下記リンクよりWeb上でも|添付のHTML書類ファイル|HTML書類（\.html）/.test(text)) return true;
  if (deliveryFormat !== 'pdf_attachment' && /PDFを添付いたしました|同じPDFファイルをご確認いただけます|PDF確認URL：/.test(text)) {
    return true;
  }
  return false;
};

const contractReplySection = '【メール返信による契約合意】\n契約内容に同意いただける場合は、契約締結の権限をお持ちの方から、このメールへの返信で次の文面をお送りください。\n\n「{会社名}を代表して、契約書『{書類名}』の内容を確認し、有限会社MSTとの契約締結に同意します。氏名：［氏名］　役職：［役職］」\n\n内容に修正希望がある場合は、同意文ではなく修正箇所をご返信ください。返信を確認後、契約状態を締結済みに更新します。ご返信いただいたメールと契約書は契約記録として保存してください。';
const contractReplySection = '【メール返信による契紁E��意】\n契紁E�E容に同意ぁE��だける場合�E、契紁E��結�E権限をお持ちの方から、このメールへの返信で次の斁E��をお送りください、En\n「{会社名}を代表して、契紁E��『{書類名}』�E冁E��を確認し、有限会社MSTとの契紁E��結に同意します。氏名�E�［氏名�E�　役職�E�［役職�E�」\n\n冁E��に修正希望がある場合�E、同意文ではなく修正箁E��をご返信ください。返信を確認後、契紁E��態を締結済みに更新します。ご返信ぁE��だぁE��メールと契紁E��は契紁E��録として保存してください、E;
const ensureContractReplySection = (body: string) =>
  body.includes('契紁E��結に同意しまぁE) || body.includes('メール返信による契紁E��愁E)
    ? body
    : body.trimEnd() + '\n\n' + contractReplySection;
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
  initialRecipientEmail,
  initialMode,
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
  const defaultMode = initialMode ?? (variant === 'page' ? 'history' : 'send');
  const [screen, setScreen] = useState<'send' | 'broadcast' | 'templates' | 'history'>(defaultMode);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [channel, setChannel] = useState<Channel>(initialChannel || 'email');
  const [templateChannel, setTemplateChannel] = useState<DeliveryChannel>(initialChannel === 'line' ? 'line' : 'email');
  const [documentType, setDocumentType] = useState<DocumentType>('estimate');
  const [documentDeliveryFormat, setDocumentDeliveryFormat] = useState<DocumentDeliveryFormat>('web_link');
  const [previewDocModal, setPreviewDocModal] = useState<any | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [bookingUrl, setBookingUrl] = useState('');
  const [videoTool, setVideoTool] = useState<'google_meet' | 'zoom'>(() => {
    try {
      const saved = localStorage.getItem('mst_video_tool');
      if (saved === 'zoom' || saved === 'google_meet') return saved;
    } catch {}
    return 'google_meet';
  });
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [companyIndustries, setCompanyIndustries] = useState<Record<string, string>>({});
  const [salesStep, setSalesStep] = useState<number>(0);
  // 第1通を手動で送ったあと、第2、E通を自動で予紁E��るか�E��E期�EOFF。送るた�EにOFFへ戻す！E  const [autoFollowups, setAutoFollowups] = useState(false);
  const [contactId, setContactId] = useState(initialContactId || '');
  const [unregisteredEmailWarning, setUnregisteredEmailWarning] = useState<string | null>(null);
  const userInteractedContactRef = useRef(false);
  const userInteractedDocumentRef = useRef(false);
  const [docId, setDocId] = useState(initialDocumentId || '');
  const [formId, setFormId] = useState(initialFormId || '');
  const [url, setUrl] = useState(() => (initialKind === 'deal' || initialKind === 'customer_meeting' ? DEFAULT_TIMEREX_URL : ''));
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
    fromName: '有限会社MST�E�経営・業務改喁E��援',
    fromEmail: 'contact@mstcorp.info',
    replyTo: 'contact@mstcorp.info',
  });
  const [savingSenderSettings, setSavingSenderSettings] = useState(false);
  const [customOneShotConfig, setCustomOneShotConfig] = useState<CustomOneShotConfig | null>(null);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [showDrawerSettings, setShowDrawerSettings] = useState(false);

  useEffect(() => {
    if (!isComposerExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        setIsComposerExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isComposerExpanded]);

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
    const savedForItem = [...templates].reverse().find((x) => x.template_key === key && !isStaleLegacyDocumentTemplate(x, documentDeliveryFormat));
    if (savedForItem) return savedForItem;
    if (kind === 'document') {
      const savedByType = [...templates].reverse().find((x) => x.template_key === 'document_' + activeDocumentType + '_' + deliveryChannel && !isStaleLegacyDocumentTemplate(x, documentDeliveryFormat));
      if (savedByType) return savedByType;
      return documentMessage(activeDocumentType, deliveryChannel, documentDeliveryFormat);
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

  const handleKindChange = (newKind: Kind) => {
    setKind(newKind);
    if (newKind === 'deal' || newKind === 'customer_meeting') {
      if (!url || url === DEFAULT_TIMEREX_URL || (bookingUrl && url === bookingUrl)) {
        setUrl(bookingUrl || DEFAULT_TIMEREX_URL);
      }
    } else if ((kind === 'deal' || kind === 'customer_meeting') && (url === DEFAULT_TIMEREX_URL || (bookingUrl && url === bookingUrl))) {
      setUrl('');
    }
  };

  const currentLinkUrl =
    (kind === 'form' || kind === 'diagnosis') && form
      ? window.location.origin + '/f/' + encodeURIComponent(form.public_slug) + (contact ? `?cid=${encodeURIComponent(contact.id)}` + (contact.line_user_id ? `&luid=${encodeURIComponent(contact.line_user_id)}` : '') : '')
      : kind === 'deal' || kind === 'customer_meeting'
      ? url.trim() || bookingUrl || DEFAULT_TIMEREX_URL
      : url.trim();

  const docViewUrl = doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : '';
  const safeCustomDocUrl = kind === 'document' && url.trim() && /\/(?:docs|apply|api\/public\/documents)\//.test(url.trim()) ? url.trim() : '';

  const vals: Record<string, string> = {
    ビデオチE�Eル吁E videoTool === 'zoom' ? 'Zoom' : 'Google Meet',
    video_tool_name: videoTool === 'zoom' ? 'Zoom' : 'Google Meet',
    お名前: contact?.full_name || 'ご担当者',
    会社名: companies[contact?.company_id || ''] || '貴社',
    フォーム名: form?.name || 'フォーム',
    書類名: doc?.title || '書類',
    書類URL: safeCustomDocUrl || docViewUrl,
    PDFダウンロードURL: doc ? window.location.origin + '/api/public/documents/' + encodeURIComponent(doc.id) + '/pdf?download=1' : '',
    書類本文: '',
    面談予約URL: bookingUrl || DEFAULT_TIMEREX_URL,
    案内URL: currentLinkUrl,
    お名剁E contact?.full_name || 'ご担当老E,
    会社吁E companies[contact?.company_id || ''] || '貴社',
    フォーム吁E form?.name || 'フォーム',
    書類名: doc?.title || '書顁E,
    書類URL: url.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''),
    書類本斁E '',
    面諁E��約URL: bookingUrl || DEFAULT_TIMEREX_URL,
    案�EURL: currentLinkUrl,

    // 英語キー互換
    recipient_name: contact?.full_name || 'ご担当老E,
    name: contact?.full_name || 'ご担当老E,
    company_name: companies[contact?.company_id || ''] || '貴社',
    form_title: form?.name || 'フォーム',
    document_title: doc?.title || '書類',
    document_url: safeCustomDocUrl || docViewUrl,
    pdf_download_url: doc ? window.location.origin + '/api/public/documents/' + encodeURIComponent(doc.id) + '/pdf?download=1' : '',
    document_title: doc?.title || '書顁E,
    document_url: url.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''),
    document_content: '',
    booking_url: bookingUrl || DEFAULT_TIMEREX_URL,
    link_url: currentLinkUrl,
  };

  const selectedCompanyId = contact?.company_id || initialCompanyId;
  const availableDocs = docs
    .filter((x) => (!selectedCompanyId || x.company_id === selectedCompanyId || x.id === docId || x.id === initialDocumentId) && (documentCategory(x) === documentType || x.id === docId || x.id === initialDocumentId))
    .sort((a, b) => documentOrder[documentCategory(a)] - documentOrder[documentCategory(b)]);

  const handleDocumentTypeChange = (newType: DocumentType) => {
    setDocumentType(newType);
    const matchingDocs = docs.filter(
      (x) =>
        (!selectedCompanyId || x.company_id === selectedCompanyId) &&
        documentCategory(x) === newType
    );
    if (matchingDocs.length > 0) {
      if (!doc || documentCategory(doc) !== newType) {
        setDocId(matchingDocs[0].id);
      }
    } else {
      setDocId('');
    }
  };

  useEffect(() => {
    if (docId && docs.length > 0 && !availableDocs.some((x) => x.id === docId)) {
      setDocId('');
    }
  }, [docId, contact?.company_id, initialCompanyId, docs, documentType]);

  useEffect(() => {
    if (initialMode) {
      setScreen(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialDocumentId) {
      setDocId(initialDocumentId);
      setKind('document');
      const targetDoc = docs.find((x) => x.id === initialDocumentId);
      if (targetDoc) {
        setDocumentType(documentCategory(targetDoc));
      }
    }
  }, [initialDocumentId, docs]);

  useEffect(() => {
    let ok = true;
    if (!db) return;
    Promise.all([
      db.from('contacts').select('id,full_name,email,line_user_id,company_id').order('full_name'),
      db.from('customer_documents').select('id,title,status,document_type,company_id,contact_id,body_html,created_at,updated_at').order('updated_at', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
      db.from('communication_templates').select('*'),
      db.from('companies').select('id,company_name,industry'),
      db.from('diagnosis_forms').select('id,name,public_slug,form_type,status').eq('status', 'published').order('created_at', { ascending: false }),
      db.from('sales_workspace_settings').select('booking_page_url').maybeSingle(),
      db.from('email_send_settings').select('sender_name,sender_email,reply_to_email').maybeSingle(),
      db.from('line_auto_reply_templates').select('*').order('created_at', { ascending: false }),
      db.from('marketing_automation_scenarios').select('scenario_id,config'),
    ])
      .then(([c, d, t, co, f, settings, emailSettings, lineTemplateResult, scenarioResult]) => {
        if (!ok) return;
        if (c.error) throw c.error;
        if (d.error) throw d.error;
        if (f.error) throw f.error;
        if (settings.error) throw settings.error;
        if (emailSettings.error) throw emailSettings.error;
        setForms(f.data || []);
        const fetchedBookingUrl = settings.data?.booking_page_url || DEFAULT_TIMEREX_URL;
        setBookingUrl(settings.data?.booking_page_url || '');
        if ((kind === 'deal' || kind === 'customer_meeting') && (!url || url === DEFAULT_TIMEREX_URL)) {
          setUrl(fetchedBookingUrl);
        }
        try {
          const savedVt = localStorage.getItem('mst_video_tool');
          if (savedVt === 'zoom' || savedVt === 'google_meet') {
            setVideoTool(savedVt);
          }
        } catch {}
        setSenderSettings({
          fromName: emailSettings.data?.sender_name || '有限会社MST�E�経営・業務改喁E��援',
          fromEmail: emailSettings.data?.sender_email || 'contact@mstcorp.info',
          replyTo: emailSettings.data?.reply_to_email || emailSettings.data?.sender_email || 'contact@mstcorp.info',
        });
        if (!co.error) {
          setCompanies(Object.fromEntries((co.data || []).map((x: any) => [x.id, x.company_name])));
          setCompanyIndustries(Object.fromEntries((co.data || []).map((x: any) => [x.id, x.industry || ''])));
        }
        const fetchedContacts = (c.data || []).filter((x: Contact) => !initialCompanyId || x.company_id === initialCompanyId);
        setContacts(fetchedContacts);
        const fetchedDocs = (d.data || []).filter((x: any) => !initialCompanyId || x.company_id === initialCompanyId || x.id === initialDocumentId);
        setDocs(fetchedDocs);
        if (initialFormId) setFormId(initialFormId);
        let resolvedContactId = initialContactId || '';
        if (initialContactId) {
          setContactId(initialContactId);
        } else if (initialRecipientEmail && !userInteractedContactRef.current) {
          const cleanEmail = initialRecipientEmail.trim().toLowerCase();
          const matched = fetchedContacts.find((ct: Contact) => (ct.email || '').trim().toLowerCase() === cleanEmail);
          if (matched) {
            resolvedContactId = matched.id;
            setContactId(matched.id);
            setUnregisteredEmailWarning(null);
          } else {
            setUnregisteredEmailWarning(initialRecipientEmail);
          }
        }
        if (initialDocumentId) {
          setDocId(initialDocumentId);
          setKind('document');
          const targetDoc = (d.data || []).find((x: any) => x.id === initialDocumentId);
          if (targetDoc) {
            setDocumentType(documentCategory(targetDoc));
            if (targetDoc.contact_id && !initialContactId && !initialRecipientEmail && !userInteractedContactRef.current) {
              setContactId(targetDoc.contact_id);
            } else if (targetDoc.company_id && !initialContactId && !initialRecipientEmail && !userInteractedContactRef.current) {
              const matchingContact = (c.data || []).find((ct: any) => ct.company_id === targetDoc.company_id);
              if (matchingContact) setContactId(matchingContact.id);
            }
          }
        } else if (initialKind === 'document' && !userInteractedDocumentRef.current) {
          const resolvedContact = fetchedContacts.find((ct: Contact) => ct.id === resolvedContactId);
          const targetCompanyId = resolvedContact?.company_id || initialCompanyId;
          const companyDocs = targetCompanyId ? fetchedDocs.filter((x: any) => x.company_id === targetCompanyId) : fetchedDocs;
          if (companyDocs.length > 0 && !companyDocs.some((x: any) => documentCategory(x) === documentType)) {
            const priority: DocumentType[] = ['proposal', 'diagnosis_report', 'estimate', 'contract', 'invoice', 'monthly_report', 'other'];
            const bestCat = priority.find((cat) => companyDocs.some((x: any) => documentCategory(x) === cat));
            if (bestCat) {
              const bestDoc = companyDocs.find((x: any) => documentCategory(x) === bestCat);
              setDocumentType(bestCat);
              if (bestDoc) setDocId(bestDoc.id);
            }
          }
        }
        if (!t.error) {
          setEmailTemplates((t.data || []) as any[]);
          if (t.data?.length) setTemplates([...seed.filter((x) => !t.data.some((row: any) => row.template_key === x.category + '_' + x.channel)), ...t.data]);
        }
        if (!lineTemplateResult.error) setLineTemplates((lineTemplateResult.data || []) as any[]);
        if (!scenarioResult.error && Array.isArray(scenarioResult.data)) {
          const matchedOneShot = scenarioResult.data.find(
            (row: any) => row.scenario_id === ONE_SHOT_SCENARIO_ID || String(row?.config?.name || '').includes('一発直琁E)
          );
          if (matchedOneShot?.config) {
            setCustomOneShotConfig({
              emailSubject: matchedOneShot.config.emailSubject || '',
              emailBody: matchedOneShot.config.emailBody || '',
            });
          }
        }
      })
      .catch((e) => ok && setError(e.message || '読み込みに失敗しました、E));
    return () => {
      ok = false;
    };
  }, [initialCompanyId, initialFormId, initialContactId, initialDocumentId, initialRecipientEmail]);

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
  }, [kind, channel, templateKey, templates, doc?.id, templateChannel, documentDeliveryFormat]);

  const applySalesStep = (stepNum: number, c = contact, oneShotOverride = customOneShotConfig) => {
    const compName = c?.company_id ? companies[c.company_id] || '貴社' : '貴社';
    const compInd = c?.company_id ? companyIndustries[c.company_id] || '' : '';
    const diagForm = forms.find((f: any) => f.form_type === 'diagnosis') || forms[0];
    const diagUrl = diagForm ? `${window.location.origin}/f/${encodeURIComponent(diagForm.public_slug)}${c ? `?cid=${encodeURIComponent(c.id)}` : ''}` : bookingUrl || url.trim();
    const outreach = stepNum === 0
      ? resolveOneShotOutreachDraft(oneShotOverride, compName, c?.full_name, compInd, diagUrl)
      : getSalesEmailTemplate(stepNum, compName, c?.full_name, compInd, diagUrl);
    setSubject(outreach.subject);
    setBody(outreach.body);
    if (diagUrl && diagUrl !== '{{diagnostic_url}}') setUrl(diagUrl);
    setBasis('特定電子メール法に基づく業務改喁E��報の提供（オプトアウト�E記！E);
  };

  useEffect(() => {
    if (kind === 'sales_outreach') {
      applySalesStep(salesStep, contact, customOneShotConfig);
    }
  }, [kind, salesStep, contact?.id, contact?.company_id, customOneShotConfig]);

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
      setError('ログインしてください、E);
      return;
    }
    const row = { owner_id: data.user.id, template_key: templateKey, category: kind, channel: templateChannel, subject, body_text: body };
    const { data: saved, error: e } = await db.from('communication_templates').upsert(row, { onConflict: 'owner_id,template_key' }).select('*').single();
    if (e) setError(e.message);
    else {
      const savedRow = saved || row;
      setTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
      setEmailTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
      setNotice('チE��プレートを保存しました、E);
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
      setError('ログインしてください、E);
      return;
    }
    const senderName = senderSettings.fromName.trim();
    const senderEmail = senderSettings.fromEmail.trim().toLowerCase();
    const replyTo = senderSettings.replyTo.trim().toLowerCase();
    const emailPattern = /^\S+@\S+\.\S+$/;
    if (!senderName || senderName.length > 100 || /[\r\n<>]/.test(senderName) || !emailPattern.test(senderEmail) || (replyTo && !emailPattern.test(replyTo))) {
      setError('差出人名�E差出人メールアドレス・返信先�E入力を確認してください、E);
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
      setNotice('メール送信の既定値を保存しました。�E端末で共通して使われます、E);
    } catch (e: any) {
      setError(e?.message || 'メール送信設定を保存できませんでした、E);
    } finally {
      setSavingSenderSettings(false);
    }
  };

  const send = async () => {
    if (!db || !contact) return;
    setError('');
    const targets: DeliveryChannel[] = channel === 'both' ? ['email', 'line'] : [channel];
    if (targets.includes('email') && (!senderSettings.fromName.trim() || !senderSettings.fromEmail.trim())) {
      setError('送信時�E差出人設定を入力して保存してください、E);
      return;
    }
    const hasDocUrl = Boolean(url.trim() || vals.document_url?.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''));
    if (!contact) {
      setError('送信先�E連絡先を選択してください、E);
      return;
    }
    if (targets.includes('email') && !contact.email) {
      setError(`、E{contact.full_name} 様」にはメールアドレスが登録されてぁE��せん。連絡先設定でメールアドレスを登録するか、LINE送信を選択してください。`);
      return;
    }
    if (targets.includes('line') && !contact.line_user_id) {
      setError(`、E{contact.full_name} 様」�ELINE公式アカウントと連携されてぁE��せん�E�EINE送信不可�E�。メール送信を選択してください。`);
      return;
    }
    if (kind === 'document' && (!doc || !hasDocUrl)) {
      setError('送信対象の書類を選択してください。上�E詳細設定から書類を選択できます、E);
      return;
    }
    if ((kind === 'form' || kind === 'diagnosis') && !vals.link_url.trim()) {
      setError('送信対象のフォーム・診断を選択してください�E�案�EURLが未設定です）。上�E詳細設定からフォームを選択できます、E);
      return;
    }
    if ((kind === 'deal' || kind === 'customer_meeting') && !vals.link_url.trim()) {
      setError('予紁E�EージURLが設定されてぁE��せん。URLを�E力してください、E);
      return;
    }
    if (!basis.trim()) {
      setError('送信根拠�E�法規�E同意記録�E�を入力してください、E);
      return;
    }
    if (kind === 'freeform' && !body.trim() && !(targets.includes('line') && selectedLineTemplate)) {
      setError('自由作�Eモードでは本斁E��入力してください、E);
      return;
    }
    if (initialCompanyId && contact.company_id && contact.company_id !== initialCompanyId) {
      setError('会社に紐づく連絡先を選択してください、E);
      return;
    }
    setBusy(true);
    try {
      if (doc && !['approved', 'sent'].includes(doc.status)) {
        await db.from('customer_documents').update({ status: 'approved' }).eq('id', doc.id);
        doc.status = 'approved';
      }
      const { data: sessionData } = await db.auth.getSession();
      if (!sessionData.session?.access_token) throw Error('ログイン状態を確認できません、E);
      if (targets.includes('line')) {
        const { data: friend, error: friendError } = await db.from('line_friends').select('status,consent_status').eq('line_user_id', contact.line_user_id).maybeSingle();
        if (friendError) throw friendError;
        const isStopped =
          friend &&
          (friend.status === 'blocked' ||
            friend.status === 'unfollowed' ||
            friend.consent_status === 'opted_out');
        if (isStopped) {
          throw Error('こ�E連絡先�EブロチE��また�E配信停止状態�EためLINE送信できません、E);
        }
        if (!friend || friend.status !== 'active' || friend.consent_status !== 'opted_in') {
          const ensureRes = await fetch('/api/line/friends/ensure-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session.access_token },
            body: JSON.stringify({ lineUserId: contact.line_user_id }),
          });
          const ensured = await ensureRes.json().catch(() => ({}));
          if (!ensureRes.ok || !ensured.canSendLine) {
            throw Error(ensured.error || 'LINEの友だち状態と配信同意を確認できません、E);
          }
        }
      }
      const rows = targets.map((target) => {
        const targetTemplate = target === 'email' && selectedEmailTemplate ? selectedEmailTemplate : resolveTemplate(target);
        const targetSubject = target === templateChannel ? subject : targetTemplate?.subject || '';
        const rawTargetBody = target === templateChannel ? body : targetTemplate?.body_text || '';
        const targetBody = kind === 'document' && activeDocumentType === 'contract' && target === 'email' ? ensureContractReplySection(rawTargetBody) : rawTargetBody;
        const targetLineTemplate = target === 'line' ? selectedLineTemplate : null;
        const linePayload = targetLineTemplate && targetLineTemplate.reply_type !== 'text' ? { type: targetLineTemplate.reply_type, ...fillPayload(targetLineTemplate.payload || {}) } : null;
        const finalBody = targetLineTemplate?.reply_type === 'text' ? String(targetLineTemplate.payload?.text || '') : linePayload ? `[${targetLineTemplate.reply_type === 'image' ? '画僁E : targetLineTemplate.reply_type === 'video' ? '動画' : 'Flex'}メチE��ージ]` : targetBody;
        return {
          channel: target,
          recipient_contact_id: contact.id,
          recipient_address: target === 'email' ? contact.email : contact.line_user_id,
          subject: target === 'email' ? fill(targetSubject, vals) : null,
          body_text: fill(finalBody, vals),
          line_message_payload: linePayload,
          document_id: kind === 'document' ? (doc?.id || null) : null,
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
            body: JSON.stringify({
              outboxId: row.id,
              ...(kind === 'document' && row.channel === 'email' ? { documentDeliveryFormat } : {}),
            }),
          });
          const result = await response.json().catch(() => ({}));
          return { channel: row.channel, ok: response.ok && result.status === 'sent', message: result.error || '' };
        }),
      );
      const summary = outcomes
        .map((x) => (x.channel === 'email' ? 'メール' : 'LINE'))
        .map((label, i) => {
          const outcome = outcomes[i];
          return label + (outcome.ok ? '送信済み' : '失敁E) + (outcome.message ? '�E�E + outcome.message + '�E�E : '');
        })
        .join(' / ');
      setNotice(summary);
      setPreview(false);
      const allOk = outcomes.length > 0 && outcomes.every((x) => x.ok);
      // 書類を送れたら、書類�E状態を「送信済み」にする(提案書は、対応する下書き�E記録も「送付済み」にする)
      if (allOk && doc) {
        try {
          if (doc.status !== 'sent') {
            await db.from('customer_documents').update({ status: 'sent' }).eq('id', doc.id);
            doc.status = 'sent';
          }
          await db.from('proposal_drafts').update({ status: 'sent' }).eq('document_id', doc.id).eq('status', 'approved');
          // こ�E書類に紐づく契紁E�E請求�E状態も進める(契紁E メール送付済み / 請汁E 発行済み)。取消�E締結済み・入金済みなど先�E状態�E動かさなぁE��E          await db.from('customer_contracts').update({ status: 'sent' }).eq('document_id', doc.id).in('status', ['draft', 'under_review']);
          await db.from('customer_invoices').update({ status: 'issued' }).eq('document_id', doc.id).in('status', ['draft', 'awaiting_approval']);
          window.dispatchEvent(new CustomEvent('mst:documents-changed'));
        } catch {
          // 状態�E更新に失敗しても、E��信そ�Eも�Eは成功してぁE��ため通知は変えなぁE        }
      }
      if (allOk && kind === 'sales_outreach' && salesStep === 1 && autoFollowups && targets.includes('email')) {
        try {
          const followRes = await fetch('/api/marketing/outreach-followups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session!.access_token },
            body: JSON.stringify({ contactId: contact.id }),
          });
          const followBody = await followRes.json().catch(() => ({}));
          if (followRes.ok && followBody.scheduled > 0) {
            setNotice(`${summary} / 第2、E通�E自動送信を予紁E��ました�E�E{followBody.scheduled}件�E�`);
          } else {
            setNotice(`${summary} / 2通目以降�E予紁E ${followBody.error || followBody.message || '予紁E��きませんでした'}`);
          }
        } catch {
          setNotice(`${summary} / 2通目以降�E予紁E��失敗しました。もぁE��度お試しください。`);
        }
      }
      if (allOk && kind === 'sales_outreach') setAutoFollowups(false);
      if (allOk) {
        if (targets.includes('line') && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mst_inbox_counts_updated'));
        }
        onDraftChange?.(false);
        onSent?.({ ok: true, summary });
      } else {
        const failedOutcomes = outcomes.filter((x) => !x.ok);
        setError(failedOutcomes.map((x) => `${x.channel === 'email' ? 'メール' : 'LINE'}送信エラー: ${x.message || '配信先�E設定をご確認ください'}`).join(' / '));
      }
    } catch (e: any) {
      setError(e.message || '送信に失敗しました、E);
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
            <span className="font-semibold">遷移允E�E画面:</span>
            <span className="font-bold">{originTabLabel || originTab}</span>
          </div>
          <button
            type="button"
            onClick={onReturnToOrigin}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>允E�E画面に戻めE/span>
          </button>
        </div>
      )}

      {/* ── Top Header (Only on standalone page) ── */}
      {variant === 'page' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">メール・LINE送信管琁E/h1>

          {/* 画面刁E��替えタチE*/}
          <div className="flex flex-wrap items-center gap-1.5">
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
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>送信履歴</span>
            </button>
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
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SendHorizonal className="h-3.5 w-3.5" />
              <span>個別送信�E�E対1�E�E/span>
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
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>一斉�E信�E�E対N�E�E/span>
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
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Library className="h-3.5 w-3.5" />
              <span>斁E���ELINE素材ストック</span>
            </button>

            {onNavigateTab && (
              <div className="flex items-center gap-1.5 sm:ml-2 sm:pl-2 sm:border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => onNavigateTab('inbox_hub')}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="受信トレイを開ぁE
                >
                  <Inbox className="h-3.5 w-3.5 text-purple-600" />
                  <span>受信トレイ</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('document_templates')}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="提案書・見積書・契紁E��・請求書の作�Eを開ぁE
                >
                  <FileText className="h-3.5 w-3.5 text-purple-600" />
                  <span>書類作�E</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer Mode Top Summary Badge */}
      {variant === 'drawer' && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-purple-100 text-purple-800 font-bold px-2 py-0.5 border border-purple-200">
              {labels[kind] || kind}
            </span>
            {contact && (
              <span className="text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                宛�E: <strong className="text-slate-900">{contact.full_name} 槁E/strong> {companies[contact.company_id || ''] && `(${companies[contact.company_id || '']})`}
              </span>
            )}
            {kind === 'document' && doc && (
              <span className="text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                書顁E <strong className="text-purple-700">{doc.title}</strong>
              </span>
            )}
            {(kind === 'form' || kind === 'diagnosis') && form && (
              <span className="text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                フォーム: <strong className="text-purple-700">{form.name}</strong>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDrawerSettings((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors shrink-0"
            title="宛�E・書類�E差出人・斁E��などの詳細設定を表示/非表示"
          >
            <Settings2 className="h-3.5 w-3.5 text-purple-600" />
            <span>{showDrawerSettings ? '詳細設定を閉じめE : '宛�E・詳細設宁E}</span>
            {showDrawerSettings ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </button>
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
              <span>允E�E画面に戻る！EoriginTabLabel || originTab}�E�E/span>
            </button>
          )}
        </div>
      )}

      {/* 画面1: 一斉�E信�E�E対N�E�E*/}
      {screen === 'broadcast' && (
        <MarketingBroadcastView initialChannel={initialBroadcastChannel} />
      )}

      {/* 画面2: 個別送信�E�E対1�E�E*/}
      {screen === 'send' && (
        <>
          {/* ドロワー表示時！Eariant === 'drawer'�E�E 詳細設定（上部アコーチE��オン�E��E 件名�E本斁EↁE送信ボタン の頁E��配置 */}
          {variant === 'drawer' && (
            <div className="space-y-4">

              {/* ① 詳細設定トグルボタン�E�最上部�E�！EアコーチE��オンエリア */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDrawerSettings((prev) => !prev)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="h-4 w-4 text-purple-600" />
                    <span>宛�E・書類�E送信方法�E差出人の変更�E�詳細設定！E/span>
                  </span>
                  {showDrawerSettings ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </button>
                {/* アコーチE��オン展開エリア�E�トグルの直下！E*/}
                {showDrawerSettings && (
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700">
                      送信冁E��
                      <select
                        value={kind}
                        onChange={(e) => handleKindChange(e.target.value as Kind)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        {Object.entries(labels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-700">
                      送信方況E                      <select
                        value={channel}
                        onChange={(e) => {
                          const next = e.target.value as Channel;
                          setChannel(next);
                          if (next !== 'both') setTemplateChannel(next);
                        }}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        <option value="email">メール</option>
                        <option value="line">LINE</option>
                        <option value="both">メール �E�ELINE�E�同時送信�E�E/option>
                      </select>
                    </label>
                    <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                      送信允E                      <select
                        value={contactId}
                        onChange={(e) => {
                          userInteractedContactRef.current = true;
                          setContactId(e.target.value);
                        }}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        <option value="">連絡先を選択してください</option>
                        {contacts.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.full_name} · {companies[x.company_id || ''] || '未設宁E} ·{' '}
                            {channel === 'both'
                              ? `${x.email ? 'メールあり' : 'メール未登録'} · ${x.line_user_id ? 'LINE連携' : 'LINE未連携'}`
                              : channel === 'email'
                              ? x.email || 'メール未登録'
                              : x.line_user_id ? 'LINE連携' : 'LINE未連携'}
                          </option>
                        ))}
                      </select>
                      {unregisteredEmailWarning && !contactId && (
                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 shadow-2xs">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>こ�Eメールアドレスは連絡先に未登録です。�Eに連絡先を登録してください</span>
                        </div>
                      )}
                    </label>
                    {/* 斁E��ストック */}
                    {templateChannel === 'email' && (
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">メール斁E��ストック�E�任意引用�E�E/label>
                        <select
                          value={selectedEmailTemplateId}
                          onChange={(e) => chooseEmailTemplate(e.target.value)}
                          className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                        >
                          <option value="">現在の送信種別�E�Elabels[kind]}�E��E標準�E期文面</option>
                          {emailTemplates
                            .filter((x) => {
                              if (x.channel !== 'email') return false;
                              const key = String(x.template_key || '').trim();
                              const trimmedName = String(x.name || '').trim();
                              return key.startsWith('tpl_') || Boolean(trimmedName && trimmedName !== key);
                            })
                            .map((x: any) => (
                              <option key={x.id} value={x.id}>{x.name?.trim() || x.template_key}</option>
                            ))}
                        </select>
                      </div>
                    )}
                    {templateChannel === 'line' && (
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">LINE斁E���E素材ストック�E�任意引用�E�E/label>
                        <select
                          value={selectedLineTemplateId}
                          onChange={(e) => chooseLineTemplate(e.target.value)}
                          className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                        >
                          <option value="">現在の送信種別�E�Elabels[kind]}�E��E標準テキスチE/option>
                          {lineTemplates.map((x: any) => (
                            <option key={x.id} value={x.id}>
                              {x.name}�E�Ex.reply_type === 'text' ? 'チE��スチE : x.reply_type === 'image' ? '画僁E : x.reply_type === 'video' ? '動画' : 'Flex'}�E�E                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {kind === 'sales_outreach' && (
                      <div className="md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5">
                        <label className="block text-xs font-bold text-purple-900">
                          営業メール種別�E�Econtact?.company_id ? (companies[contact.company_id] || '選択中') + (' · 業種: ' + (companyIndustries[contact.company_id] || '一般・未設宁E)) : '送信先を選ぶと業種・社名を自動反映'}�E�E                          <select
                            value={salesStep}
                            onChange={(e) => {
                              const s = Number(e.target.value);
                              setSalesStep(Number.isFinite(s) ? s : 0);
                              applySalesStep(Number.isFinite(s) ? s : 0);
                            }}
                            className="mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600"
                          >
                            <option value={0}>【一発直琁E��案】IT拁E��＋経営サポ�Eト「社外右腕」�Eご提案（単発メール�E�E/option>
                            <option value={1}>、EスチE��プ�E回】業界急所提起 �E�E3刁E��料診断ギフト�E�送信征E、E通目の自動追客可�E�E/option>
                          </select>
                        </label>
                        {salesStep === 1 && channel !== 'line' && (
                          <label className="flex items-start gap-2 rounded-lg border border-purple-200 bg-white p-2.5 text-xs text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoFollowups}
                              onChange={(e) => setAutoFollowups(e.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-purple-600"
                            />
                            <span>
                              <strong className="text-purple-900">2通目以降も自動で送る</strong>
                              �E�第1通�E3日・6日・9日・12日後、E、E8時に送信�E�E                            </span>
                          </label>
                        )}
                      </div>
                    )}
                    {/* 書類関連 */}
                    {kind === 'document' && (
                      <>
                        <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                          書類�E種顁E                          <select
                            value={documentType}
                            onChange={(e) => {
                              userInteractedDocumentRef.current = true;
                              handleDocumentTypeChange(e.target.value as DocumentType);
                            }}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                          >
                            <option value="proposal">提案書�E�診断結果�E�ご提案！E/option>
                            <option value="estimate">見積書</option>
                            <option value="invoice">請求書</option>
                            <option value="contract">契紁E��</option>
                            <option value="monthly_report">月次報告書</option>
                            {(documentType === 'diagnosis_report' || docs.some((x) => documentCategory(x) === 'diagnosis_report')) && (
                              <option value="diagnosis_report">診断レポ�Eト（旧単体�E互換�E�E/option>
                            )}
                            <option value="other">そ�E仁E/option>
                          </select>
                        </label>
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            書類（確定書類�Eみ送信可能�E�E                            <select
                              value={docId}
                              onChange={(e) => {
                                userInteractedDocumentRef.current = true;
                                setDocId(e.target.value);
                              }}
                              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                            >
                              <option value="">書類を選択してください</option>
                              {availableDocs.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.title} · {({ draft: '作�E中', awaiting_approval: '作�E中', approved: '確定（送付可能�E�E, queued: '送信征E��', sent: '送信済み', failed: '送信失敁E, archived: '保管' } as Record<string, string>)[x.status] || x.status}
                                </option>
                              ))}
                            </select>
                          </label>
                          {availableDocs.length === 0 && (
                            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                              <span>選択した会社には、この種類�E書類がまだありません、E/span>
                              {onNavigateTab && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('document_templates')}
                                  className="font-bold text-purple-700 hover:underline shrink-0 cursor-pointer"
                                >
                                  書類作�Eへ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
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
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                        >
                          <option value="">公開フォームを選択してください</option>
                          {forms.map((f: any) => (
                            <option key={f.id} value={f.id}>{f.name} · {f.form_type}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                      {kind === 'document' ? '共有可能な書類URL' : kind === 'deal' || kind === 'customer_meeting' ? '面諁E���EURL�E�EimeRex予約URL�E�E : 'フォーム・案�EURL'}
                      <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" placeholder="https://..." />
                    </label>

                    {/* 面諁E���E時�Eビデオ会議チE�Eル刁E��替え！Eoogle Meet / Zoom�E�E*/}
                    {(kind === 'deal' || kind === 'customer_meeting') && (
                      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-purple-50/70 border border-purple-200">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-purple-900">面諁E��チE��チE�Eル:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setVideoTool('google_meet');
                              try { localStorage.setItem('mst_video_tool', 'google_meet'); } catch {}
                              setBody((prev) => prev.replace(/Zoom/g, 'Google Meet'));
                            }}
                            className={`px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              videoTool === 'google_meet'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Google Meet
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVideoTool('zoom');
                              try { localStorage.setItem('mst_video_tool', 'zoom'); } catch {}
                              setBody((prev) => prev.replace(/Google Meet|Meet/g, 'Zoom'));
                            }}
                            className={`px-3 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              videoTool === 'zoom'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Zoom
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          予約URL: <span className="font-mono text-purple-700 font-semibold">{bookingUrl || 'https://timerex.net/s/mstcorp/c3dd3eea'}</span>
                          {!bookingUrl && <span className="text-[10px] text-slate-400 ml-1">�E�標準TimeRex�E�E/span>}
                        </span>
                      </div>
                    )}
                    {/* 差出人設宁E*/}
                    {(channel === 'email' || channel === 'both') && (
                      <>
                        <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                          差出人吁E                          <input
                            value={senderSettings.fromName}
                            onChange={(e) => setSenderSettings((x) => ({ ...x, fromName: e.target.value }))}
                            maxLength={100}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                            placeholder="有限会社MST"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">
                          差出人メールアドレス
                          <input
                            type="email"
                            value={senderSettings.fromEmail}
                            onChange={(e) => setSenderSettings((x) => ({ ...x, fromEmail: e.target.value }))}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">
                          返信先！Eeply-To�E�E                          <div className="flex gap-1.5 mt-1">
                            {senderSettings.fromEmail && senderSettings.replyTo !== senderSettings.fromEmail && (
                              <button type="button" onClick={() => setSenderSettings((x) => ({ ...x, replyTo: x.fromEmail }))}
                                className="text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-0.5 rounded font-semibold cursor-pointer border border-purple-200">
                                公式ドメインに戻ぁE                              </button>
                            )}
                            {senderSettings.replyTo !== 'mst.shikumikaizen@gmail.com' && (
                              <button type="button" onClick={() => setSenderSettings((x) => ({ ...x, replyTo: 'mst.shikumikaizen@gmail.com' }))}
                                className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded font-medium cursor-pointer border border-slate-300">
                                緊急用Gmailに刁E��
                              </button>
                            )}
                          </div>
                          <input
                            type="email"
                            value={senderSettings.replyTo}
                            onChange={(e) => setSenderSettings((x) => ({ ...x, replyTo: e.target.value }))}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                          />
                        </label>
                        <div className="md:col-span-2">
                          <button
                            type="button"
                            disabled={savingSenderSettings}
                            onClick={() => void saveSenderSettings()}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                          >
                            <Save className="h-3.5 w-3.5" />
                            {savingSenderSettings ? '保存中…' : '差出人既定値を保孁E}
                          </button>
                        </div>
                      </>
                    )}
                    <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                      送信根拠�E�法規�E同意記録�E�E                      <input
                        value={basis}
                        onChange={(e) => setBasis(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* ② 件名�E劁E(メールの場吁E */}
              {templateChannel === 'email' && (
                <div>
                  <label className="text-xs font-bold text-slate-800">件吁E/label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs font-medium"
                    placeholder="件名を入劁E.."
                  />
                  <PlaceholderAssist text={subject} onInsert={(token) => setSubject((curr) => curr + token)} />
                </div>
              )}

              {/* メール+LINE同時送信時�E刁E��タチE*/}
              {channel === 'both' && (
                <div className="flex items-center gap-2 rounded-xl bg-purple-50/50 p-2 text-xs text-slate-700 border border-purple-200">
                  <span className="font-semibold text-purple-900 text-[11px]">編雁E��象:</span>
                  <button
                    type="button"
                    onClick={() => setTemplateChannel('email')}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  >
                    メール斁E��
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateChannel('line')}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'line' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  >
                    LINE斁E��
                  </button>
                </div>
              )}

              {/* ③ 本斁E�E力エリア */}
              {(templateChannel !== 'line' || !selectedLineTemplate || selectedLineTemplate.reply_type === 'text') && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-800">本斁E/label>
                      {(kind === 'document' || kind === 'form' || kind === 'diagnosis') && (
                        <span className="text-[11px] font-medium text-purple-700">
                          {kind === 'document' ? doc?.title || '書類テンプレーチE : form?.name || 'フォーム'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmailTemplateId('');
                          setSelectedLineTemplateId('');
                          if (templateChannel === 'email') setSubject('');
                          setBody('');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                        title="現在の件名�E本斁E��白紙状態にクリア"
                      >
                        <Eraser className="h-3 w-3 text-slate-500" />
                        <span>白紙化</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsComposerExpanded(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                        title="斁E��作�Eエリアを�E画面表示"
                      >
                        <Maximize2 className="h-3 w-3 text-purple-600" />
                        <span>全画面</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="mt-1 block w-full min-h-[200px] resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 font-sans leading-relaxed focus:border-purple-600 focus:outline-none shadow-2xs"
                    placeholder="本斁E��入力してください..."
                  />
                  {templateChannel === 'email' && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      ※ メール送信時�E末尾に統一署名（有限会社MST・住所・HP・Mail�E�が自動付与されます、E                    </p>
                  )}
                  <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
                </div>
              )}

              {/* ④ 添付書類サマリー�E�ドロワー表示用�E�E*/}
              {kind === 'document' && doc && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-2.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                      <span className="font-bold text-purple-950 truncate">{doc.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-white border border-purple-200 text-purple-700 shrink-0">
                        {documentDeliveryFormat === 'web_link'
                          ? 'メール内表示＋Web/PDFリンク'
                          : 'PDF直接添付'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`/api/documents/${encodeURIComponent(doc.id)}/pdf?download=1`}
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>PDF保存</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewDocModal(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-100/80 text-xs font-bold cursor-pointer shadow-2xs"
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>書類プレビュー</span>
                      </button>
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-bold text-purple-950 truncate">{doc.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-white border border-purple-200 text-purple-700 shrink-0">
                      PDF自動添仁E                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`/api/documents/${encodeURIComponent(doc.id)}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>PDF確誁E/span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreviewDocModal(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-100/80 text-xs font-bold cursor-pointer shadow-2xs"
                      <Eye className="w-3.5 h-3.5 text-purple-600" />
                      <span>書類�Eレビュー</span>
                    </button>
                  </div>
                  {channel !== 'line' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-200/70">
                      <span className="text-[11px] font-bold text-purple-900">送付形式:</span>
                      <select
                        value={documentDeliveryFormat}
                        onChange={(e) => setDocumentDeliveryFormat(e.target.value as DocumentDeliveryFormat)}
                        className="rounded-lg border border-purple-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                      >
                        <option value="web_link">メール本文に書類表示＋Web確認・PDFダウンロードURL（Drive電子署名なし／推奨）</option>
                        <option value="pdf_attachment">PDF（.pdf）をメール直接添付（※Gmail側でDrive署名表示が出る場合あり）</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* ⑤ プレビュー・送信ボタン */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {!preview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      if (!contact) {
                        setError('送信先を選択してください。上�E「詳細設定」から選択できます、E);
                        setShowDrawerSettings(true);
                        return;
                      }
                      if (kind === 'document' && !doc) {
                        setError('送信する書類を選択してください。上�E「詳細設定」から選択できます、E);
                        setShowDrawerSettings(true);
                        return;
                      }
                      if ((kind === 'form' || kind === 'diagnosis') && !form) {
                        setError('フォームを選択してください。上�E「詳細設定」から選択できます、E);
                        setShowDrawerSettings(true);
                        return;
                      }
                      setPreview(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs shadow-purple-600/20 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    送信プレビューを確誁E                  </button>
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
                <button
                  type="button"
                  onClick={() => void save()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  title="斁E��をテンプレートとして保孁E
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>チE��プレート保孁E/span>
                </button>
              </div>
            </div>
          )}

          {/* フォーム設定欁E ペ�Eジ表示時�Eみ常時表示�E�ドロワー表示時�E上部アコーチE��オンで対応！E*/}
          {variant === 'page' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                送信冁E��
                <select
                  value={kind}
                  onChange={(e) => handleKindChange(e.target.value as Kind)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                送信方況E                <select
                  value={channel}
                  onChange={(e) => {
                    const next = e.target.value as Channel;
                    setChannel(next);
                    if (next !== 'both') setTemplateChannel(next);
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="email">メール</option>
                  <option value="line">LINE</option>
                  <option value="both">メール �E�ELINE�E�同時送信�E�E/option>
                </select>
              </label>
              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                送信允E                <select
                  value={contactId}
                  onChange={(e) => {
                    userInteractedContactRef.current = true;
                    setContactId(e.target.value);
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="">連絡先を選択してください</option>
                  {contacts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.full_name} · {companies[x.company_id || ''] || '未設宁E} ·{' '}
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
                {unregisteredEmailWarning && !contactId && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>こ�Eメールアドレスは連絡先に未登録です。�Eに連絡先を登録してください</span>
                  </div>
                )}
              </label>

              {kind === 'sales_outreach' && (
                <div className="md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5">
                  <label className="block text-xs font-bold text-purple-900">
                    営業メール種別�E�Econtact?.company_id ? (companies[contact.company_id] || '選択中') + (' · 業種: ' + (companyIndustries[contact.company_id] || '一般・未設宁E)) : '送信先を選ぶと業種・社名を自動反映'}�E�E                    <select
                      value={salesStep}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        setSalesStep(Number.isFinite(s) ? s : 0);
                        applySalesStep(Number.isFinite(s) ? s : 0);
                      }}
                      className="mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600"
                    >
                      <option value={0}>【一発直琁E��案】IT拁E��＋経営サポ�Eト「社外右腕」�Eご提案（単発メール�E�E/option>
                      <option value={1}>、EスチE��プ�E回】業界急所提起 �E�E3刁E��料診断ギフト�E�送信征E、E通目の自動追客可�E�E/option>
                    </select>
                  </label>
                  <p className="text-[11px] text-purple-800">
                    ※ 送信時に署名（社名�E住所・HP・Mail�E�と配信停止リンクが�E動で付きます。見込み企業リストから一括・予紁E��リガー発火することもできます、E                  </p>
                  {salesStep === 1 && channel !== 'line' && (
                    <label className="flex items-start gap-2 rounded-lg border border-purple-200 bg-white p-2.5 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoFollowups}
                        onChange={(e) => setAutoFollowups(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-purple-600"
                      />
                      <span>
                        <strong className="text-purple-900">2通目以降も自動で送る</strong>
                        �E�第1通�E3日・6日・9日・12日後、E、E8時に送信�E�E                        <span className="block text-[11px] text-slate-500">
                          返信・診断の回答�E面諁E�E予紁E�E配信停止・不達があれ�E、残りは自動で止まります、E通だけ送る場合�EチェチE��しなぁE��ください、E                        </span>
                      </span>
                    </label>
                  )}
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
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
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
                    書類�E種顁E                    <select
                      value={documentType}
                      onChange={(e) => {
                        userInteractedDocumentRef.current = true;
                        handleDocumentTypeChange(e.target.value as DocumentType);
                      }}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                    >
                      <option value="proposal">提案書�E�診断結果�E�ご提案！E/option>
                      <option value="estimate">見積書</option>
                      <option value="invoice">請求書</option>
                      <option value="contract">契紁E��</option>
                      <option value="monthly_report">月次報告書</option>
                      {(documentType === 'diagnosis_report' || docs.some((x) => documentCategory(x) === 'diagnosis_report')) && (
                        <option value="diagnosis_report">診断レポ�Eト（旧単体�E互換�E�E/option>
                      )}
                      <option value="other">そ�E仁E/option>
                    </select>
                  </label>
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      書類！Econtact?.company_id ? (companies[contact.company_id] || '選択した会社') + 'の書顁E : initialCompanyId ? (companies[initialCompanyId] || 'こ�E会社') + 'の書顁E : '送信先を選ぶと会社の書類で絞り込み'}・確定書類�Eみ送信可能�E�E                      <select
                        value={docId}
                        onChange={(e) => {
                          userInteractedDocumentRef.current = true;
                          setDocId(e.target.value);
                        }}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        <option value="">書類を選択してください</option>
                        {availableDocs.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title} · {({ draft: '作�E中', awaiting_approval: '作�E中', approved: '確定（送付可能�E�E, queued: '送信征E��', sent: '送信済み', failed: '送信失敁E, archived: '保管' } as Record<string, string>)[x.status] || x.status}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* 添付書類�EレビューカーチE& アクション */}
                    {doc ? (
                      <div className="space-y-2">
                        <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-purple-950 truncate">{doc.title}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-white border border-purple-200 text-purple-700">
                                  {({ draft: '作�E中', awaiting_approval: '作�E中', approved: '確定（送付可能�E�E, queued: '送信征E��', sent: '送信済み' } as Record<string, string>)[doc.status] || doc.status}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {contact?.company_id && companies[contact.company_id] ? `${companies[contact.company_id]} 宛` : ''} ·{' '}
                                {documentDeliveryFormat === 'web_link'
                                  ? 'メール内書類プレビュー ＋ Web確認URL ＋ PDFダウンロードURL送付'
                                  : 'PDFファイル直接添付 ＋ Web確認URL送付'}
                                {contact?.company_id && companies[contact.company_id] ? `${companies[contact.company_id]} 宛` : ''} · PDF自動添仁E&amp; Web確認URL自動挿入
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`/api/documents/${encodeURIComponent(doc.id)}/pdf?download=1`}
                              download
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title="PDFファイルを直接ダウンロード確認"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>PDF保存</span>
                              title="メールに添付されるPDFファイルをダウンロード確誁E
                              <span>PDF確誁E/span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal(doc)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-100/80 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-600" />
                              <span>書類をプレビュー</span>
                            </button>
                          </div>
                        </div>
                        {channel !== 'line' && (
                          <div className="rounded-xl border border-purple-200 bg-white p-3 space-y-1.5">
                            <label className="block text-[11px] font-bold text-slate-800">
                              メール送付形式（Googleドライブの電子署名表示を回避）
                              <select
                                value={documentDeliveryFormat}
                                onChange={(e) => setDocumentDeliveryFormat(e.target.value as DocumentDeliveryFormat)}
                                className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                              >
                                <option value="web_link">メール本文に書類表示 ＋ Web確認・PDFダウンロードURL（Drive電子署名なし／推奨）</option>
                                <option value="pdf_attachment">PDF（.pdf）をメール直接添付（※Gmail側でDrive電子署名が表示される場合あり）</option>
                              </select>
                            </label>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {documentDeliveryFormat === 'web_link'
                                ? '※ 添付ファイルでのソースコード表示やGoogleドライブの電子署名表示を防ぎ、メール本文内に整形済みの書類プレビューとWeb確認ボタン・PDF直接ダウンロードボタンを表示します。'
                                : '※ A4 PDFファイルを直接メール添付します。受信側のGmail仕様により、Gmail上でPDFを開いた際にGoogleドライブの「電子署名をリクエスト」が表示される場合があります。'}
                            </p>
                          </div>
                        )}
                        <div className="rounded-lg bg-purple-100/70 px-3 py-1.5 text-[11px] text-purple-950 flex items-center gap-1.5">
                          <span className="font-bold">📎 自動PDF添仁E</span>
                          <span>メール送信時、この書類�EA4 PDFが�E動生成されて添付ファイルとして送信されます！Eeb確認URLも本斁E��記載）、E/span>
                        </div>
                      </div>
                    ) : availableDocs.length === 0 ? (
                      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                        <span>選択した会社には、この種類�E書類がまだありません、E/span>
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('document_templates')}
                            className="font-bold text-purple-700 hover:underline shrink-0 cursor-pointer"
                          >
                            書類作�Eへ
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        ※ 上記で書類を選択すると、�E容のプレビュー確認ができます、E                      </div>
                    )}
                  </div>
                </>
              )}

              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                {kind === 'document' ? '共有可能な書類URL' : kind === 'deal' || kind === 'customer_meeting' ? '面諁E���EURL�E�EimeRex予約URL�E�E : 'フォーム・案�EURL'}
                <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" placeholder="https://..." />
              </label>

              {(channel === 'email' || channel === 'both') && (
                <>
                  <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                    差出人吁E                    <input
                      value={senderSettings.fromName}
                      onChange={(e) => setSenderSettings((x) => ({ ...x, fromName: e.target.value }))}
                      maxLength={100}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      placeholder="有限会社MST"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    差出人メールアドレス
                    <input
                      type="email"
                      value={senderSettings.fromEmail}
                      onChange={(e) => setSenderSettings((x) => ({ ...x, fromEmail: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      placeholder="info@example.co.jp"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">RESEND_FROM_EMAILで認証済みのドメインを指定してください、E/span>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5">
                        返信先メールアドレス�E�Eeply-To�E�E                        {senderSettings.replyTo.trim() === (senderSettings.fromEmail || 'contact@mstcorp.info').trim() ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            企業ドメイン�E�推奨�E�E                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            個別・緊急用
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {senderSettings.fromEmail && senderSettings.replyTo !== senderSettings.fromEmail && (
                          <button
                            type="button"
                            onClick={() => setSenderSettings((x) => ({ ...x, replyTo: x.fromEmail }))}
                            className="text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-0.5 rounded font-semibold cursor-pointer border border-purple-200 transition-colors"
                            title="差出人メールアドレス�E��E式企業ドメイン�E�に戻しまぁE
                          >
                            公式ドメイン�E�推奨�E�に戻ぁE                          </button>
                        )}
                        {senderSettings.replyTo !== 'mst.shikumikaizen@gmail.com' && (
                          <button
                            type="button"
                            onClick={() => setSenderSettings((x) => ({ ...x, replyTo: 'mst.shikumikaizen@gmail.com' }))}
                            className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded font-medium cursor-pointer border border-slate-300 transition-colors"
                            title="緊急時�E直接個別対応用の個人Gmail宛てに刁E��替えまぁE
                          >
                            緊急用�E�個人Gmailに刁E��
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="email"
                      value={senderSettings.replyTo}
                      onChange={(e) => setSenderSettings((x) => ({ ...x, replyTo: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      placeholder="返信先を変更する場合に入力（任意！E
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      ※ 顧客が返信した際�E宛�Eです。デフォルト�E同一企業ドメイン�E�EsenderSettings.fromEmail || 'contact@mstcorp.info'}�E�で信頼性と到達率を担保します。緊急時や直接対応が忁E��な場合�Eみ「個人Gmailに刁E��」�Eタンで刁E��替えが可能です、E                    </span>
                  </label>
                </>
              )}

              {templateChannel === 'email' && (
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      メール斁E��ストック�E�任意引用�E�E                    </label>
                    <button
                      type="button"
                      onClick={() => setScreen('templates')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
                    >
                      <Library className="h-3.5 w-3.5" />
                      <span>斁E���ELINE素材ストックを開ぁE/span>
                    </button>
                  </div>
                  <select
                    value={selectedEmailTemplateId}
                    onChange={(e) => chooseEmailTemplate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="">現在の送信種別�E�Elabels[kind]}�E��E標準�E期文面</option>
                    {emailTemplates
                      .filter((x) => {
                        if (x.channel !== 'email') return false;
                        const key = String(x.template_key || '').trim();
                        const trimmedName = String(x.name || '').trim();
                        return key.startsWith('tpl_') || Boolean(trimmedName && trimmedName !== key);
                      })
                      .map((x: any) => (
                        <option key={x.id} value={x.id}>
                          {x.name?.trim() || x.template_key}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {templateChannel === 'line' && (
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      LINE斁E���E素材ストック�E�任意引用�E�E                    </label>
                    <button
                      type="button"
                      onClick={() => setScreen('templates')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
                    >
                      <Library className="h-3.5 w-3.5" />
                      <span>斁E���ELINE素材ストックを開ぁE/span>
                    </button>
                  </div>
                  <select
                    value={selectedLineTemplateId}
                    onChange={(e) => chooseLineTemplate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="">現在の送信種別�E�Elabels[kind]}�E��E標準テキスチE/option>
                    {lineTemplates.map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}�E�Ex.reply_type === 'text' ? 'チE��スチE : x.reply_type === 'image' ? '画僁E : x.reply_type === 'video' ? '動画' : 'Flex'}�E�E                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ペ�Eジ表示時�E件名�E本斁E��E��ドロワー表示時�E上部に既に配置されてぁE��ため非表示�E�E*/}
              {variant === 'page' && (
                <>
                  {templateChannel === 'email' && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-700">件吁E/label>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                        placeholder="件名を入劁E.."
                      />
                      <PlaceholderAssist text={subject} onInsert={(token) => setSubject((curr) => curr + token)} />
                    </div>
                  )}

                  {(kind === 'deal' || kind === 'customer_meeting') && (
                    <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-slate-500">
                        予紁E�EージURL: <span className="text-purple-700 font-mono font-medium">{bookingUrl || 'https://timerex.net/s/mstcorp/c3dd3eea'}</span>
                        {!bookingUrl && <span className="text-[10px] text-slate-400 ml-1">�E�標準TimeRex�E�E/span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">ビデオ会議:</span>
                        <button
                          type="button"
                          onClick={() => setVideoTool('google_meet')}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            videoTool === 'google_meet'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Google Meet
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoTool('zoom')}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                            videoTool === 'zoom'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Zoom
                        </button>
                        <span className="text-slate-400 text-[11px]">�E�EimeRex側の設定と合わせてください�E�E/span>
                      </div>
                    </div>
                  )}

                  {channel === 'both' && (
                    <div className="md:col-span-2 flex items-center gap-2 rounded-xl bg-purple-50/50 p-2.5 text-xs text-slate-700 border border-purple-200">
                      <span className="font-semibold text-purple-900">編雁E��象:</span>
                      <button
                        type="button"
                        onClick={() => setTemplateChannel('email')}
                        className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                      >
                        メール斁E��
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateChannel('line')}
                        className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'line' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                      >
                        LINE斁E��
                      </button>
                      <span className="text-slate-500 text-[11px]">※メールとLINEで別、E�E斁E��を設定�E送信できまぁE/span>
                    </div>
                  )}

                  {(templateChannel !== 'line' || !selectedLineTemplate || selectedLineTemplate.reply_type === 'text') && (
                    <div className="md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-700">本斁E/label>
                          {(kind === 'document' || kind === 'form' || kind === 'diagnosis') && (
                            <span className="text-xs font-medium text-purple-700">
                              保存対象: {kind === 'document' ? doc?.title || '共通書類テンプレーチE : form?.name || '共通テンプレーチE}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmailTemplateId('');
                              setSelectedLineTemplateId('');
                              if (templateChannel === 'email') setSubject('');
                              setBody('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                            title="現在の件名�E本斁E��真っさらな白紙状態にクリアしまぁE
                          >
                            <Eraser className="h-3.5 w-3.5 text-slate-500" />
                            <span>白紙に戻ぁE/span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsComposerExpanded(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                            title="斁E��作�Eエリアを画面全体へ大きく庁E��て入力しまぁE
                          >
                            <Maximize2 className="h-3.5 w-3.5 text-purple-600" />
                            <span>全画面で入劁E/span>
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={12}
                        className="mt-1 block w-full min-h-[260px] resize-y rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                        placeholder="本斁E��入力してください�E�白紙から�E力する場合�E「�E由作�E」また�E上�E「白紙に戻す」をご利用ください�E�E.."
                      />
                      {templateChannel === 'email' && (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          ※ メール送信時�Eどの種別�E��E由作�Eを含む�E�でも末尾に統一署名（有限会社MST・住所・HP・Mail�E�が自動付与されます（営業・案�Eメールには配信停止リンクも�E動付与）、E                        </p>
                      )}
                      <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
                    </div>
                  )}
                </>
              )}

              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                送信根拠�E�法規�E同意記録�E�E                <input
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                />
              </label>

              {(channel === 'email' || channel === 'both') && (
                <div className="md:col-span-2">
                  <button
                    type="button"
                    disabled={savingSenderSettings}
                    onClick={() => void saveSenderSettings()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingSenderSettings ? '保存中…' : '差出人既定値を保孁E}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ペ�Eジ表示時�E下部アクションボタン�E�ドロワー表示時�E上部に既に配置されてぁE��ため非表示�E�E*/}
          {variant === 'page' && (
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                <Save className="h-4 w-4" />
                チE��プレート保存！EtemplateChannel === 'email' ? 'メール' : 'LINE'}�E�E              </button>
              {!preview ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    if (!contact) {
                      setError('送信先を選択してください、E);
                      return;
                    }
                    if (kind === 'document' && !doc) {
                      setError('送信する書類を選択してください、E);
                      return;
                    }
                    if ((kind === 'form' || kind === 'diagnosis') && !form) {
                      setError('フォームを選択してください、E);
                      return;
                    }
                    setPreview(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs shadow-purple-600/20 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  送信プレビューを確誁E                </button>
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
          )}

          {preview && (
            <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 space-y-4 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-2xs">
                    <Eye className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">送信直前�Eレビュー�E�差込変数反映済み�E�E/h3>
                    <p className="text-xs text-slate-600">
                      変数�E�お名前・会社名�E書類名・URL等）がすべて実データに置き換わった実際の表示でぁE                    </p>
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
                          <strong className="font-bold text-slate-950">{senderSettings.fromName}</strong> &lt;{senderSettings.fromEmail || '未設宁E}&gt;
                          {senderSettings.replyTo.trim() && (
                            <span className="text-slate-600 ml-2">�E�返信允E {senderSettings.replyTo}�E�E/span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 font-bold text-slate-700">宛�E:</span>
                        <span className="text-slate-900 font-medium">
                          <strong className="font-bold text-slate-950">{contact?.full_name} 槁E/strong>
                          {contact?.email ? (
                            <span className="text-slate-700 font-mono ml-1.5">&lt;{contact.email}&gt;</span>
                          ) : (
                            <span className="ml-1.5 text-rose-600 font-bold">⚠�E�Eメールアドレス未登録</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 pt-1 border-t border-slate-200">
                        <span className="w-16 shrink-0 font-bold text-slate-700">件吁E</span>
                        <span className="text-[14px] font-bold text-slate-950">
                          {fill(selectedEmailTemplate?.subject || (templateChannel === 'email' ? subject : resolveTemplate('email')?.subject || ''), vals)}
                        </span>
                      </div>
                    </div>

                    {/* 添付書類表示 */}
                    {kind === 'document' && doc && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs text-slate-800">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="font-bold text-slate-900 shrink-0">送付書類:</span>
                          <span className="font-semibold text-purple-900 truncate">{doc.title}</span>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 font-bold text-[10px]">
                            {documentDeliveryFormat === 'web_link'
                              ? 'メール内書類表示＋Web/PDFリンク'
                              : 'PDF直接添付'}
                          </span>
                          <span className="font-bold text-slate-900 shrink-0">添付書顁E</span>
                            PDF自動添仁E                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`/api/documents/${encodeURIComponent(doc.id)}/pdf?download=1`}
                            download
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                            title="PDFファイルの事前保存確認"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>PDF保存</span>
                            title="添付PDFの事前確誁E
                            <span>PDF確誁E/span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setPreviewDocModal(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 text-xs font-bold cursor-pointer shadow-2xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>書類�Eレビュー</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* メール本斁E�Eレビュー�E�サーバ�Eと同一のロゴ入りHTML署名�Eレビューを含む�E�E*/}
                  <div className="p-6 bg-white">
                    <div className="font-sans text-sm leading-relaxed text-slate-900 selection:bg-purple-100">
                      {(() => {
                        const rawPreview = fill(
                          kind === 'document' && documentCategory(doc) === 'contract'
                            ? ensureContractReplySection(selectedEmailTemplate?.body_text || (templateChannel === 'email' ? body : resolveTemplate('email')?.body_text || ''))
                            : selectedEmailTemplate?.body_text || (templateChannel === 'email' ? body : resolveTemplate('email')?.body_text || ''),
                          vals,
                        );
                        const isTransactionalPreview = ['document', 'diagnosis', 'form', 'deal', 'customer_meeting'].includes(kind);
                        return (
                          <EmailHtmlPreviewCard
                            body={rawPreview}
                            senderEmail={senderSettings.fromEmail || 'contact@mstcorp.info'}
                            unsubscribeUrl={isTransactionalPreview ? undefined : '（送信時に連絡先専用の配信停止URLを自動付与）'}
                            embeddedDocument={
                              kind === 'document' && doc && documentDeliveryFormat === 'web_link'
                                ? {
                                    title: doc.title,
                                    documentType: documentCategory(doc),
                                    bodyHtml: doc.body_html,
                                    docUrl: vals.document_url,
                                    pdfUrl: vals.document_pdf_url,
                                  }
                                : null
                            }
                            unsubscribeUrl={isTransactionalPreview ? undefined : '�E�送信時に連絡先専用の配信停止URLを�E動付与！E}
                          />
                        );
                      })()}
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
                      <span className="text-slate-600 text-xs">�E�宛�E: {contact?.full_name} 様！E/span>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-emerald-700 font-bold text-[10px]">
                      LINE Messaging API 送信
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50">
                    <LineMessagePreview
                      type={selectedLineTemplate?.reply_type || 'text'}
                      title={selectedLineTemplate?.name || 'LINE送信冁E��'}
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
                  ↁEプレビューを閉じて編雁E��戻めE                </button>
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

      {/* 画面3: チE��プレート保管庫�E��E社マスター�E�E*/}
      {screen === 'templates' && (
        <CommunicationTemplateLibraryView />
      )}

      {/* 画面4: 全社送信履歴 */}
      {screen === 'history' && <CommunicationOutboxHistoryView />}

      {/* 添付書類�Eレビューモーダル */}
      {previewDocModal && (
        <DocumentPreviewModal
          document={previewDocModal}
          companyName={previewDocModal.company_id ? companies[previewDocModal.company_id] : undefined}
          onClose={() => setPreviewDocModal(null)}
        />
      )}

      {/* 全画面コンポ�Eザー�E�Eortal経由でドロワー幁E��制紁E��れず展開�E�E*/}
      {isComposerExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="メチE��ージ全画面入劁E
            className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 flex flex-col"
          >
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      メチE��ージ全画面エチE��タ�E�EtemplateChannel === 'email' ? 'メール' : 'LINE'}�E�E                    </span>
                    {contact && (
                      <span className="text-xs text-slate-600">
                        宛�E: <strong className="text-slate-900">{contact.full_name} 槁E/strong>
                        {companies[contact.company_id || ''] ? `�E�E{companies[contact.company_id || '']}�E�` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmailTemplateId('');
                      setSelectedLineTemplateId('');
                      if (templateChannel === 'email') setSubject('');
                      setBody('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Eraser className="h-3.5 w-3.5 text-slate-500" />
                    <span>白紙に戻ぁE/span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsComposerExpanded(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                    title="允E�E入力画面に戻ります！Esc�E�E
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>允E��戻す！Esc�E�E/span>
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col gap-3 p-5 overflow-hidden">
                {templateChannel === 'email' && (
                  <div className="shrink-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">件吁E/label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none"
                      placeholder="件名を入劁E.."
                    />
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 block mb-1 shrink-0">本斁E/label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="flex-1 min-h-0 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-purple-600 focus:outline-none"
                    placeholder="本斁E��入力してください..."
                  />
                </div>

                <div className="shrink-0 space-y-1.5">
                  <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
                  {templateChannel === 'email' && (
                    <p className="text-[11px] text-slate-500">
                      ※ メール送信時�E末尾に統一署名（有限会社MST・住所・HP・Mail�E�が自動付与されます、E                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};