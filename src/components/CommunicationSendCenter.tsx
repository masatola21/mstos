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
  document: '驥崎ｦ∵嶌鬘槭・騾∽ｿ｡・域署譯域嶌繝ｻ隕狗ｩ阪・螂醍ｴ・・隲区ｱゅ・譛域ｬ｡蝣ｱ蜻奇ｼ・,
  form: '繝輔か繝ｼ繝譯亥・',
  diagnosis: '險ｺ譁ｭ譯亥・',
  deal: '蝠・ｫ・律遞区｡亥・',
  customer_meeting: '鬘ｧ螳｢髱｢隲・律遞区｡亥・',
  sales_outreach: '譁ｰ隕丞霧讌ｭ繝｡繝ｼ繝ｫ・井ｸ逋ｺ謠先｡茨ｼ上せ繝・ャ繝怜・蝗橸ｼ・,
  announcement: '縺昴・莉悶・譯亥・',
  freeform: '閾ｪ逕ｱ菴懈・・育區邏吶°繧牙・蜉幢ｼ・,
};

const DEFAULT_TIMEREX_URL = 'https://timerex.net/s/mstcorp/c3dd3eea';

const documentCategory = (doc: any): DocumentType => {
  if (!doc || typeof doc !== 'object') return 'other';
  if (doc.document_type === 'proposal' && /隕狗ｩ・.test(doc.title || '')) return 'estimate';
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
    subject: '縲先嶌鬘樣∽ｻ倥捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
    body_text: '{縺雁錐蜑閤 讒禄n\n縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・n\n荳玖ｨ倥・譖ｸ鬘橸ｼ・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ篭RL繧医ｊWeb荳翫〒繧ょ・螳ｹ繧偵＃遒ｺ隱阪・縺頑焔邯壹″縺・◆縺縺代∪縺吶・n\n譖ｸ鬘槫錐・嘴譖ｸ鬘槫錐}\n遒ｺ隱攻RL・嘴譖ｸ鬘朸RL}\n\n縺比ｸ肴・轤ｹ繧・＃雉ｪ蝠上′縺斐＊縺・∪縺励◆繧峨∵悽繝｡繝ｼ繝ｫ縺ｫ縺碑ｿ比ｿ｡縺上□縺輔＞縲・,
  },
  {
    category: 'document',
    channel: 'line',
    subject: '',
    body_text: '{縺雁錐蜑閤 讒禄n譖ｸ鬘槭鶏譖ｸ鬘槫錐}縲阪ｒ縺皮｢ｺ隱阪￥縺縺輔＞縲・n{譖ｸ鬘朸RL}',
  },
  {
    category: 'form',
    channel: 'email',
    subject: '縲舌＃蝗樒ｭ斐・縺企｡倥＞縲捜繝輔か繝ｼ繝蜷閤・悳莨夂､ｾ蜷閤 讒・,
    body_text: '{縺雁錐蜑閤 讒禄n\n縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・n\n縲鶏繝輔か繝ｼ繝蜷閤縲阪∈縺ｮ縺泌屓遲斐ｒ縺企｡倥＞縺・◆縺励∪縺吶ゆｸ玖ｨ篭RL縺九ｉ縺泌茜逕ｨ縺・◆縺縺代∪縺吶・n{譯亥・URL}\n\n縺比ｸ肴・轤ｹ縺ｯ譛ｬ繝｡繝ｼ繝ｫ縺ｫ縺碑ｿ比ｿ｡縺上□縺輔＞縲・,
  },
  {
    category: 'form',
    channel: 'line',
    subject: '',
    body_text: '{縺雁錐蜑閤 讒禄n縲鶏繝輔か繝ｼ繝蜷閤縲阪∈縺ｮ縺泌屓遲斐ｒ縺企｡倥＞縺・◆縺励∪縺吶・n{譯亥・URL}',
  },
  {
    category: 'diagnosis',
    channel: 'email',
    subject: '縲占ｨｺ譁ｭ縺ｮ縺疲｡亥・縲捜繝輔か繝ｼ繝蜷閤・悳莨夂､ｾ蜷閤 讒・,
    body_text: '{縺雁錐蜑閤 讒禄n\n縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・n\n縲鶏繝輔か繝ｼ繝蜷閤縲阪ｒ縺疲｡亥・縺・◆縺励∪縺吶ゆｸ玖ｨ篭RL縺九ｉ險ｺ譁ｭ繧帝幕蟋九＠縺ｦ縺上□縺輔＞縲・n{譯亥・URL}\n\n縺比ｸ肴・轤ｹ縺ｯ譛ｬ繝｡繝ｼ繝ｫ縺ｫ縺碑ｿ比ｿ｡縺上□縺輔＞縲・,
  },
  {
    category: 'diagnosis',
    channel: 'line',
    subject: '',
    body_text: '{縺雁錐蜑閤 讒禄n縲鶏繝輔か繝ｼ繝蜷閤縲阪ｒ縺疲｡亥・縺・◆縺励∪縺吶ゅ％縺｡繧峨°繧峨＃蛻ｩ逕ｨ縺上□縺輔＞縲・n{譯亥・URL}',
  },
  {
    category: 'deal',
    channel: 'email',
    subject: '縲仙膚隲・律遞九・縺疲｡亥・縲捜莨夂､ｾ蜷閤 讒・,
    body_text: '{縺雁錐蜑閤 讒禄n\n縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・n\n蝠・ｫ・・譌･遞玖ｪｿ謨ｴ縺ｫ縺､縺・※縺疲｡亥・縺・◆縺励∪縺吶ゆｸ玖ｨ倅ｺ育ｴ・・繝ｼ繧ｸ縺九ｉ縲√＃驛ｽ蜷医・繧医＞譌･譎ゅｒ縺企∈縺ｳ縺上□縺輔＞縲・n{譯亥・URL}\n\n莠育ｴ・｢ｺ螳壼ｾ後；oogle繧ｫ繝ｬ繝ｳ繝繝ｼ縺ｫ莠亥ｮ壹′逋ｻ骭ｲ縺輔ｌ縲＋繝薙ョ繧ｪ繝・・繝ｫ蜷閤縺ｮ諠・ｱ縺梧｡亥・縺輔ｌ縺ｾ縺吶・n縺比ｸ肴・轤ｹ縺ｯ譛ｬ繝｡繝ｼ繝ｫ縺ｫ縺碑ｿ比ｿ｡縺上□縺輔＞縲・,
  },
  {
    category: 'deal',
    channel: 'line',
    subject: '',
    body_text: '{縺雁錐蜑閤 讒禄n蝠・ｫ・・譌･遞九・縺薙■繧峨°繧峨♀驕ｸ縺ｳ縺上□縺輔＞縲・n{譯亥・URL}\n莠育ｴ・｢ｺ螳壼ｾ後；oogle繧ｫ繝ｬ繝ｳ繝繝ｼ縺ｨ{繝薙ョ繧ｪ繝・・繝ｫ蜷閤縺ｮ諠・ｱ縺梧｡亥・縺輔ｌ縺ｾ縺吶・,
  },
  {
    category: 'customer_meeting',
    channel: 'email',
    subject: '縲宣｡ｧ螳｢髱｢隲・・譌･遞玖ｪｿ謨ｴ縲捜莨夂､ｾ蜷閤 讒・,
    body_text: '{縺雁錐蜑閤 讒禄n\n縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・n\n谺｡蝗槭・縺頑遠縺｡蜷医ｏ縺帶律遞九ｒ縺疲｡亥・縺・◆縺励∪縺吶ゆｸ玖ｨ倅ｺ育ｴ・・繝ｼ繧ｸ縺九ｉ縲√＃驛ｽ蜷医・繧医＞譌･譎ゅｒ縺企∈縺ｳ縺上□縺輔＞縲・n{譯亥・URL}\n\n莠育ｴ・｢ｺ螳壼ｾ後；oogle繧ｫ繝ｬ繝ｳ繝繝ｼ縺ｫ莠亥ｮ壹′逋ｻ骭ｲ縺輔ｌ縲＋繝薙ョ繧ｪ繝・・繝ｫ蜷閤縺ｮ諠・ｱ縺梧｡亥・縺輔ｌ縺ｾ縺吶・n縺比ｸ肴・轤ｹ縺ｯ譛ｬ繝｡繝ｼ繝ｫ縺ｫ縺碑ｿ比ｿ｡縺上□縺輔＞縲・,
  },
  {
    category: 'customer_meeting',
    channel: 'line',
    subject: '',
    body_text: '{縺雁錐蜑閤 讒禄n谺｡蝗槭・縺頑遠縺｡蜷医ｏ縺帶律遞九・縺薙■繧峨°繧峨＃驕ｸ謚槭￥縺縺輔＞縲・n{譯亥・URL}',
  },
  {
    category: 'announcement',
    channel: 'email',
    subject: '縲舌＃譯亥・縲捜莨夂､ｾ蜷閤 讒・,
    body_text: '{縺雁錐蜑閤 讒禄n\n縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・n\n{譯亥・URL}\n\n縺比ｸ肴・轤ｹ縺ｯ譛ｬ繝｡繝ｼ繝ｫ縺ｫ縺碑ｿ比ｿ｡縺上□縺輔＞縲・,
  },
  {
    category: 'announcement',
    channel: 'line',
    subject: '',
    body_text: '{縺雁錐蜑閤 讒禄n{譯亥・URL}',
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

const documentMessage = (type: string | undefined, channel: DeliveryChannel) => {
  const hi = '{縺雁錐蜑閤 讒・;
  const intro = '縺贋ｸ冶ｩｱ縺ｫ縺ｪ縺｣縺ｦ縺翫ｊ縺ｾ縺吶よ怏髯蝉ｼ夂､ｾMST縺ｧ縺吶・;
  const details = '譖ｸ鬘槫錐・嘴譖ｸ鬘槫錐}\n遒ｺ隱攻RL・嘴譖ｸ鬘朸RL}';
  const messages: Record<string, { subject: string; body: string; line: string }> = {
    proposal: {
      subject: '縲舌＃謠先｡域嶌縺ｮ騾∽ｻ倥捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
      body: hi + '\n\n' + intro + '\n\n險ｺ譁ｭ邨先棡繝ｻ縺疲署譯域嶌・・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ倥Μ繝ｳ繧ｯ繧医ｊWeb荳翫〒繧ょ・螳ｹ繧偵＃遒ｺ隱阪＞縺溘□縺代∪縺吶ゅ＃荳肴・轤ｹ繧・＃蟶梧悍縺後＃縺悶＞縺ｾ縺励◆繧峨♀遏･繧峨○縺上□縺輔＞縲・n\n' + details,
      line: hi + '\n險ｺ譁ｭ邨先棡繝ｻ縺疲署譯域嶌繧偵♀騾√ｊ縺励∪縺吶ょ・螳ｹ繧偵＃遒ｺ隱阪￥縺縺輔＞縲・n{譖ｸ鬘槫錐}\n{譖ｸ鬘朸RL}',
    },
    diagnosis_report: {
      subject: '縲占ｨｺ譁ｭ繝ｬ繝昴・繝医・縺秘∽ｻ倥捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
      body: hi + '\n\n' + intro + '\n\n險ｺ譁ｭ邨先棡繧偵∪縺ｨ繧√◆繝ｬ繝昴・繝茨ｼ・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ倥Μ繝ｳ繧ｯ繧医ｊWeb荳翫〒繧らｵ先棡縺ｨ莉雁ｾ後・騾ｲ繧∵婿繧偵＃遒ｺ隱阪＞縺溘□縺代∪縺吶・n\n' + details,
      line: hi + '\n險ｺ譁ｭ繝ｬ繝昴・繝医ｒ縺企√ｊ縺励∪縺吶らｵ先棡縺ｨ莉雁ｾ後・騾ｲ繧∵婿繧偵＃遒ｺ隱阪￥縺縺輔＞縲・n{譖ｸ鬘槫錐}\n{譖ｸ鬘朸RL}',
    },
    contract: {
      subject: '縲仙･醍ｴ・・螳ｹ縺ｮ縺皮｢ｺ隱阪・蜷梧э縺ｮ縺企｡倥＞縲捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
      body:
        hi +
        '\n\n' +
        intro +
        '\n\n讌ｭ蜍吝ｧ碑ｨ怜渕譛ｬ螂醍ｴ・嶌・・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ倥Μ繝ｳ繧ｯ繧医ｊWeb荳翫〒繧ょ･醍ｴ・・螳ｹ繧偵＃遒ｺ隱阪＞縺溘□縺代∪縺吶・n\n' +
        details +
        '\n\n' +
        '笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤\n' +
        '笆 繝｡繝ｼ繝ｫ霑比ｿ｡縺ｫ繧医ｋ螂醍ｴ・粋諢上・縺企｡倥＞\n' +
        '笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤笏≫煤\n' +
        '螂醍ｴ・・螳ｹ繧偵＃遒ｺ隱阪＞縺溘□縺阪∝撫鬘後′縺斐＊縺・∪縺帙ｓ縺ｧ縺励◆繧峨∝･醍ｴ・ｷ邨舌・讓ｩ髯舌ｒ縺頑戟縺｡縺ｮ譁ｹ繧医ｊ譛ｬ繝｡繝ｼ繝ｫ縺ｸ縺昴・縺ｾ縺ｾ縺碑ｿ比ｿ｡繧偵♀鬘倥＞縺・◆縺励∪縺吶・n\n' +
        '縲舌＃霑比ｿ｡縺・◆縺縺乗枚髱｢縲曾n' +
        '縲鶏莨夂､ｾ蜷閤繧剃ｻ｣陦ｨ縺励※縲∝･醍ｴ・嶌縲施譖ｸ鬘槫錐}縲上・蜀・ｮｹ繧堤｢ｺ隱阪＠縲∵怏髯蝉ｼ夂､ｾMST縺ｨ縺ｮ螂醍ｴ・ｷ邨舌↓蜷梧э縺励∪縺吶・n' +
        '豌丞錐・夲ｼｻ豌丞錐・ｽ\n' +
        '蠖ｹ閨ｷ・夲ｼｻ蠖ｹ閨ｷ・ｽ縲構n\n' +
        '窶ｻ蜀・ｮｹ縺ｫ菫ｮ豁｣蟶梧悍縺後≠繧句ｴ蜷医・縲∝酔諢乗枚縺ｧ縺ｯ縺ｪ縺丈ｿｮ豁｣邂・園繧偵＃霑比ｿ｡縺上□縺輔＞縲・n' +
        '窶ｻ霑比ｿ｡繧堤｢ｺ隱榊ｾ後∝･醍ｴ・憾諷九ｒ邱邨先ｸ医∩縺ｫ譖ｴ譁ｰ縺励∪縺吶ゅ＃霑比ｿ｡縺・◆縺縺・◆繝｡繝ｼ繝ｫ縺ｨ螂醍ｴ・嶌縺ｯ螂醍ｴ・ｨ倬鹸縺ｨ縺励※菫晏ｭ倥＠縺ｾ縺吶・n\n' +
        '縺皮｢ｺ隱阪・縺ｻ縺ｩ縲∽ｽ募穀繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・,
      line: hi + '\n螂醍ｴ・嶌繧偵♀騾√ｊ縺励∪縺吶ょ・螳ｹ繧偵＃遒ｺ隱阪￥縺縺輔＞縲ょ酔諢上＞縺溘□縺代ｋ蝣ｴ蜷医・縲∝･醍ｴ・ｷ邨舌・讓ｩ髯舌ｒ縺頑戟縺｡縺ｮ譁ｹ縺九ｉ繝｡繝ｼ繝ｫ縺ｧ譏守､ｺ逧・↓縺碑ｿ比ｿ｡縺上□縺輔＞縲・n{譖ｸ鬘槫錐}\n{譖ｸ鬘朸RL}',
    },
    estimate: {
      subject: '縲舌♀隕狗ｩ肴嶌縺ｮ騾∽ｻ倥捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
      body: hi + '\n\n' + intro + '\n\n縺願ｦ狗ｩ肴嶌・・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ倥Μ繝ｳ繧ｯ繧医ｊWeb荳翫〒繧ゅ♀隕狗ｩ埼≡鬘阪・譛牙柑譛滄剞繝ｻ縺疲署譯亥・螳ｹ繧偵＃遒ｺ隱阪＞縺溘□縺代∪縺吶ょ・螳ｹ縺ｮ隱ｿ謨ｴ繧・＃荳肴・轤ｹ縺後＃縺悶＞縺ｾ縺励◆繧峨♀遏･繧峨○縺上□縺輔＞縲・n\n' + details,
      line: hi + '\n縺願ｦ狗ｩ肴嶌繧偵♀騾√ｊ縺励∪縺吶る≡鬘阪・譛牙柑譛滄剞繝ｻ蜀・ｮｹ繧偵＃遒ｺ隱阪￥縺縺輔＞縲・n{譖ｸ鬘槫錐}\n{譖ｸ鬘朸RL}',
    },
    invoice: {
      subject: '縲占ｫ区ｱよ嶌縺ｮ縺秘∽ｻ倥捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
      body: hi + '\n\n' + intro + '\n\n隲区ｱよ嶌・・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ倥Μ繝ｳ繧ｯ繧医ｊWeb荳翫〒繧りｫ区ｱる≡鬘阪・縺頑髪謇墓悄譌･繝ｻ謖ｯ霎ｼ蜈医↑縺ｩ縺ｮ險倩ｼ峨ｒ縺皮｢ｺ隱阪＞縺溘□縺代∪縺吶ゅ♀謇狗ｶ壹″縺ｮ縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞縺・◆縺励∪縺吶・n\n' + details,
      line: hi + '\n隲区ｱよ嶌繧偵♀騾√ｊ縺励∪縺吶る≡鬘阪・縺頑髪謇墓悄譌･繝ｻ謖ｯ霎ｼ蜈医ｒ縺皮｢ｺ隱阪￥縺縺輔＞縲・n{譖ｸ鬘槫錐}\n{譖ｸ鬘朸RL}',
    },
  };
  const message = messages[type || ''] || {
    subject: '縲先嶌鬘槭・縺秘∽ｻ倥捜譖ｸ鬘槫錐}・悳莨夂､ｾ蜷閤 讒・,
    body: hi + '\n\n' + intro + '\n\n譖ｸ鬘橸ｼ・DF・峨ｒ豺ｻ莉倥＞縺溘＠縺ｾ縺励◆縺ｮ縺ｧ縲√＃遒ｺ隱阪・縺ｻ縺ｩ繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・n縺ｾ縺溘∽ｸ玖ｨ倥Μ繝ｳ繧ｯ繧医ｊWeb荳翫〒繧ょ・螳ｹ繧偵＃遒ｺ隱阪＞縺溘□縺代∪縺吶ゅ＃荳肴・轤ｹ縺後＃縺悶＞縺ｾ縺励◆繧峨♀遏･繧峨○縺上□縺輔＞縲・n\n' + details,
    line: hi + '\n譖ｸ鬘槭ｒ縺企√ｊ縺励∪縺吶ょ・螳ｹ繧偵＃遒ｺ隱阪￥縺縺輔＞縲・n{譖ｸ鬘槫錐}\n{譖ｸ鬘朸RL}',
  };
  return channel === 'email' ? { category: 'document', channel, subject: message.subject, body_text: message.body } : { category: 'document', channel, subject: '', body_text: message.line };
};

const contractReplySection = '縲舌Γ繝ｼ繝ｫ霑比ｿ｡縺ｫ繧医ｋ螂醍ｴ・粋諢上曾n螂醍ｴ・・螳ｹ縺ｫ蜷梧э縺・◆縺縺代ｋ蝣ｴ蜷医・縲∝･醍ｴ・ｷ邨舌・讓ｩ髯舌ｒ縺頑戟縺｡縺ｮ譁ｹ縺九ｉ縲√％縺ｮ繝｡繝ｼ繝ｫ縺ｸ縺ｮ霑比ｿ｡縺ｧ谺｡縺ｮ譁・擇繧偵♀騾√ｊ縺上□縺輔＞縲・n\n縲鶏莨夂､ｾ蜷閤繧剃ｻ｣陦ｨ縺励※縲∝･醍ｴ・嶌縲施譖ｸ鬘槫錐}縲上・蜀・ｮｹ繧堤｢ｺ隱阪＠縲∵怏髯蝉ｼ夂､ｾMST縺ｨ縺ｮ螂醍ｴ・ｷ邨舌↓蜷梧э縺励∪縺吶よｰ丞錐・夲ｼｻ豌丞錐・ｽ縲蠖ｹ閨ｷ・夲ｼｻ蠖ｹ閨ｷ・ｽ縲構n\n蜀・ｮｹ縺ｫ菫ｮ豁｣蟶梧悍縺後≠繧句ｴ蜷医・縲∝酔諢乗枚縺ｧ縺ｯ縺ｪ縺丈ｿｮ豁｣邂・園繧偵＃霑比ｿ｡縺上□縺輔＞縲りｿ比ｿ｡繧堤｢ｺ隱榊ｾ後∝･醍ｴ・憾諷九ｒ邱邨先ｸ医∩縺ｫ譖ｴ譁ｰ縺励∪縺吶ゅ＃霑比ｿ｡縺・◆縺縺・◆繝｡繝ｼ繝ｫ縺ｨ螂醍ｴ・嶌縺ｯ螂醍ｴ・ｨ倬鹸縺ｨ縺励※菫晏ｭ倥＠縺ｦ縺上□縺輔＞縲・;
const ensureContractReplySection = (body: string) =>
  body.includes('螂醍ｴ・ｷ邨舌↓蜷梧э縺励∪縺・) || body.includes('繝｡繝ｼ繝ｫ霑比ｿ｡縺ｫ繧医ｋ螂醍ｴ・粋諢・)
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
  // 隨ｬ1騾壹ｒ謇句虚縺ｧ騾√▲縺溘≠縺ｨ縲∫ｬｬ2縲・騾壹ｒ閾ｪ蜍輔〒莠育ｴ・☆繧九°・亥・譛溘・OFF縲る√ｋ縺溘・縺ｫOFF縺ｸ謌ｻ縺呻ｼ・  const [autoFollowups, setAutoFollowups] = useState(false);
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
  const [basis, setBasis] = useState('鬘ｧ螳｢縺九ｉ縺ｮ萓晞ｼ繝ｻ讌ｭ蜍咎｣邨｡');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [templateDocumentType, setTemplateDocumentType] = useState<DocumentType>('contract');
  const [senderSettings, setSenderSettings] = useState<{ fromName: string; fromEmail: string; replyTo: string }>({
    fromName: '譛蛾剞莨夂､ｾMST・懃ｵ悟霧繝ｻ讌ｭ蜍呎隼蝟・髪謠ｴ',
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

  const vals: Record<string, string> = {
    繝薙ョ繧ｪ繝・・繝ｫ蜷・ videoTool === 'zoom' ? 'Zoom' : 'Google Meet',
    video_tool_name: videoTool === 'zoom' ? 'Zoom' : 'Google Meet',
    縺雁錐蜑・ contact?.full_name || '縺疲球蠖楢・,
    莨夂､ｾ蜷・ companies[contact?.company_id || ''] || '雋ｴ遉ｾ',
    繝輔か繝ｼ繝蜷・ form?.name || '繝輔か繝ｼ繝',
    譖ｸ鬘槫錐: doc?.title || '譖ｸ鬘・,
    譖ｸ鬘朸RL: url.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''),
    譖ｸ鬘樊悽譁・ '',
    髱｢隲・ｺ育ｴФRL: bookingUrl || DEFAULT_TIMEREX_URL,
    譯亥・URL: currentLinkUrl,

    // 闍ｱ隱槭く繝ｼ莠呈鋤
    recipient_name: contact?.full_name || '縺疲球蠖楢・,
    name: contact?.full_name || '縺疲球蠖楢・,
    company_name: companies[contact?.company_id || ''] || '雋ｴ遉ｾ',
    form_title: form?.name || '繝輔か繝ｼ繝',
    document_title: doc?.title || '譖ｸ鬘・,
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
      db.from('customer_documents').select('id,title,status,document_type,company_id,contact_id,body_html').order('created_at', { ascending: false }).limit(1000),
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
          fromName: emailSettings.data?.sender_name || '譛蛾剞莨夂､ｾMST・懃ｵ悟霧繝ｻ讌ｭ蜍呎隼蝟・髪謠ｴ',
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
            (row: any) => row.scenario_id === ONE_SHOT_SCENARIO_ID || String(row?.config?.name || '').includes('荳逋ｺ逶ｴ逅・)
          );
          if (matchedOneShot?.config) {
            setCustomOneShotConfig({
              emailSubject: matchedOneShot.config.emailSubject || '',
              emailBody: matchedOneShot.config.emailBody || '',
            });
          }
        }
      })
      .catch((e) => ok && setError(e.message || '隱ｭ縺ｿ霎ｼ縺ｿ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・));
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
  }, [kind, channel, templateKey, templates, doc?.id, templateChannel]);

  const applySalesStep = (stepNum: number, c = contact, oneShotOverride = customOneShotConfig) => {
    const compName = c?.company_id ? companies[c.company_id] || '雋ｴ遉ｾ' : '雋ｴ遉ｾ';
    const compInd = c?.company_id ? companyIndustries[c.company_id] || '' : '';
    const diagForm = forms.find((f: any) => f.form_type === 'diagnosis') || forms[0];
    const diagUrl = diagForm ? `${window.location.origin}/f/${encodeURIComponent(diagForm.public_slug)}${c ? `?cid=${encodeURIComponent(c.id)}` : ''}` : bookingUrl || url.trim();
    const outreach = stepNum === 0
      ? resolveOneShotOutreachDraft(oneShotOverride, compName, c?.full_name, compInd, diagUrl)
      : getSalesEmailTemplate(stepNum, compName, c?.full_name, compInd, diagUrl);
    setSubject(outreach.subject);
    setBody(outreach.body);
    if (diagUrl && diagUrl !== '{{diagnostic_url}}') setUrl(diagUrl);
    setBasis('迚ｹ螳夐崕蟄舌Γ繝ｼ繝ｫ豕輔↓蝓ｺ縺･縺乗･ｭ蜍呎隼蝟・ュ蝣ｱ縺ｮ謠蝉ｾ幢ｼ医が繝励ヨ繧｢繧ｦ繝域・險假ｼ・);
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
      setError('繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞縲・);
      return;
    }
    const row = { owner_id: data.user.id, template_key: templateKey, category: kind, channel: templateChannel, subject, body_text: body };
    const { data: saved, error: e } = await db.from('communication_templates').upsert(row, { onConflict: 'owner_id,template_key' }).select('*').single();
    if (e) setError(e.message);
    else {
      const savedRow = saved || row;
      setTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
      setEmailTemplates((x) => [...x.filter((y) => y.template_key !== row.template_key), savedRow]);
      setNotice('繝・Φ繝励Ξ繝ｼ繝医ｒ菫晏ｭ倥＠縺ｾ縺励◆縲・);
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
      setError('繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞縲・);
      return;
    }
    const senderName = senderSettings.fromName.trim();
    const senderEmail = senderSettings.fromEmail.trim().toLowerCase();
    const replyTo = senderSettings.replyTo.trim().toLowerCase();
    const emailPattern = /^\S+@\S+\.\S+$/;
    if (!senderName || senderName.length > 100 || /[\r\n<>]/.test(senderName) || !emailPattern.test(senderEmail) || (replyTo && !emailPattern.test(replyTo))) {
      setError('蟾ｮ蜃ｺ莠ｺ蜷阪・蟾ｮ蜃ｺ莠ｺ繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繝ｻ霑比ｿ｡蜈医・蜈･蜉帙ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞縲・);
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
      setNotice('繝｡繝ｼ繝ｫ騾∽ｿ｡縺ｮ譌｢螳壼､繧剃ｿ晏ｭ倥＠縺ｾ縺励◆縲ょ・遶ｯ譛ｫ縺ｧ蜈ｱ騾壹＠縺ｦ菴ｿ繧上ｌ縺ｾ縺吶・);
    } catch (e: any) {
      setError(e?.message || '繝｡繝ｼ繝ｫ騾∽ｿ｡險ｭ螳壹ｒ菫晏ｭ倥〒縺阪∪縺帙ｓ縺ｧ縺励◆縲・);
    } finally {
      setSavingSenderSettings(false);
    }
  };

  const send = async () => {
    if (!db || !contact) return;
    setError('');
    const targets: DeliveryChannel[] = channel === 'both' ? ['email', 'line'] : [channel];
    if (targets.includes('email') && (!senderSettings.fromName.trim() || !senderSettings.fromEmail.trim())) {
      setError('騾∽ｿ｡譎ゅ・蟾ｮ蜃ｺ莠ｺ險ｭ螳壹ｒ蜈･蜉帙＠縺ｦ菫晏ｭ倥＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    const hasDocUrl = Boolean(url.trim() || vals.document_url?.trim() || (doc ? window.location.origin + '/docs/' + encodeURIComponent(doc.id) : ''));
    if (!contact) {
      setError('騾∽ｿ｡蜈医・騾｣邨｡蜈医ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (targets.includes('email') && !contact.email) {
      setError(`縲・{contact.full_name} 讒倥阪↓縺ｯ繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ縲る｣邨｡蜈郁ｨｭ螳壹〒繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繧堤匳骭ｲ縺吶ｋ縺九´INE騾∽ｿ｡繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲Ａ);
      return;
    }
    if (targets.includes('line') && !contact.line_user_id) {
      setError(`縲・{contact.full_name} 讒倥阪・LINE蜈ｬ蠑上い繧ｫ繧ｦ繝ｳ繝医→騾｣謳ｺ縺輔ｌ縺ｦ縺・∪縺帙ｓ・・INE騾∽ｿ｡荳榊庄・峨ゅΓ繝ｼ繝ｫ騾∽ｿ｡繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲Ａ);
      return;
    }
    if (kind === 'document' && (!doc || !hasDocUrl)) {
      setError('騾∽ｿ｡蟇ｾ雎｡縺ｮ譖ｸ鬘槭ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲ゆｸ翫・隧ｳ邏ｰ險ｭ螳壹°繧画嶌鬘槭ｒ驕ｸ謚槭〒縺阪∪縺吶・);
      return;
    }
    if ((kind === 'form' || kind === 'diagnosis') && !vals.link_url.trim()) {
      setError('騾∽ｿ｡蟇ｾ雎｡縺ｮ繝輔か繝ｼ繝繝ｻ險ｺ譁ｭ繧帝∈謚槭＠縺ｦ縺上□縺輔＞・域｡亥・URL縺梧悴險ｭ螳壹〒縺呻ｼ峨ゆｸ翫・隧ｳ邏ｰ險ｭ螳壹°繧峨ヵ繧ｩ繝ｼ繝繧帝∈謚槭〒縺阪∪縺吶・);
      return;
    }
    if ((kind === 'deal' || kind === 'customer_meeting') && !vals.link_url.trim()) {
      setError('莠育ｴ・・繝ｼ繧ｸURL縺瑚ｨｭ螳壹＆繧後※縺・∪縺帙ｓ縲６RL繧貞・蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (!basis.trim()) {
      setError('騾∽ｿ｡譬ｹ諡・域ｳ戊ｦ上・蜷梧э險倬鹸・峨ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (kind === 'freeform' && !body.trim() && !(targets.includes('line') && selectedLineTemplate)) {
      setError('閾ｪ逕ｱ菴懈・繝｢繝ｼ繝峨〒縺ｯ譛ｬ譁・ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    if (initialCompanyId && contact.company_id && contact.company_id !== initialCompanyId) {
      setError('莨夂､ｾ縺ｫ邏舌▼縺城｣邨｡蜈医ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲・);
      return;
    }
    setBusy(true);
    try {
      if (doc && !['approved', 'sent'].includes(doc.status)) {
        await db.from('customer_documents').update({ status: 'approved' }).eq('id', doc.id);
        doc.status = 'approved';
      }
      const { data: sessionData } = await db.auth.getSession();
      if (!sessionData.session?.access_token) throw Error('繝ｭ繧ｰ繧､繝ｳ迥ｶ諷九ｒ遒ｺ隱阪〒縺阪∪縺帙ｓ縲・);
      if (targets.includes('line')) {
        const { data: friend, error: friendError } = await db.from('line_friends').select('status,consent_status').eq('line_user_id', contact.line_user_id).maybeSingle();
        if (friendError) throw friendError;
        const isStopped =
          friend &&
          (friend.status === 'blocked' ||
            friend.status === 'unfollowed' ||
            friend.consent_status === 'opted_out');
        if (isStopped) {
          throw Error('縺薙・騾｣邨｡蜈医・繝悶Ο繝・け縺ｾ縺溘・驟堺ｿ｡蛛懈ｭ｢迥ｶ諷九・縺溘ａLINE騾∽ｿ｡縺ｧ縺阪∪縺帙ｓ縲・);
        }
        if (!friend || friend.status !== 'active' || friend.consent_status !== 'opted_in') {
          const ensureRes = await fetch('/api/line/friends/ensure-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionData.session.access_token },
            body: JSON.stringify({ lineUserId: contact.line_user_id }),
          });
          const ensured = await ensureRes.json().catch(() => ({}));
          if (!ensureRes.ok || !ensured.canSendLine) {
            throw Error(ensured.error || 'LINE縺ｮ蜿九□縺｡迥ｶ諷九→驟堺ｿ｡蜷梧э繧堤｢ｺ隱阪〒縺阪∪縺帙ｓ縲・);
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
        const finalBody = targetLineTemplate?.reply_type === 'text' ? String(targetLineTemplate.payload?.text || '') : linePayload ? `[${targetLineTemplate.reply_type === 'image' ? '逕ｻ蜒・ : targetLineTemplate.reply_type === 'video' ? '蜍慕判' : 'Flex'}繝｡繝・そ繝ｼ繧ｸ]` : targetBody;
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
            body: JSON.stringify({ outboxId: row.id }),
          });
          const result = await response.json().catch(() => ({}));
          return { channel: row.channel, ok: response.ok && result.status === 'sent', message: result.error || '' };
        }),
      );
      const summary = outcomes
        .map((x) => (x.channel === 'email' ? '繝｡繝ｼ繝ｫ' : 'LINE'))
        .map((label, i) => {
          const outcome = outcomes[i];
          return label + (outcome.ok ? '騾∽ｿ｡貂医∩' : '螟ｱ謨・) + (outcome.message ? '・・ + outcome.message + '・・ : '');
        })
        .join(' / ');
      setNotice(summary);
      setPreview(false);
      const allOk = outcomes.length > 0 && outcomes.every((x) => x.ok);
      // 譖ｸ鬘槭ｒ騾√ｌ縺溘ｉ縲∵嶌鬘槭・迥ｶ諷九ｒ縲碁∽ｿ｡貂医∩縲阪↓縺吶ｋ(謠先｡域嶌縺ｯ縲∝ｯｾ蠢懊☆繧倶ｸ区嶌縺阪・險倬鹸繧ゅ碁∽ｻ俶ｸ医∩縲阪↓縺吶ｋ)
      if (allOk && doc) {
        try {
          if (doc.status !== 'sent') {
            await db.from('customer_documents').update({ status: 'sent' }).eq('id', doc.id);
            doc.status = 'sent';
          }
          await db.from('proposal_drafts').update({ status: 'sent' }).eq('document_id', doc.id).eq('status', 'approved');
          // 縺薙・譖ｸ鬘槭↓邏舌▼縺丞･醍ｴ・・隲区ｱゅ・迥ｶ諷九ｂ騾ｲ繧√ｋ(螂醍ｴ・ 繝｡繝ｼ繝ｫ騾∽ｻ俶ｸ医∩ / 隲区ｱ・ 逋ｺ陦梧ｸ医∩)縲ょ叙豸医・邱邨先ｸ医∩繝ｻ蜈･驥第ｸ医∩縺ｪ縺ｩ蜈医・迥ｶ諷九・蜍輔°縺輔↑縺・・          await db.from('customer_contracts').update({ status: 'sent' }).eq('document_id', doc.id).in('status', ['draft', 'under_review']);
          await db.from('customer_invoices').update({ status: 'issued' }).eq('document_id', doc.id).in('status', ['draft', 'awaiting_approval']);
          window.dispatchEvent(new CustomEvent('mst:documents-changed'));
        } catch {
          // 迥ｶ諷九・譖ｴ譁ｰ縺ｫ螟ｱ謨励＠縺ｦ繧ゅ・∽ｿ｡縺昴・繧ゅ・縺ｯ謌仙粥縺励※縺・ｋ縺溘ａ騾夂衍縺ｯ螟峨∴縺ｪ縺・        }
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
            setNotice(`${summary} / 隨ｬ2縲・騾壹・閾ｪ蜍暮∽ｿ｡繧剃ｺ育ｴ・＠縺ｾ縺励◆・・{followBody.scheduled}莉ｶ・荏);
          } else {
            setNotice(`${summary} / 2騾夂岼莉･髯阪・莠育ｴ・ ${followBody.error || followBody.message || '莠育ｴ・〒縺阪∪縺帙ｓ縺ｧ縺励◆'}`);
          }
        } catch {
          setNotice(`${summary} / 2騾夂岼莉･髯阪・莠育ｴ・↓螟ｱ謨励＠縺ｾ縺励◆縲ゅｂ縺・ｸ蠎ｦ縺願ｩｦ縺励￥縺縺輔＞縲Ａ);
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
        setError(failedOutcomes.map((x) => `${x.channel === 'email' ? '繝｡繝ｼ繝ｫ' : 'LINE'}騾∽ｿ｡繧ｨ繝ｩ繝ｼ: ${x.message || '驟堺ｿ｡蜈医・險ｭ螳壹ｒ縺皮｢ｺ隱阪￥縺縺輔＞'}`).join(' / '));
      }
    } catch (e: any) {
      setError(e.message || '騾∽ｿ｡縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 笏笏 Return to origin button (when opened as full page from another screen) 笏笏 */}
      {variant === 'page' && originTab && onReturnToOrigin && (
        <div className="flex items-center justify-between bg-purple-50/70 border border-purple-200/80 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-purple-900">
            <span className="font-semibold">驕ｷ遘ｻ蜈・・逕ｻ髱｢:</span>
            <span className="font-bold">{originTabLabel || originTab}</span>
          </div>
          <button
            type="button"
            onClick={onReturnToOrigin}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>蜈・・逕ｻ髱｢縺ｫ謌ｻ繧・/span>
          </button>
        </div>
      )}

      {/* 笏笏 Top Header (Only on standalone page) 笏笏 */}
      {variant === 'page' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <h1 className="text-[19px] font-bold text-slate-800 tracking-tight">繝｡繝ｼ繝ｫ繝ｻLINE騾∽ｿ｡邂｡逅・/h1>

          {/* 逕ｻ髱｢蛻・ｊ譖ｿ縺医ち繝・*/}
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
              <span>騾∽ｿ｡螻･豁ｴ</span>
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
              <span>蛟句挨騾∽ｿ｡・・蟇ｾ1・・/span>
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
              <span>荳譁蛾・菫｡・・蟇ｾN・・/span>
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
              <span>譁・ｾ九・LINE邏譚舌せ繝医ャ繧ｯ</span>
            </button>

            {onNavigateTab && (
              <div className="flex items-center gap-1.5 sm:ml-2 sm:pl-2 sm:border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => onNavigateTab('inbox_hub')}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="蜿嶺ｿ｡繝医Ξ繧､繧帝幕縺・
                >
                  <Inbox className="h-3.5 w-3.5 text-purple-600" />
                  <span>蜿嶺ｿ｡繝医Ξ繧､</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('document_templates')}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  title="謠先｡域嶌繝ｻ隕狗ｩ肴嶌繝ｻ螂醍ｴ・嶌繝ｻ隲区ｱよ嶌縺ｮ菴懈・繧帝幕縺・
                >
                  <FileText className="h-3.5 w-3.5 text-purple-600" />
                  <span>譖ｸ鬘樔ｽ懈・</span>
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
                螳帛・: <strong className="text-slate-900">{contact.full_name} 讒・/strong> {companies[contact.company_id || ''] && `(${companies[contact.company_id || '']})`}
              </span>
            )}
            {kind === 'document' && doc && (
              <span className="text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                譖ｸ鬘・ <strong className="text-purple-700">{doc.title}</strong>
              </span>
            )}
            {(kind === 'form' || kind === 'diagnosis') && form && (
              <span className="text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                繝輔か繝ｼ繝: <strong className="text-purple-700">{form.name}</strong>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDrawerSettings((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors shrink-0"
            title="螳帛・繝ｻ譖ｸ鬘槭・蟾ｮ蜃ｺ莠ｺ繝ｻ譁・ｾ九↑縺ｩ縺ｮ隧ｳ邏ｰ險ｭ螳壹ｒ陦ｨ遉ｺ/髱櫁｡ｨ遉ｺ"
          >
            <Settings2 className="h-3.5 w-3.5 text-purple-600" />
            <span>{showDrawerSettings ? '隧ｳ邏ｰ險ｭ螳壹ｒ髢峨§繧・ : '螳帛・繝ｻ隧ｳ邏ｰ險ｭ螳・}</span>
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
              <span>蜈・・逕ｻ髱｢縺ｫ謌ｻ繧具ｼ・originTabLabel || originTab}・・/span>
            </button>
          )}
        </div>
      )}

      {/* 逕ｻ髱｢1: 荳譁蛾・菫｡・・蟇ｾN・・*/}
      {screen === 'broadcast' && (
        <MarketingBroadcastView initialChannel={initialBroadcastChannel} />
      )}

      {/* 逕ｻ髱｢2: 蛟句挨騾∽ｿ｡・・蟇ｾ1・・*/}
      {screen === 'send' && (
        <>
          {/* 繝峨Ο繝ｯ繝ｼ陦ｨ遉ｺ譎ゑｼ・ariant === 'drawer'・・ 隧ｳ邏ｰ險ｭ螳夲ｼ井ｸ企Κ繧｢繧ｳ繝ｼ繝・ぅ繧ｪ繝ｳ・俄・ 莉ｶ蜷阪・譛ｬ譁・竊・騾∽ｿ｡繝懊ち繝ｳ 縺ｮ鬆・〒驟咲ｽｮ */}
          {variant === 'drawer' && (
            <div className="space-y-4">

              {/* 竭 隧ｳ邏ｰ險ｭ螳壹ヨ繧ｰ繝ｫ繝懊ち繝ｳ・域怙荳企Κ・会ｼ・繧｢繧ｳ繝ｼ繝・ぅ繧ｪ繝ｳ繧ｨ繝ｪ繧｢ */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDrawerSettings((prev) => !prev)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings2 className="h-4 w-4 text-purple-600" />
                    <span>螳帛・繝ｻ譖ｸ鬘槭・騾∽ｿ｡譁ｹ豕輔・蟾ｮ蜃ｺ莠ｺ縺ｮ螟画峩・郁ｩｳ邏ｰ險ｭ螳夲ｼ・/span>
                  </span>
                  {showDrawerSettings ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                </button>
                {/* 繧｢繧ｳ繝ｼ繝・ぅ繧ｪ繝ｳ螻暮幕繧ｨ繝ｪ繧｢・医ヨ繧ｰ繝ｫ縺ｮ逶ｴ荳具ｼ・*/}
                {showDrawerSettings && (
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 grid gap-4 md:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700">
                      騾∽ｿ｡蜀・ｮｹ
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
                      騾∽ｿ｡譁ｹ豕・                      <select
                        value={channel}
                        onChange={(e) => {
                          const next = e.target.value as Channel;
                          setChannel(next);
                          if (next !== 'both') setTemplateChannel(next);
                        }}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        <option value="email">繝｡繝ｼ繝ｫ</option>
                        <option value="line">LINE</option>
                        <option value="both">繝｡繝ｼ繝ｫ ・・LINE・亥酔譎る∽ｿ｡・・/option>
                      </select>
                    </label>
                    <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                      騾∽ｿ｡蜈・                      <select
                        value={contactId}
                        onChange={(e) => {
                          userInteractedContactRef.current = true;
                          setContactId(e.target.value);
                        }}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        <option value="">騾｣邨｡蜈医ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                        {contacts.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.full_name} ﾂｷ {companies[x.company_id || ''] || '譛ｪ險ｭ螳・} ﾂｷ{' '}
                            {channel === 'both'
                              ? `${x.email ? '繝｡繝ｼ繝ｫ縺ゅｊ' : '繝｡繝ｼ繝ｫ譛ｪ逋ｻ骭ｲ'} ﾂｷ ${x.line_user_id ? 'LINE騾｣謳ｺ' : 'LINE譛ｪ騾｣謳ｺ'}`
                              : channel === 'email'
                              ? x.email || '繝｡繝ｼ繝ｫ譛ｪ逋ｻ骭ｲ'
                              : x.line_user_id ? 'LINE騾｣謳ｺ' : 'LINE譛ｪ騾｣謳ｺ'}
                          </option>
                        ))}
                      </select>
                      {unregisteredEmailWarning && !contactId && (
                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 shadow-2xs">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>縺薙・繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺ｯ騾｣邨｡蜈医↓譛ｪ逋ｻ骭ｲ縺ｧ縺吶ょ・縺ｫ騾｣邨｡蜈医ｒ逋ｻ骭ｲ縺励※縺上□縺輔＞</span>
                        </div>
                      )}
                    </label>
                    {/* 譁・ｾ九せ繝医ャ繧ｯ */}
                    {templateChannel === 'email' && (
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">繝｡繝ｼ繝ｫ譁・ｾ九せ繝医ャ繧ｯ・井ｻｻ諢丞ｼ慕畑・・/label>
                        <select
                          value={selectedEmailTemplateId}
                          onChange={(e) => chooseEmailTemplate(e.target.value)}
                          className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                        >
                          <option value="">迴ｾ蝨ｨ縺ｮ騾∽ｿ｡遞ｮ蛻･・・labels[kind]}・峨・讓呎ｺ門・譛滓枚髱｢</option>
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
                        <label className="text-xs font-semibold text-slate-700">LINE譁・ｾ九・邏譚舌せ繝医ャ繧ｯ・井ｻｻ諢丞ｼ慕畑・・/label>
                        <select
                          value={selectedLineTemplateId}
                          onChange={(e) => chooseLineTemplate(e.target.value)}
                          className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                        >
                          <option value="">迴ｾ蝨ｨ縺ｮ騾∽ｿ｡遞ｮ蛻･・・labels[kind]}・峨・讓呎ｺ悶ユ繧ｭ繧ｹ繝・/option>
                          {lineTemplates.map((x: any) => (
                            <option key={x.id} value={x.id}>
                              {x.name}・・x.reply_type === 'text' ? '繝・く繧ｹ繝・ : x.reply_type === 'image' ? '逕ｻ蜒・ : x.reply_type === 'video' ? '蜍慕判' : 'Flex'}・・                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {kind === 'sales_outreach' && (
                      <div className="md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5">
                        <label className="block text-xs font-bold text-purple-900">
                          蝟ｶ讌ｭ繝｡繝ｼ繝ｫ遞ｮ蛻･・・contact?.company_id ? (companies[contact.company_id] || '驕ｸ謚樔ｸｭ') + (' ﾂｷ 讌ｭ遞ｮ: ' + (companyIndustries[contact.company_id] || '荳闊ｬ繝ｻ譛ｪ險ｭ螳・)) : '騾∽ｿ｡蜈医ｒ驕ｸ縺ｶ縺ｨ讌ｭ遞ｮ繝ｻ遉ｾ蜷阪ｒ閾ｪ蜍募渚譏'}・・                          <select
                            value={salesStep}
                            onChange={(e) => {
                              const s = Number(e.target.value);
                              setSalesStep(Number.isFinite(s) ? s : 0);
                              applySalesStep(Number.isFinite(s) ? s : 0);
                            }}
                            className="mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600"
                          >
                            <option value={0}>縲蝉ｸ逋ｺ逶ｴ逅・署譯医選T諡・ｽ難ｼ狗ｵ悟霧繧ｵ繝昴・繝医檎､ｾ螟門承閻輔阪・縺疲署譯茨ｼ亥腰逋ｺ繝｡繝ｼ繝ｫ・・/option>
                            <option value={1}>縲・繧ｹ繝・ャ繝怜・蝗槭第･ｭ逡梧･謇謠占ｵｷ ・・3蛻・┌譁呵ｨｺ譁ｭ繧ｮ繝輔ヨ・磯∽ｿ｡蠕・縲・騾夂岼縺ｮ閾ｪ蜍戊ｿｽ螳｢蜿ｯ・・/option>
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
                              <strong className="text-purple-900">2騾夂岼莉･髯阪ｂ閾ｪ蜍輔〒騾√ｋ</strong>
                              ・育ｬｬ1騾壹・3譌･繝ｻ6譌･繝ｻ9譌･繝ｻ12譌･蠕後・縲・8譎ゅ↓騾∽ｿ｡・・                            </span>
                          </label>
                        )}
                      </div>
                    )}
                    {/* 譖ｸ鬘樣未騾｣ */}
                    {kind === 'document' && (
                      <>
                        <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                          譖ｸ鬘槭・遞ｮ鬘・                          <select
                            value={documentType}
                            onChange={(e) => {
                              userInteractedDocumentRef.current = true;
                              handleDocumentTypeChange(e.target.value as DocumentType);
                            }}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                          >
                            <option value="proposal">謠先｡域嶌・郁ｨｺ譁ｭ邨先棡・九＃謠先｡茨ｼ・/option>
                            <option value="estimate">隕狗ｩ肴嶌</option>
                            <option value="invoice">隲区ｱよ嶌</option>
                            <option value="contract">螂醍ｴ・嶌</option>
                            <option value="monthly_report">譛域ｬ｡蝣ｱ蜻頑嶌</option>
                            {(documentType === 'diagnosis_report' || docs.some((x) => documentCategory(x) === 'diagnosis_report')) && (
                              <option value="diagnosis_report">險ｺ譁ｭ繝ｬ繝昴・繝茨ｼ域立蜊倅ｽ薙・莠呈鋤・・/option>
                            )}
                            <option value="other">縺昴・莉・/option>
                          </select>
                        </label>
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            譖ｸ鬘橸ｼ育｢ｺ螳壽嶌鬘槭・縺ｿ騾∽ｿ｡蜿ｯ閭ｽ・・                            <select
                              value={docId}
                              onChange={(e) => {
                                userInteractedDocumentRef.current = true;
                                setDocId(e.target.value);
                              }}
                              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                            >
                              <option value="">譖ｸ鬘槭ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                              {availableDocs.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.title} ﾂｷ {({ draft: '菴懈・荳ｭ', awaiting_approval: '菴懈・荳ｭ', approved: '遒ｺ螳夲ｼ磯∽ｻ伜庄閭ｽ・・, queued: '騾∽ｿ｡蠕・■', sent: '騾∽ｿ｡貂医∩', failed: '騾∽ｿ｡螟ｱ謨・, archived: '菫晉ｮ｡' } as Record<string, string>)[x.status] || x.status}
                                </option>
                              ))}
                            </select>
                          </label>
                          {availableDocs.length === 0 && (
                            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                              <span>驕ｸ謚槭＠縺滉ｼ夂､ｾ縺ｫ縺ｯ縲√％縺ｮ遞ｮ鬘槭・譖ｸ鬘槭′縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ縲・/span>
                              {onNavigateTab && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('document_templates')}
                                  className="font-bold text-purple-700 hover:underline shrink-0 cursor-pointer"
                                >
                                  譖ｸ鬘樔ｽ懈・縺ｸ
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {(kind === 'form' || kind === 'diagnosis') && (
                      <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                        蜈ｬ髢九ヵ繧ｩ繝ｼ繝
                        <select
                          value={formId}
                          onChange={(e) => {
                            setFormId(e.target.value);
                            const f = forms.find((x: any) => x.id === e.target.value);
                            if (f) setUrl(window.location.origin + '/f/' + encodeURIComponent(f.public_slug));
                          }}
                          className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                        >
                          <option value="">蜈ｬ髢九ヵ繧ｩ繝ｼ繝繧帝∈謚槭＠縺ｦ縺上□縺輔＞</option>
                          {forms.map((f: any) => (
                            <option key={f.id} value={f.id}>{f.name} ﾂｷ {f.form_type}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                      {kind === 'document' ? '蜈ｱ譛牙庄閭ｽ縺ｪ譖ｸ鬘朸RL' : kind === 'deal' || kind === 'customer_meeting' ? '髱｢隲・｡亥・URL・・imeRex莠育ｴФRL・・ : '繝輔か繝ｼ繝繝ｻ譯亥・URL'}
                      <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" placeholder="https://..." />
                    </label>

                    {/* 髱｢隲・｡亥・譎ゅ・繝薙ョ繧ｪ莨夊ｭｰ繝・・繝ｫ蛻・ｊ譖ｿ縺茨ｼ・oogle Meet / Zoom・・*/}
                    {(kind === 'deal' || kind === 'customer_meeting') && (
                      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-purple-50/70 border border-purple-200">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-purple-900">髱｢隲・ン繝・が繝・・繝ｫ:</span>
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
                          莠育ｴФRL: <span className="font-mono text-purple-700 font-semibold">{bookingUrl || 'https://timerex.net/s/mstcorp/c3dd3eea'}</span>
                          {!bookingUrl && <span className="text-[10px] text-slate-400 ml-1">・域ｨ呎ｺ傍imeRex・・/span>}
                        </span>
                      </div>
                    )}
                    {/* 蟾ｮ蜃ｺ莠ｺ險ｭ螳・*/}
                    {(channel === 'email' || channel === 'both') && (
                      <>
                        <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                          蟾ｮ蜃ｺ莠ｺ蜷・                          <input
                            value={senderSettings.fromName}
                            onChange={(e) => setSenderSettings((x) => ({ ...x, fromName: e.target.value }))}
                            maxLength={100}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                            placeholder="譛蛾剞莨夂､ｾMST"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">
                          蟾ｮ蜃ｺ莠ｺ繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ
                          <input
                            type="email"
                            value={senderSettings.fromEmail}
                            onChange={(e) => setSenderSettings((x) => ({ ...x, fromEmail: e.target.value }))}
                            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">
                          霑比ｿ｡蜈茨ｼ・eply-To・・                          <div className="flex gap-1.5 mt-1">
                            {senderSettings.fromEmail && senderSettings.replyTo !== senderSettings.fromEmail && (
                              <button type="button" onClick={() => setSenderSettings((x) => ({ ...x, replyTo: x.fromEmail }))}
                                className="text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-0.5 rounded font-semibold cursor-pointer border border-purple-200">
                                蜈ｬ蠑上ラ繝｡繧､繝ｳ縺ｫ謌ｻ縺・                              </button>
                            )}
                            {senderSettings.replyTo !== 'mst.shikumikaizen@gmail.com' && (
                              <button type="button" onClick={() => setSenderSettings((x) => ({ ...x, replyTo: 'mst.shikumikaizen@gmail.com' }))}
                                className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded font-medium cursor-pointer border border-slate-300">
                                邱頑･逕ｨGmail縺ｫ蛻・崛
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
                            {savingSenderSettings ? '菫晏ｭ倅ｸｭ窶ｦ' : '蟾ｮ蜃ｺ莠ｺ譌｢螳壼､繧剃ｿ晏ｭ・}
                          </button>
                        </div>
                      </>
                    )}
                    <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                      騾∽ｿ｡譬ｹ諡・域ｳ戊ｦ上・蜷梧э險倬鹸・・                      <input
                        value={basis}
                        onChange={(e) => setBasis(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 竭｡ 莉ｶ蜷榊・蜉・(繝｡繝ｼ繝ｫ縺ｮ蝣ｴ蜷・ */}
              {templateChannel === 'email' && (
                <div>
                  <label className="text-xs font-bold text-slate-800">莉ｶ蜷・/label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs font-medium"
                    placeholder="莉ｶ蜷阪ｒ蜈･蜉・.."
                  />
                  <PlaceholderAssist text={subject} onInsert={(token) => setSubject((curr) => curr + token)} />
                </div>
              )}

              {/* 繝｡繝ｼ繝ｫ+LINE蜷梧凾騾∽ｿ｡譎ゅ・蛻・崛繧ｿ繝・*/}
              {channel === 'both' && (
                <div className="flex items-center gap-2 rounded-xl bg-purple-50/50 p-2 text-xs text-slate-700 border border-purple-200">
                  <span className="font-semibold text-purple-900 text-[11px]">邱ｨ髮・ｯｾ雎｡:</span>
                  <button
                    type="button"
                    onClick={() => setTemplateChannel('email')}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  >
                    繝｡繝ｼ繝ｫ譁・擇
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateChannel('line')}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'line' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  >
                    LINE譁・擇
                  </button>
                </div>
              )}

              {/* 竭｢ 譛ｬ譁・・蜉帙お繝ｪ繧｢ */}
              {(templateChannel !== 'line' || !selectedLineTemplate || selectedLineTemplate.reply_type === 'text') && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-800">譛ｬ譁・/label>
                      {(kind === 'document' || kind === 'form' || kind === 'diagnosis') && (
                        <span className="text-[11px] font-medium text-purple-700">
                          {kind === 'document' ? doc?.title || '譖ｸ鬘槭ユ繝ｳ繝励Ξ繝ｼ繝・ : form?.name || '繝輔か繝ｼ繝'}
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
                        title="迴ｾ蝨ｨ縺ｮ莉ｶ蜷阪・譛ｬ譁・ｒ逋ｽ邏咏憾諷九↓繧ｯ繝ｪ繧｢"
                      >
                        <Eraser className="h-3 w-3 text-slate-500" />
                        <span>逋ｽ邏吝喧</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsComposerExpanded(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                        title="譁・擇菴懈・繧ｨ繝ｪ繧｢繧貞・逕ｻ髱｢陦ｨ遉ｺ"
                      >
                        <Maximize2 className="h-3 w-3 text-purple-600" />
                        <span>蜈ｨ逕ｻ髱｢</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="mt-1 block w-full min-h-[200px] resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 font-sans leading-relaxed focus:border-purple-600 focus:outline-none shadow-2xs"
                    placeholder="譛ｬ譁・ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞..."
                  />
                  {templateChannel === 'email' && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      窶ｻ 繝｡繝ｼ繝ｫ騾∽ｿ｡譎ゅ・譛ｫ蟆ｾ縺ｫ邨ｱ荳鄂ｲ蜷搾ｼ域怏髯蝉ｼ夂､ｾMST繝ｻ菴乗園繝ｻHP繝ｻMail・峨′閾ｪ蜍穂ｻ倅ｸ弱＆繧後∪縺吶・                    </p>
                  )}
                  <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
                </div>
              )}

              {/* 竭｣ 豺ｻ莉俶嶌鬘槭し繝槭Μ繝ｼ・医ラ繝ｭ繝ｯ繝ｼ陦ｨ遉ｺ逕ｨ・・*/}
              {kind === 'document' && doc && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-bold text-purple-950 truncate">{doc.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-white border border-purple-200 text-purple-700 shrink-0">
                      PDF閾ｪ蜍墓ｷｻ莉・                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`/api/documents/${encodeURIComponent(doc.id)}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>PDF遒ｺ隱・/span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setPreviewDocModal(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-100/80 text-xs font-bold cursor-pointer shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-purple-600" />
                      <span>譖ｸ鬘槭・繝ｬ繝薙Η繝ｼ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 竭､ 繝励Ξ繝薙Η繝ｼ繝ｻ騾∽ｿ｡繝懊ち繝ｳ */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {!preview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      if (!contact) {
                        setError('騾∽ｿ｡蜈医ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲ゆｸ翫・縲瑚ｩｳ邏ｰ險ｭ螳壹阪°繧蛾∈謚槭〒縺阪∪縺吶・);
                        setShowDrawerSettings(true);
                        return;
                      }
                      if (kind === 'document' && !doc) {
                        setError('騾∽ｿ｡縺吶ｋ譖ｸ鬘槭ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲ゆｸ翫・縲瑚ｩｳ邏ｰ險ｭ螳壹阪°繧蛾∈謚槭〒縺阪∪縺吶・);
                        setShowDrawerSettings(true);
                        return;
                      }
                      if ((kind === 'form' || kind === 'diagnosis') && !form) {
                        setError('繝輔か繝ｼ繝繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲ゆｸ翫・縲瑚ｩｳ邏ｰ險ｭ螳壹阪°繧蛾∈謚槭〒縺阪∪縺吶・);
                        setShowDrawerSettings(true);
                        return;
                      }
                      setPreview(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs shadow-purple-600/20 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    騾∽ｿ｡繝励Ξ繝薙Η繝ｼ繧堤｢ｺ隱・                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                    {busy ? '騾∽ｿ｡荳ｭ窶ｦ' : '遒ｺ螳壹＠縺ｦ騾∽ｿ｡縺吶ｋ'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  title="譁・擇繧偵ユ繝ｳ繝励Ξ繝ｼ繝医→縺励※菫晏ｭ・
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>繝・Φ繝励Ξ繝ｼ繝井ｿ晏ｭ・/span>
                </button>
              </div>
            </div>
          )}

          {/* 繝輔か繝ｼ繝險ｭ螳壽ｬ・ 繝壹・繧ｸ陦ｨ遉ｺ譎ゅ・縺ｿ蟶ｸ譎り｡ｨ遉ｺ・医ラ繝ｭ繝ｯ繝ｼ陦ｨ遉ｺ譎ゅ・荳企Κ繧｢繧ｳ繝ｼ繝・ぅ繧ｪ繝ｳ縺ｧ蟇ｾ蠢懶ｼ・*/}
          {variant === 'page' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                騾∽ｿ｡蜀・ｮｹ
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
                騾∽ｿ｡譁ｹ豕・                <select
                  value={channel}
                  onChange={(e) => {
                    const next = e.target.value as Channel;
                    setChannel(next);
                    if (next !== 'both') setTemplateChannel(next);
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="email">繝｡繝ｼ繝ｫ</option>
                  <option value="line">LINE</option>
                  <option value="both">繝｡繝ｼ繝ｫ ・・LINE・亥酔譎る∽ｿ｡・・/option>
                </select>
              </label>
              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                騾∽ｿ｡蜈・                <select
                  value={contactId}
                  onChange={(e) => {
                    userInteractedContactRef.current = true;
                    setContactId(e.target.value);
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                >
                  <option value="">騾｣邨｡蜈医ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                  {contacts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.full_name} ﾂｷ {companies[x.company_id || ''] || '譛ｪ險ｭ螳・} ﾂｷ{' '}
                      {channel === 'both'
                        ? `${x.email ? '繝｡繝ｼ繝ｫ縺ゅｊ' : '繝｡繝ｼ繝ｫ譛ｪ逋ｻ骭ｲ'} ﾂｷ ${x.line_user_id ? 'LINE騾｣謳ｺ' : 'LINE譛ｪ騾｣謳ｺ'}`
                        : channel === 'email'
                        ? x.email || '繝｡繝ｼ繝ｫ譛ｪ逋ｻ骭ｲ'
                        : x.line_user_id
                        ? 'LINE騾｣謳ｺ'
                        : 'LINE譛ｪ騾｣謳ｺ'}
                    </option>
                  ))}
                </select>
                {unregisteredEmailWarning && !contactId && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 shadow-2xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>縺薙・繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺ｯ騾｣邨｡蜈医↓譛ｪ逋ｻ骭ｲ縺ｧ縺吶ょ・縺ｫ騾｣邨｡蜈医ｒ逋ｻ骭ｲ縺励※縺上□縺輔＞</span>
                  </div>
                )}
              </label>

              {kind === 'sales_outreach' && (
                <div className="md:col-span-2 space-y-2 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5">
                  <label className="block text-xs font-bold text-purple-900">
                    蝟ｶ讌ｭ繝｡繝ｼ繝ｫ遞ｮ蛻･・・contact?.company_id ? (companies[contact.company_id] || '驕ｸ謚樔ｸｭ') + (' ﾂｷ 讌ｭ遞ｮ: ' + (companyIndustries[contact.company_id] || '荳闊ｬ繝ｻ譛ｪ險ｭ螳・)) : '騾∽ｿ｡蜈医ｒ驕ｸ縺ｶ縺ｨ讌ｭ遞ｮ繝ｻ遉ｾ蜷阪ｒ閾ｪ蜍募渚譏'}・・                    <select
                      value={salesStep}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        setSalesStep(Number.isFinite(s) ? s : 0);
                        applySalesStep(Number.isFinite(s) ? s : 0);
                      }}
                      className="mt-1 block w-full bg-white p-2.5 text-xs text-slate-900 rounded-lg border border-purple-200 focus:outline-none focus:border-purple-600"
                    >
                      <option value={0}>縲蝉ｸ逋ｺ逶ｴ逅・署譯医選T諡・ｽ難ｼ狗ｵ悟霧繧ｵ繝昴・繝医檎､ｾ螟門承閻輔阪・縺疲署譯茨ｼ亥腰逋ｺ繝｡繝ｼ繝ｫ・・/option>
                      <option value={1}>縲・繧ｹ繝・ャ繝怜・蝗槭第･ｭ逡梧･謇謠占ｵｷ ・・3蛻・┌譁呵ｨｺ譁ｭ繧ｮ繝輔ヨ・磯∽ｿ｡蠕・縲・騾夂岼縺ｮ閾ｪ蜍戊ｿｽ螳｢蜿ｯ・・/option>
                    </select>
                  </label>
                  <p className="text-[11px] text-purple-800">
                    窶ｻ 騾∽ｿ｡譎ゅ↓鄂ｲ蜷搾ｼ育､ｾ蜷阪・菴乗園繝ｻHP繝ｻMail・峨→驟堺ｿ｡蛛懈ｭ｢繝ｪ繝ｳ繧ｯ縺瑚・蜍輔〒莉倥″縺ｾ縺吶りｦ玖ｾｼ縺ｿ莨∵･ｭ繝ｪ繧ｹ繝医°繧我ｸ諡ｬ繝ｻ莠育ｴ・ヨ繝ｪ繧ｬ繝ｼ逋ｺ轣ｫ縺吶ｋ縺薙→繧ゅ〒縺阪∪縺吶・                  </p>
                  {salesStep === 1 && channel !== 'line' && (
                    <label className="flex items-start gap-2 rounded-lg border border-purple-200 bg-white p-2.5 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoFollowups}
                        onChange={(e) => setAutoFollowups(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-purple-600"
                      />
                      <span>
                        <strong className="text-purple-900">2騾夂岼莉･髯阪ｂ閾ｪ蜍輔〒騾√ｋ</strong>
                        ・育ｬｬ1騾壹・3譌･繝ｻ6譌･繝ｻ9譌･繝ｻ12譌･蠕後・縲・8譎ゅ↓騾∽ｿ｡・・                        <span className="block text-[11px] text-slate-500">
                          霑比ｿ｡繝ｻ險ｺ譁ｭ縺ｮ蝗樒ｭ斐・髱｢隲・・莠育ｴ・・驟堺ｿ｡蛛懈ｭ｢繝ｻ荳埼＃縺後≠繧後・縲∵ｮ九ｊ縺ｯ閾ｪ蜍輔〒豁｢縺ｾ繧翫∪縺吶・騾壹□縺鷹√ｋ蝣ｴ蜷医・繝√ぉ繝・け縺励↑縺・〒縺上□縺輔＞縲・                        </span>
                      </span>
                    </label>
                  )}
                </div>
              )}

              {(kind === 'form' || kind === 'diagnosis') && (
                <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                  蜈ｬ髢九ヵ繧ｩ繝ｼ繝
                  <select
                    value={formId}
                    onChange={(e) => {
                      setFormId(e.target.value);
                      const f = forms.find((x: any) => x.id === e.target.value);
                      if (f) setUrl(window.location.origin + '/f/' + encodeURIComponent(f.public_slug));
                    }}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="">蜈ｬ髢九ヵ繧ｩ繝ｼ繝繧帝∈謚槭＠縺ｦ縺上□縺輔＞</option>
                    {forms.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ﾂｷ {f.form_type}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {kind === 'document' && (
                <>
                  <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                    譖ｸ鬘槭・遞ｮ鬘・                    <select
                      value={documentType}
                      onChange={(e) => {
                        userInteractedDocumentRef.current = true;
                        handleDocumentTypeChange(e.target.value as DocumentType);
                      }}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                    >
                      <option value="proposal">謠先｡域嶌・郁ｨｺ譁ｭ邨先棡・九＃謠先｡茨ｼ・/option>
                      <option value="estimate">隕狗ｩ肴嶌</option>
                      <option value="invoice">隲区ｱよ嶌</option>
                      <option value="contract">螂醍ｴ・嶌</option>
                      <option value="monthly_report">譛域ｬ｡蝣ｱ蜻頑嶌</option>
                      {(documentType === 'diagnosis_report' || docs.some((x) => documentCategory(x) === 'diagnosis_report')) && (
                        <option value="diagnosis_report">險ｺ譁ｭ繝ｬ繝昴・繝茨ｼ域立蜊倅ｽ薙・莠呈鋤・・/option>
                      )}
                      <option value="other">縺昴・莉・/option>
                    </select>
                  </label>
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      譖ｸ鬘橸ｼ・contact?.company_id ? (companies[contact.company_id] || '驕ｸ謚槭＠縺滉ｼ夂､ｾ') + '縺ｮ譖ｸ鬘・ : initialCompanyId ? (companies[initialCompanyId] || '縺薙・莨夂､ｾ') + '縺ｮ譖ｸ鬘・ : '騾∽ｿ｡蜈医ｒ驕ｸ縺ｶ縺ｨ莨夂､ｾ縺ｮ譖ｸ鬘槭〒邨槭ｊ霎ｼ縺ｿ'}繝ｻ遒ｺ螳壽嶌鬘槭・縺ｿ騾∽ｿ｡蜿ｯ閭ｽ・・                      <select
                        value={docId}
                        onChange={(e) => {
                          userInteractedDocumentRef.current = true;
                          setDocId(e.target.value);
                        }}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      >
                        <option value="">譖ｸ鬘槭ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                        {availableDocs.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title} ﾂｷ {({ draft: '菴懈・荳ｭ', awaiting_approval: '菴懈・荳ｭ', approved: '遒ｺ螳夲ｼ磯∽ｻ伜庄閭ｽ・・, queued: '騾∽ｿ｡蠕・■', sent: '騾∽ｿ｡貂医∩', failed: '騾∽ｿ｡螟ｱ謨・, archived: '菫晉ｮ｡' } as Record<string, string>)[x.status] || x.status}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* 豺ｻ莉俶嶌鬘槭・繝ｬ繝薙Η繝ｼ繧ｫ繝ｼ繝・& 繧｢繧ｯ繧ｷ繝ｧ繝ｳ */}
                    {doc ? (
                      <div className="space-y-2">
                        <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="w-4 h-4 text-purple-600 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-purple-950 truncate">{doc.title}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-white border border-purple-200 text-purple-700">
                                  {({ draft: '菴懈・荳ｭ', awaiting_approval: '菴懈・荳ｭ', approved: '遒ｺ螳夲ｼ磯∽ｻ伜庄閭ｽ・・, queued: '騾∽ｿ｡蠕・■', sent: '騾∽ｿ｡貂医∩' } as Record<string, string>)[doc.status] || doc.status}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {contact?.company_id && companies[contact.company_id] ? `${companies[contact.company_id]} 螳嫣 : ''} ﾂｷ PDF閾ｪ蜍墓ｷｻ莉・&amp; Web遒ｺ隱攻RL閾ｪ蜍墓諺蜈･
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`/api/documents/${encodeURIComponent(doc.id)}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title="繝｡繝ｼ繝ｫ縺ｫ豺ｻ莉倥＆繧後ｋPDF繝輔ぃ繧､繝ｫ繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝臥｢ｺ隱・
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>PDF遒ｺ隱・/span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal(doc)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-100/80 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-600" />
                              <span>譖ｸ鬘槭ｒ繝励Ξ繝薙Η繝ｼ</span>
                            </button>
                          </div>
                        </div>
                        <div className="rounded-lg bg-purple-100/70 px-3 py-1.5 text-[11px] text-purple-950 flex items-center gap-1.5">
                          <span className="font-bold">梼 閾ｪ蜍姫DF豺ｻ莉・</span>
                          <span>繝｡繝ｼ繝ｫ騾∽ｿ｡譎ゅ√％縺ｮ譖ｸ鬘槭・A4 PDF縺瑚・蜍慕函謌舌＆繧後※豺ｻ莉倥ヵ繧｡繧､繝ｫ縺ｨ縺励※騾∽ｿ｡縺輔ｌ縺ｾ縺呻ｼ・eb遒ｺ隱攻RL繧よ悽譁・↓險倩ｼ会ｼ峨・/span>
                        </div>
                      </div>
                    ) : availableDocs.length === 0 ? (
                      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
                        <span>驕ｸ謚槭＠縺滉ｼ夂､ｾ縺ｫ縺ｯ縲√％縺ｮ遞ｮ鬘槭・譖ｸ鬘槭′縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ縲・/span>
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('document_templates')}
                            className="font-bold text-purple-700 hover:underline shrink-0 cursor-pointer"
                          >
                            譖ｸ鬘樔ｽ懈・縺ｸ
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        窶ｻ 荳願ｨ倥〒譖ｸ鬘槭ｒ驕ｸ謚槭☆繧九→縲∝・螳ｹ縺ｮ繝励Ξ繝薙Η繝ｼ遒ｺ隱阪′縺ｧ縺阪∪縺吶・                      </div>
                    )}
                  </div>
                </>
              )}

              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                {kind === 'document' ? '蜈ｱ譛牙庄閭ｽ縺ｪ譖ｸ鬘朸RL' : kind === 'deal' || kind === 'customer_meeting' ? '髱｢隲・｡亥・URL・・imeRex莠育ｴФRL・・ : '繝輔か繝ｼ繝繝ｻ譯亥・URL'}
                <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs" placeholder="https://..." />
              </label>

              {(channel === 'email' || channel === 'both') && (
                <>
                  <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                    蟾ｮ蜃ｺ莠ｺ蜷・                    <input
                      value={senderSettings.fromName}
                      onChange={(e) => setSenderSettings((x) => ({ ...x, fromName: e.target.value }))}
                      maxLength={100}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      placeholder="譛蛾剞莨夂､ｾMST"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    蟾ｮ蜃ｺ莠ｺ繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ
                    <input
                      type="email"
                      value={senderSettings.fromEmail}
                      onChange={(e) => setSenderSettings((x) => ({ ...x, fromEmail: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      placeholder="info@example.co.jp"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">RESEND_FROM_EMAIL縺ｧ隱崎ｨｼ貂医∩縺ｮ繝峨Γ繧､繝ｳ繧呈欠螳壹＠縺ｦ縺上□縺輔＞縲・/span>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5">
                        霑比ｿ｡蜈医Γ繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ・・eply-To・・                        {senderSettings.replyTo.trim() === (senderSettings.fromEmail || 'contact@mstcorp.info').trim() ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            莨∵･ｭ繝峨Γ繧､繝ｳ・域耳螂ｨ・・                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            蛟句挨繝ｻ邱頑･逕ｨ
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {senderSettings.fromEmail && senderSettings.replyTo !== senderSettings.fromEmail && (
                          <button
                            type="button"
                            onClick={() => setSenderSettings((x) => ({ ...x, replyTo: x.fromEmail }))}
                            className="text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-0.5 rounded font-semibold cursor-pointer border border-purple-200 transition-colors"
                            title="蟾ｮ蜃ｺ莠ｺ繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ・亥・蠑丈ｼ∵･ｭ繝峨Γ繧､繝ｳ・峨↓謌ｻ縺励∪縺・
                          >
                            蜈ｬ蠑上ラ繝｡繧､繝ｳ・域耳螂ｨ・峨↓謌ｻ縺・                          </button>
                        )}
                        {senderSettings.replyTo !== 'mst.shikumikaizen@gmail.com' && (
                          <button
                            type="button"
                            onClick={() => setSenderSettings((x) => ({ ...x, replyTo: 'mst.shikumikaizen@gmail.com' }))}
                            className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded font-medium cursor-pointer border border-slate-300 transition-colors"
                            title="邱頑･譎ゅ・逶ｴ謗･蛟句挨蟇ｾ蠢懃畑縺ｮ蛟倶ｺｺGmail螳帙※縺ｫ蛻・ｊ譖ｿ縺医∪縺・
                          >
                            邱頑･逕ｨ・壼倶ｺｺGmail縺ｫ蛻・崛
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="email"
                      value={senderSettings.replyTo}
                      onChange={(e) => setSenderSettings((x) => ({ ...x, replyTo: e.target.value }))}
                      className="mt-1 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                      placeholder="霑比ｿ｡蜈医ｒ螟画峩縺吶ｋ蝣ｴ蜷医↓蜈･蜉幢ｼ井ｻｻ諢擾ｼ・
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      窶ｻ 鬘ｧ螳｢縺瑚ｿ比ｿ｡縺励◆髫帙・螳帛・縺ｧ縺吶ゅョ繝輔か繝ｫ繝医・蜷御ｸ莨∵･ｭ繝峨Γ繧､繝ｳ・・senderSettings.fromEmail || 'contact@mstcorp.info'}・峨〒菫｡鬆ｼ諤ｧ縺ｨ蛻ｰ驕皮紫繧呈球菫昴＠縺ｾ縺吶らｷ頑･譎ゅｄ逶ｴ謗･蟇ｾ蠢懊′蠢・ｦ√↑蝣ｴ蜷医・縺ｿ縲悟倶ｺｺGmail縺ｫ蛻・崛縲阪・繧ｿ繝ｳ縺ｧ蛻・ｊ譖ｿ縺医′蜿ｯ閭ｽ縺ｧ縺吶・                    </span>
                  </label>
                </>
              )}

              {templateChannel === 'email' && (
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      繝｡繝ｼ繝ｫ譁・ｾ九せ繝医ャ繧ｯ・井ｻｻ諢丞ｼ慕畑・・                    </label>
                    <button
                      type="button"
                      onClick={() => setScreen('templates')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
                    >
                      <Library className="h-3.5 w-3.5" />
                      <span>譁・ｾ九・LINE邏譚舌せ繝医ャ繧ｯ繧帝幕縺・/span>
                    </button>
                  </div>
                  <select
                    value={selectedEmailTemplateId}
                    onChange={(e) => chooseEmailTemplate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="">迴ｾ蝨ｨ縺ｮ騾∽ｿ｡遞ｮ蛻･・・labels[kind]}・峨・讓呎ｺ門・譛滓枚髱｢</option>
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
                      LINE譁・ｾ九・邏譚舌せ繝医ャ繧ｯ・井ｻｻ諢丞ｼ慕畑・・                    </label>
                    <button
                      type="button"
                      onClick={() => setScreen('templates')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer"
                    >
                      <Library className="h-3.5 w-3.5" />
                      <span>譁・ｾ九・LINE邏譚舌せ繝医ャ繧ｯ繧帝幕縺・/span>
                    </button>
                  </div>
                  <select
                    value={selectedLineTemplateId}
                    onChange={(e) => chooseLineTemplate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-none shadow-2xs"
                  >
                    <option value="">迴ｾ蝨ｨ縺ｮ騾∽ｿ｡遞ｮ蛻･・・labels[kind]}・峨・讓呎ｺ悶ユ繧ｭ繧ｹ繝・/option>
                    {lineTemplates.map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}・・x.reply_type === 'text' ? '繝・く繧ｹ繝・ : x.reply_type === 'image' ? '逕ｻ蜒・ : x.reply_type === 'video' ? '蜍慕判' : 'Flex'}・・                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 繝壹・繧ｸ陦ｨ遉ｺ譎ゅ・莉ｶ蜷阪・譛ｬ譁・ｬ・ｼ医ラ繝ｭ繝ｯ繝ｼ陦ｨ遉ｺ譎ゅ・荳企Κ縺ｫ譌｢縺ｫ驟咲ｽｮ縺輔ｌ縺ｦ縺・ｋ縺溘ａ髱櫁｡ｨ遉ｺ・・*/}
              {variant === 'page' && (
                <>
                  {templateChannel === 'email' && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-700">莉ｶ蜷・/label>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                        placeholder="莉ｶ蜷阪ｒ蜈･蜉・.."
                      />
                      <PlaceholderAssist text={subject} onInsert={(token) => setSubject((curr) => curr + token)} />
                    </div>
                  )}

                  {(kind === 'deal' || kind === 'customer_meeting') && (
                    <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-slate-500">
                        莠育ｴ・・繝ｼ繧ｸURL: <span className="text-purple-700 font-mono font-medium">{bookingUrl || 'https://timerex.net/s/mstcorp/c3dd3eea'}</span>
                        {!bookingUrl && <span className="text-[10px] text-slate-400 ml-1">・域ｨ呎ｺ傍imeRex・・/span>}
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">繝薙ョ繧ｪ莨夊ｭｰ:</span>
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
                        <span className="text-slate-400 text-[11px]">・・imeRex蛛ｴ縺ｮ險ｭ螳壹→蜷医ｏ縺帙※縺上□縺輔＞・・/span>
                      </div>
                    </div>
                  )}

                  {channel === 'both' && (
                    <div className="md:col-span-2 flex items-center gap-2 rounded-xl bg-purple-50/50 p-2.5 text-xs text-slate-700 border border-purple-200">
                      <span className="font-semibold text-purple-900">邱ｨ髮・ｯｾ雎｡:</span>
                      <button
                        type="button"
                        onClick={() => setTemplateChannel('email')}
                        className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                      >
                        繝｡繝ｼ繝ｫ譁・擇
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateChannel('line')}
                        className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer text-xs ${templateChannel === 'line' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                      >
                        LINE譁・擇
                      </button>
                      <span className="text-slate-500 text-[11px]">窶ｻ繝｡繝ｼ繝ｫ縺ｨLINE縺ｧ蛻･縲・・譁・擇繧定ｨｭ螳壹・騾∽ｿ｡縺ｧ縺阪∪縺・/span>
                    </div>
                  )}

                  {(templateChannel !== 'line' || !selectedLineTemplate || selectedLineTemplate.reply_type === 'text') && (
                    <div className="md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-700">譛ｬ譁・/label>
                          {(kind === 'document' || kind === 'form' || kind === 'diagnosis') && (
                            <span className="text-xs font-medium text-purple-700">
                              菫晏ｭ伜ｯｾ雎｡: {kind === 'document' ? doc?.title || '蜈ｱ騾壽嶌鬘槭ユ繝ｳ繝励Ξ繝ｼ繝・ : form?.name || '蜈ｱ騾壹ユ繝ｳ繝励Ξ繝ｼ繝・}
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
                            title="迴ｾ蝨ｨ縺ｮ莉ｶ蜷阪・譛ｬ譁・ｒ逵溘▲縺輔ｉ縺ｪ逋ｽ邏咏憾諷九↓繧ｯ繝ｪ繧｢縺励∪縺・
                          >
                            <Eraser className="h-3.5 w-3.5 text-slate-500" />
                            <span>逋ｽ邏吶↓謌ｻ縺・/span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsComposerExpanded(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                            title="譁・擇菴懈・繧ｨ繝ｪ繧｢繧堤判髱｢蜈ｨ菴薙∈螟ｧ縺阪￥蠎・￡縺ｦ蜈･蜉帙＠縺ｾ縺・
                          >
                            <Maximize2 className="h-3.5 w-3.5 text-purple-600" />
                            <span>蜈ｨ逕ｻ髱｢縺ｧ蜈･蜉・/span>
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={12}
                        className="mt-1 block w-full min-h-[260px] resize-y rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-purple-600 focus:outline-none shadow-2xs"
                        placeholder="譛ｬ譁・ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞・育區邏吶°繧牙・蜉帙☆繧句ｴ蜷医・縲瑚・逕ｱ菴懈・縲阪∪縺溘・荳翫・縲檎區邏吶↓謌ｻ縺吶阪ｒ縺泌茜逕ｨ縺上□縺輔＞・・.."
                      />
                      {templateChannel === 'email' && (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          窶ｻ 繝｡繝ｼ繝ｫ騾∽ｿ｡譎ゅ・縺ｩ縺ｮ遞ｮ蛻･・郁・逕ｱ菴懈・繧貞性繧・峨〒繧よ忰蟆ｾ縺ｫ邨ｱ荳鄂ｲ蜷搾ｼ域怏髯蝉ｼ夂､ｾMST繝ｻ菴乗園繝ｻHP繝ｻMail・峨′閾ｪ蜍穂ｻ倅ｸ弱＆繧後∪縺呻ｼ亥霧讌ｭ繝ｻ譯亥・繝｡繝ｼ繝ｫ縺ｫ縺ｯ驟堺ｿ｡蛛懈ｭ｢繝ｪ繝ｳ繧ｯ繧り・蜍穂ｻ倅ｸ趣ｼ峨・                        </p>
                      )}
                      <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
                    </div>
                  )}
                </>
              )}

              <label className="md:col-span-2 text-xs font-semibold text-slate-700">
                騾∽ｿ｡譬ｹ諡・域ｳ戊ｦ上・蜷梧э險倬鹸・・                <input
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
                    {savingSenderSettings ? '菫晏ｭ倅ｸｭ窶ｦ' : '蟾ｮ蜃ｺ莠ｺ譌｢螳壼､繧剃ｿ晏ｭ・}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 繝壹・繧ｸ陦ｨ遉ｺ譎ゅ・荳矩Κ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝懊ち繝ｳ・医ラ繝ｭ繝ｯ繝ｼ陦ｨ遉ｺ譎ゅ・荳企Κ縺ｫ譌｢縺ｫ驟咲ｽｮ縺輔ｌ縺ｦ縺・ｋ縺溘ａ髱櫁｡ｨ遉ｺ・・*/}
          {variant === 'page' && (
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                <Save className="h-4 w-4" />
                繝・Φ繝励Ξ繝ｼ繝井ｿ晏ｭ假ｼ・templateChannel === 'email' ? '繝｡繝ｼ繝ｫ' : 'LINE'}・・              </button>
              {!preview ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    if (!contact) {
                      setError('騾∽ｿ｡蜈医ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲・);
                      return;
                    }
                    if (kind === 'document' && !doc) {
                      setError('騾∽ｿ｡縺吶ｋ譖ｸ鬘槭ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞縲・);
                      return;
                    }
                    if ((kind === 'form' || kind === 'diagnosis') && !form) {
                      setError('繝輔か繝ｼ繝繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲・);
                      return;
                    }
                    setPreview(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs shadow-purple-600/20 cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                  騾∽ｿ｡繝励Ξ繝薙Η繝ｼ繧堤｢ｺ隱・                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  {busy ? '騾∽ｿ｡荳ｭ窶ｦ' : '遒ｺ螳壹＠縺ｦ騾∽ｿ｡縺吶ｋ'}
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
                    <h3 className="font-bold text-slate-900 text-sm">騾∽ｿ｡逶ｴ蜑阪・繝ｬ繝薙Η繝ｼ・亥ｷｮ霎ｼ螟画焚蜿肴丐貂医∩・・/h3>
                    <p className="text-xs text-slate-600">
                      螟画焚・医♀蜷榊燕繝ｻ莨夂､ｾ蜷阪・譖ｸ鬘槫錐繝ｻURL遲会ｼ峨′縺吶∋縺ｦ螳溘ョ繝ｼ繧ｿ縺ｫ鄂ｮ縺肴鋤繧上▲縺溷ｮ滄圀縺ｮ陦ｨ遉ｺ縺ｧ縺・                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreview(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 cursor-pointer shadow-2xs"
                  >
                    <X className="h-3.5 w-3.5" />
                    繝励Ξ繝薙Η繝ｼ繧帝哩縺倥ｋ
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send()}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {busy ? '騾∽ｿ｡荳ｭ窶ｦ' : '遒ｺ螳壹＠縺ｦ騾∽ｿ｡縺吶ｋ'}
                  </button>
                </div>
              </div>

              {(channel === 'email' || channel === 'both') && (
                <div className="rounded-xl border border-slate-300 bg-white shadow-xs overflow-hidden">
                  {/* 繝｡繝ｼ繝ｫ繧ｯ繝ｩ繧､繧｢繝ｳ繝磯｢ｨ繝倥ャ繝繝ｼ */}
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-900">繝｡繝ｼ繝ｫ騾∽ｿ｡繝励Ξ繝薙Η繝ｼ</span>
                      </div>
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-700 font-bold text-[10px]">
                        SMTP / Resend 騾∽ｿ｡
                      </span>
                    </div>

                    <div className="grid gap-1.5 text-xs text-slate-700 pt-1">
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 font-bold text-slate-700">蟾ｮ蜃ｺ莠ｺ:</span>
                        <span className="text-slate-900 font-medium">
                          <strong className="font-bold text-slate-950">{senderSettings.fromName}</strong> &lt;{senderSettings.fromEmail || '譛ｪ險ｭ螳・}&gt;
                          {senderSettings.replyTo.trim() && (
                            <span className="text-slate-600 ml-2">・郁ｿ比ｿ｡蜈・ {senderSettings.replyTo}・・/span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 font-bold text-slate-700">螳帛・:</span>
                        <span className="text-slate-900 font-medium">
                          <strong className="font-bold text-slate-950">{contact?.full_name} 讒・/strong>
                          {contact?.email ? (
                            <span className="text-slate-700 font-mono ml-1.5">&lt;{contact.email}&gt;</span>
                          ) : (
                            <span className="ml-1.5 text-rose-600 font-bold">笞・・繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ譛ｪ逋ｻ骭ｲ</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 pt-1 border-t border-slate-200">
                        <span className="w-16 shrink-0 font-bold text-slate-700">莉ｶ蜷・</span>
                        <span className="text-[14px] font-bold text-slate-950">
                          {fill(selectedEmailTemplate?.subject || (templateChannel === 'email' ? subject : resolveTemplate('email')?.subject || ''), vals)}
                        </span>
                      </div>
                    </div>

                    {/* 豺ｻ莉俶嶌鬘櫁｡ｨ遉ｺ */}
                    {kind === 'document' && doc && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs text-slate-800">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="font-bold text-slate-900 shrink-0">豺ｻ莉俶嶌鬘・</span>
                          <span className="font-semibold text-purple-900 truncate">{doc.title}</span>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 font-bold text-[10px]">
                            PDF閾ｪ蜍墓ｷｻ莉・                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`/api/documents/${encodeURIComponent(doc.id)}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                            title="豺ｻ莉榔DF縺ｮ莠句燕遒ｺ隱・
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>PDF遒ｺ隱・/span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setPreviewDocModal(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 text-xs font-bold cursor-pointer shadow-2xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>譖ｸ鬘槭・繝ｬ繝薙Η繝ｼ</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 繝｡繝ｼ繝ｫ譛ｬ譁・・繝ｬ繝薙Η繝ｼ・医し繝ｼ繝舌・縺ｨ蜷御ｸ縺ｮ繝ｭ繧ｴ蜈･繧芥TML鄂ｲ蜷阪・繝ｬ繝薙Η繝ｼ繧貞性繧・・*/}
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
                            unsubscribeUrl={isTransactionalPreview ? undefined : '・磯∽ｿ｡譎ゅ↓騾｣邨｡蜈亥ｰら畑縺ｮ驟堺ｿ｡蛛懈ｭ｢URL繧定・蜍穂ｻ倅ｸ趣ｼ・}
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
                      <span className="font-bold text-slate-900">LINE騾∽ｿ｡繝励Ξ繝薙Η繝ｼ</span>
                      <span className="text-slate-600 text-xs">・亥ｮ帛・: {contact?.full_name} 讒假ｼ・/span>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-emerald-700 font-bold text-[10px]">
                      LINE Messaging API 騾∽ｿ｡
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50">
                    <LineMessagePreview
                      type={selectedLineTemplate?.reply_type || 'text'}
                      title={selectedLineTemplate?.name || 'LINE騾∽ｿ｡蜀・ｮｹ'}
                      payload={
                        selectedLineTemplate
                          ? fillPayload(selectedLineTemplate.payload)
                          : { text: fill(templateChannel === 'line' ? body : resolveTemplate('line')?.body_text || '', vals) }
                      }
                    />
                  </div>
                </div>
              )}

              {/* 荳矩Κ繧｢繧ｯ繧ｷ繝ｧ繝ｳ */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  竊・繝励Ξ繝薙Η繝ｼ繧帝哩縺倥※邱ｨ髮・↓謌ｻ繧・                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {busy ? '騾∽ｿ｡荳ｭ窶ｦ' : '遒ｺ螳壹＠縺ｦ騾∽ｿ｡縺吶ｋ'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 逕ｻ髱｢3: 繝・Φ繝励Ξ繝ｼ繝井ｿ晉ｮ｡蠎ｫ・亥・遉ｾ繝槭せ繧ｿ繝ｼ・・*/}
      {screen === 'templates' && (
        <CommunicationTemplateLibraryView />
      )}

      {/* 逕ｻ髱｢4: 蜈ｨ遉ｾ騾∽ｿ｡螻･豁ｴ */}
      {screen === 'history' && <CommunicationOutboxHistoryView />}

      {/* 豺ｻ莉俶嶌鬘槭・繝ｬ繝薙Η繝ｼ繝｢繝ｼ繝繝ｫ */}
      {previewDocModal && (
        <DocumentPreviewModal
          document={previewDocModal}
          companyName={previewDocModal.company_id ? companies[previewDocModal.company_id] : undefined}
          onClose={() => setPreviewDocModal(null)}
        />
      )}

      {/* 蜈ｨ逕ｻ髱｢繧ｳ繝ｳ繝昴・繧ｶ繝ｼ・・ortal邨檎罰縺ｧ繝峨Ο繝ｯ繝ｼ蟷・↓蛻ｶ邏・＆繧後★螻暮幕・・*/}
      {isComposerExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="繝｡繝・そ繝ｼ繧ｸ蜈ｨ逕ｻ髱｢蜈･蜉・
            className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 flex flex-col"
          >
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      繝｡繝・そ繝ｼ繧ｸ蜈ｨ逕ｻ髱｢繧ｨ繝・ぅ繧ｿ・・templateChannel === 'email' ? '繝｡繝ｼ繝ｫ' : 'LINE'}・・                    </span>
                    {contact && (
                      <span className="text-xs text-slate-600">
                        螳帛・: <strong className="text-slate-900">{contact.full_name} 讒・/strong>
                        {companies[contact.company_id || ''] ? `・・{companies[contact.company_id || '']}・荏 : ''}
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
                    <span>逋ｽ邏吶↓謌ｻ縺・/span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsComposerExpanded(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                    title="蜈・・蜈･蜉帷判髱｢縺ｫ謌ｻ繧翫∪縺呻ｼ・sc・・
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>蜈・↓謌ｻ縺呻ｼ・sc・・/span>
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col gap-3 p-5 overflow-hidden">
                {templateChannel === 'email' && (
                  <div className="shrink-0">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">莉ｶ蜷・/label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:bg-white focus:border-purple-600 focus:outline-none"
                      placeholder="莉ｶ蜷阪ｒ蜈･蜉・.."
                    />
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col">
                  <label className="text-xs font-semibold text-slate-700 block mb-1 shrink-0">譛ｬ譁・/label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="flex-1 min-h-0 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-purple-600 focus:outline-none"
                    placeholder="譛ｬ譁・ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞..."
                  />
                </div>

                <div className="shrink-0 space-y-1.5">
                  <PlaceholderAssist text={body} onInsert={(token) => setBody((curr) => curr + token)} />
                  {templateChannel === 'email' && (
                    <p className="text-[11px] text-slate-500">
                      窶ｻ 繝｡繝ｼ繝ｫ騾∽ｿ｡譎ゅ・譛ｫ蟆ｾ縺ｫ邨ｱ荳鄂ｲ蜷搾ｼ域怏髯蝉ｼ夂､ｾMST繝ｻ菴乗園繝ｻHP繝ｻMail・峨′閾ｪ蜍穂ｻ倅ｸ弱＆繧後∪縺吶・                    </p>
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