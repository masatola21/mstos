import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  UserCheck,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Calendar,
  Clock,
  ArrowRight,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Building,
  User,
  Filter,
  Search,
  RefreshCw,
  FolderOpen,
  FileText,
  Bookmark,
  Share2,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Inbox,
  SendHorizontal,
  Link2,
  ChevronDown
} from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';
import { OfficialLinkItem } from '../../types/marketing';
import { loadStoredOfficialLinks } from '../../utils/marketingStorage';
import { InlineDeleteButton } from '../InlineDeleteButton';

export type DmDirection = 'outbound' | 'inbound';
export type DmPlatform = 'x' | 'instagram' | 'linkedin' | 'facebook' | 'threads' | 'other';
export type DmStatus = 
  | 'draft'               // 下書き・準備中
  | 'sent_waiting'        // 送信済・相手の返信待ち
  | 'inbound_waiting'     // DM受信・返信作成中
  | 'replied'             // 返信あり・対話進行中
  | 'meeting_scheduled'   // 商談・相談確定
  | 'converted'           // 案件化・成約
  | 'closed';             // 見送り・クローズ

export interface DmItem {
  id: string;
  direction: DmDirection;            // 'outbound' (攻め) or 'inbound' (届いたDM)
  platform: DmPlatform;
  companyName: string;
  contactName: string;
  accountHandle: string;             // 例: @sample_ceo
  accountUrl: string;                // SNSプロフURLまたはDMリンク
  templateCategory: string;          // 初回 / リアクション後 / 返信 / 資料案内 / 商談誘導
  contextInfo: string;               // 相手の投稿メモ（または届いたDMの本文）
  approachGoal: string;              // 今回のゴール
  messageText: string;               // 送信・返信するDM文面
  status: DmStatus;
  sentAt?: string;                   // 送信日時
  receivedAt?: string;               // 受信日時
  nextActionDate?: string;           // 次回アクション予定日
  nextActionNote?: string;           // 次回アクションメモ
  crmLeadId?: string;                // 連携済みCRMリードID
  crmCompanyId?: string;             // 連携済み会社ID
  crmRegisteredAt?: string;          // CRM登録日時
  created_at: string;
  updated_at: string;
}

export interface DmTemplatePreset {
  id: string;
  category: string;
  title: string;
  direction: DmDirection;
  icon: string;
  description: string;
  templateText: string;
  defaultGoal: string;
}

const DEFAULT_TEMPLATES: DmTemplatePreset[] = [
  // ── 攻めのアプローチ（Outbound） ──
  {
    id: 'out_reaction',
    category: 'リアクション後のお礼',
    title: 'リアクションへのお礼',
    icon: '🤝',
    direction: 'outbound',
    description: '自社の投稿に反応してくれた見込み客へ、押し付け感なく自然に挨拶と共感を伝える',
    defaultGoal: '関係構築・お礼と軽い意見交換',
    templateText: `{{相手のお名前}}様

突然のメッセージ失礼いたします。{{自分の会社/屋号}}の{{自分の名前}}と申します。

先ほどは私の投稿にリアクションをいただき、誠にありがとうございました！

{{相手のお名前}}様の日頃の発信も拝見しており、{{相手の投稿・関心事}}に関する知見に深く共感しておりました。

もしよろしければ、今後とも情報交換などさせていただけますと幸いです。
急ぎの用件ではございませんので、返信などはお気になさらないでくださいね。

引き続きよろしくお願いいたします！`
  },
  {
    id: 'out_first_touch',
    category: '初回アプローチ',
    title: '経営課題への共感・事例紹介',
    icon: '💡',
    direction: 'outbound',
    description: 'ターゲット企業の投稿や事業内容をしっかり読み込んだ上で、課題解決の知見をギフトする',
    defaultGoal: '無料診断シートまたは事例の提供',
    templateText: `{{相手のお名前}}様

突然のDMにて失礼いたします。
{{自分の会社/屋号}}にて経営支援・業務改善を行っております、{{自分の名前}}と申します。

{{相手のお名前}}様の「{{相手の投稿・関心事}}」に関する発信を拝見し、まさに多くの経営者様が直面されているテーマだと強く感じ、ご連絡いたしました。

弊社でも同様の課題を抱えていた企業様向けに、「解決事例と無料診断チェックシート」をご用意しております。

押し売り等は一切ございませんので、もし貴社の今後の参考になりそうでしたらご覧いただけますと幸いです。
▼ 解決事例・無料診断はこちら:
{{公式案内リンク}}

お忙しいところ恐縮ですが、何卒よろしくお願いいたします。`
  },
  {
    id: 'out_diagnosis_offer',
    category: '無料診断の案内',
    title: '無料経営診断シートの提供',
    icon: '📊',
    direction: 'outbound',
    description: '3分で現状のボトルネックが可視化できる無料診断ツールをプレゼントする',
    defaultGoal: '診断ツールの受診',
    templateText: `{{相手のお名前}}様

いつも有益な発信を拝見しております。{{自分の会社/屋号}}の{{自分の名前}}です。

先日の{{相手の投稿・関心事}}の件、非常に興味深く拝読いたしました。

実はちょうど今週、同様の課題を持つ企業様向けに「無料診断チェックシート」を公開いたしました。
3分ほどでボトルネックと優先課題がわかる内容になっております。

{{相手のお名前}}様の今後の施策のヒントになれば嬉しく思い、共有させていただきます。
▼ 無料診断はこちら:
{{公式案内リンク}}

ご興味がございましたら、ぜひご活用ください！`
  },
  {
    id: 'out_meeting_invite',
    category: '商談・相談への誘導',
    title: '30分オンライン相談の提案',
    icon: '☕',
    direction: 'outbound',
    description: 'やり取りが数往復続いた相手へ、自然にカジュアルなオンライン相談をご案内する',
    defaultGoal: '30分オンライン相談の日程確定',
    templateText: `{{相手のお名前}}様

ご丁寧なメッセージをいただき、ありがとうございます！

{{相手のお名前}}様のお話を伺い、{{相手の投稿・関心事}}について、ぜひ一度弊社の事例なども交えて詳しくお力添えできればと感じました。

もしよろしければ、営業色のない30分ほどの「オンライン無料壁打ち相談」はいかがでしょうか？
以下のカレンダーより、ご都合の良い日時を1タップでお選びいただけます。

▼ オンライン相談 日程調整リンク
{{公式案内リンク}}

画面越しにお話しできますことを楽しみにしております！`
  },
  {
    id: 'out_collab_proposal',
    category: '提携・協業提案',
    title: '事業提携・新サービスのご提案',
    icon: '🤝',
    direction: 'outbound',
    description: '互いの強みを活かした協業や共同パッケージの可能性を打診する',
    defaultGoal: '協業に向けた一次オンライン面談',
    templateText: `{{相手のお名前}}様

突然のメッセージにて失礼いたします。{{自分の会社/屋号}}の{{自分の名前}}と申します。

{{相手のお名前}}様の事業展開や発信を拝見し、弊社の支援ノウハウと非常に親和性が高いと感じ、協業のご相談をさせていただきたくご連絡いたしました。

もしよろしければ、お互いの事業理解を兼ねて、一度15〜20分ほどオンラインでお話しさせていただけないでしょうか？

▼ オンライン日程調整リンク:
{{公式案内リンク}}

ご都合が合わない場合は、候補日時を2〜3いただけますと幸いです。
何卒よろしくお願い申し上げます。`
  },

  // ── 届いたDMへの返信（Inbound） ──
  {
    id: 'in_thanks_hearing',
    category: '相手からの問い合わせへの返信',
    title: '初回御礼・ヒアリング',
    icon: '💬',
    direction: 'inbound',
    description: '届いたDMに温かく感謝を伝え、現在のお悩みや課題を丁寧にヒアリングする',
    defaultGoal: '課題ヒアリング・関係構築',
    templateText: `{{相手のお名前}}様

はじめまして、{{自分の会社/屋号}}の{{自分の名前}}と申します。
この度は温かいメッセージをいただき、誠にありがとうございます！

{{相手の投稿・関心事}}についてのお問い合わせ、大変嬉しく拝読いたしました。

現在、どのような課題やお悩みをお持ちでしょうか？
もしよろしければ、現在の状況を少し詳しくお聞かせいただけますと、より具体的にお役に立てるアドバイスができるかと思います。

急ぎの要件ではございませんので、お時間のある際にご返信いただけましたら幸いです。
引き続きどうぞよろしくお願いいたします！`
  },
  {
    id: 'in_service_inquiry',
    category: '相手からの問い合わせへの返信',
    title: 'サービス・料金への案内',
    icon: '💼',
    direction: 'inbound',
    description: '質問に明快かつ誠実に回答し、次の具体的なステップ（無料診断や相談）へスムーズに繋げる',
    defaultGoal: '相談会の日程調整・詳細ヒアリング',
    templateText: `{{相手のお名前}}様

はじめまして、{{自分の会社/屋号}}の{{自分の名前}}と申します。
この度は弊社へのお問い合わせをいただき、誠にありがとうございます！

ご質問いただきました内容につきまして回答させていただきます。

【ご回答】
{{回答の要点や料金の考え方（例: 貴社の規模やご要望に合わせて柔軟に対応可能です）}}

詳細な御見積や具体的な進め方につきましては、貴社の現状を10〜15分ほど伺った上で最適なプランをご提示できます。

もしよろしければ、一度オンライン（Zoom）にて気軽にお話ししませんか？
▼ ご都合の良い日時をお選びいただけます:
{{公式案内リンク}}

何かご不明な点がございましたら、いつでもこのDMにてお知らせください。
引き続きどうぞよろしくお願いいたします。`
  },
  {
    id: 'in_diagnosis_guide',
    category: '相手からの問い合わせへの返信',
    title: '無料診断シートのご案内',
    icon: '📊',
    direction: 'inbound',
    description: 'まず手軽に貴社の課題を可視化できる診断ツールをギフトとして案内する',
    defaultGoal: '無料診断の受診',
    templateText: `{{相手のお名前}}様

メッセージをいただき、誠にありがとうございます！{{自分の名前}}です。

{{相手の投稿・関心事}}についてのご相談、大変参考になります。

もしよろしければ、まずは3分ほどで貴社の現状のボトルネックが可視化できる「無料診断ツール」をお試しになりませんか？
診断結果をもとに、具体的な改善ポイントをシートでご確認いただけます。

▼ 無料診断はこちらから受診いただけます:
{{公式案内リンク}}

診断後の無理な営業などは一切ございませんので、お気軽にご活用ください！`
  },
  {
    id: 'in_meeting_schedule',
    category: '相手からの問い合わせへの返信',
    title: 'Zoom相談・日程調整',
    icon: '📅',
    direction: 'inbound',
    description: '届いた相談に対して、直接カレンダーから日程調整できるリンクを提示する',
    defaultGoal: 'オンライン相談の日程確定',
    templateText: `{{相手のお名前}}様

ご連絡いただき、誠にありがとうございます！{{自分の名前}}です。

ぜひ詳しい現状を伺い、弊社でお力になれる具体的な打ち手をご提案させていただければ幸いです。

まずは30分ほど、オンライン（Zoom）にてお話ししませんか？
以下のリンクより、ご都合の良い日時を1タップでお選びいただけます。

▼ オンライン相談 日程調整リンク:
{{公式案内リンク}}

カレンダーに合わない日時がございましたら、候補日時を2〜3お知らせいただければ調整いたします。
お話しできますことを心より楽しみにしております！`
  },
  {
    id: 'in_polite_decline',
    category: '相手からの問い合わせへの返信',
    title: '丁重なお断り・辞退',
    icon: '🙏',
    direction: 'inbound',
    description: '営業DMや時期尚早な案件に対して、角を立てず誠実にお断りする',
    defaultGoal: '丁寧なお断り・関係性の維持',
    templateText: `{{相手のお名前}}様

この度はご丁寧なご案内・ご提案をいただき、誠にありがとうございます。{{自分の名前}}です。

せっかくのご連絡をいただき大変恐縮ではございますが、現在の弊社の注力分野・リソースの都合上、今回はご期待に沿うことが難しい状況でございます。

貴重なお時間を割いてご提案いただきましたこと、心より感謝申し上げます。
またの機会がございましたら、その際はぜひよろしくお願いいたします。

{{相手のお名前}}様の今後のますますのご活躍をお祈り申し上げます。`
  }
];

export const PLATFORM_INFOS: Record<DmPlatform, { name: string; badge: string; color: string; domain: string; defaultUrl: string }> = {
  x: { name: 'X (Twitter)', badge: 'X', color: 'bg-slate-900 text-white border-slate-700', domain: 'x.com', defaultUrl: 'https://x.com/messages' },
  instagram: { name: 'Instagram', badge: 'IG', color: 'bg-pink-50 text-pink-700 border-pink-200', domain: 'instagram.com', defaultUrl: 'https://www.instagram.com/direct/inbox/' },
  linkedin: { name: 'LinkedIn', badge: 'LI', color: 'bg-sky-50 text-sky-700 border-sky-200', domain: 'linkedin.com', defaultUrl: 'https://www.linkedin.com/messaging/' },
  facebook: { name: 'Facebook', badge: 'FB', color: 'bg-blue-50 text-blue-700 border-blue-200', domain: 'facebook.com', defaultUrl: 'https://www.facebook.com/messages/' },
  threads: { name: 'Threads', badge: 'TH', color: 'bg-slate-100 text-slate-800 border-slate-300', domain: 'threads.net', defaultUrl: 'https://www.threads.net/' },
  other: { name: 'その他SNS', badge: 'SNS', color: 'bg-purple-50 text-purple-700 border-purple-200', domain: '', defaultUrl: 'https://x.com/messages' },
};

export const STATUS_LABELS: Record<DmStatus, { label: string; badgeColor: string }> = {
  draft: { label: '下書き・準備中', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' },
  sent_waiting: { label: '送信済・返信待ち', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  inbound_waiting: { label: 'DM受信・返信中', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' },
  replied: { label: '返信済・対話中', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  meeting_scheduled: { label: '商談・相談確定', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  converted: { label: 'リード化・成約', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  closed: { label: '見送り・終了', badgeColor: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export interface SocialDmSalesStudioProps {
  mode?: 'outbound' | 'inbound' | 'all';
  onNavigateTab?: (tab: any, options?: any) => void;
}

const STORAGE_KEY = 'ai_social_dm_sales_items_v1';

export const SocialDmSalesStudio: React.FC<SocialDmSalesStudioProps> = ({ mode = 'all', onNavigateTab }) => {
  const isOutboundOnly = mode === 'outbound';
  const isInboundOnly = mode === 'inbound';

  // 公式URL一覧（案内用リンクの埋め込み用）
  const [officialLinks, setOfficialLinks] = useState<OfficialLinkItem[]>([]);
  const [selectedOfficialLinkId, setSelectedOfficialLinkId] = useState<string>('');

  // DMアイテム一覧
  const [dmList, setDmList] = useState<DmItem[]>([]);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);

  // 編集・作成フォームの状態
  const [direction, setDirection] = useState<DmDirection>(isInboundOnly ? 'inbound' : 'outbound');
  const [platform, setPlatform] = useState<DmPlatform>('x');
  
  // 統合ターゲット入力（手入力削減の要）
  const [targetAccountInput, setTargetAccountInput] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [accountHandle, setAccountHandle] = useState<string>('');
  const [accountUrl, setAccountUrl] = useState<string>('');
  
  // コンテキスト（Outboundは相手の発信メモ、Inboundは届いたDM本文）
  const [contextInfo, setContextInfo] = useState<string>('');
  const [approachGoal, setApproachGoal] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [status, setStatus] = useState<DmStatus>(isInboundOnly ? 'inbound_waiting' : 'draft');
  const [nextActionDate, setNextActionDate] = useState<string>('');
  const [nextActionNote, setNextActionNote] = useState<string>('');

  // UI状態
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [filterDirection, setFilterDirection] = useState<'all' | 'outbound' | 'inbound'>(
    isOutboundOnly ? 'outbound' : isInboundOnly ? 'inbound' : 'all'
  );
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [crmLoading, setCrmLoading] = useState(false);

  // 初回データロード
  useEffect(() => {
    // 1. 公式リンクハブからリンクを取得
    const links = loadStoredOfficialLinks();
    if (links && links.length > 0) {
      setOfficialLinks(links);
      setSelectedOfficialLinkId(links[0].id);
    }

    // 2. ローカルストレージからDM一覧を取得
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDmList(parsed);
          const relevant = isOutboundOnly
            ? parsed.filter((item: DmItem) => item.direction === 'outbound')
            : isInboundOnly
            ? parsed.filter((item: DmItem) => item.direction === 'inbound')
            : parsed;
          if (relevant.length > 0) {
            loadDmToForm(relevant[0]);
          } else {
            handleCreateNew(isInboundOnly ? 'inbound' : 'outbound');
          }
        }
      } else {
        handleCreateNew(isInboundOnly ? 'inbound' : 'outbound');
      }
    } catch (e) {
      console.warn('Failed to load local DM items:', e);
    }

    // 3. Supabaseリモート同期
    const loadRemote = async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) return;
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { data } = await supabase
          .from('mst_ai_acquisition_records')
          .select('payload')
          .eq('user_id', auth.user.id)
          .eq('id', 'mst_social_dm_sales_records')
          .maybeSingle();

        if (data?.payload?.items && Array.isArray(data.payload.items)) {
          setDmList(data.payload.items);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.payload.items));
          if (!selectedDmId && data.payload.items.length > 0) {
            const relevant = isOutboundOnly
              ? data.payload.items.filter((item: DmItem) => item.direction === 'outbound')
              : isInboundOnly
              ? data.payload.items.filter((item: DmItem) => item.direction === 'inbound')
              : data.payload.items;
            if (relevant.length > 0) {
              loadDmToForm(relevant[0]);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load remote DM records:', err);
      }
    };

    void loadRemote();
  }, [isOutboundOnly, isInboundOnly]);

  // 永続化ヘルパー
  const persistDmList = async (updated: DmItem[]) => {
    setDmList(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    try {
      const supabase = getSupabase();
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          await supabase.from('mst_ai_acquisition_records').upsert({
            user_id: auth.user.id,
            id: 'mst_social_dm_sales_records',
            record_type: 'social',
            title: 'SNS営業・DM個別管理データ',
            payload: { items: updated },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,id' });
        }
      }
    } catch (err) {
      console.warn('Supabase remote sync error:', err);
    }
  };

  // フォームへのロード
  const loadDmToForm = (item: DmItem) => {
    setSelectedDmId(item.id);
    setDirection(item.direction);
    setPlatform(item.platform);
    setCompanyName(item.companyName || '');
    setContactName(item.contactName || '');
    setAccountHandle(item.accountHandle || '');
    setAccountUrl(item.accountUrl || '');
    setTargetAccountInput(item.accountHandle || item.accountUrl || item.contactName || '');
    setContextInfo(item.contextInfo || '');
    setApproachGoal(item.approachGoal || '');
    setMessageText(item.messageText || '');
    setStatus(item.status || (item.direction === 'inbound' ? 'inbound_waiting' : 'draft'));
    setNextActionDate(item.nextActionDate || '');
    setNextActionNote(item.nextActionNote || '');
  };

  // 統合ターゲット入力のインテリジェントパーサー
  const handleTargetInputChange = (raw: string) => {
    setTargetAccountInput(raw);
    const trimmed = raw.trim();

    // 1. URL形式の場合 (https://x.com/handle など)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setAccountUrl(trimmed);
      try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('twitter.com') || host.includes('x.com')) {
          setPlatform('x');
          const p = parsed.pathname.replace(/^\//, '').split('/')[0];
          if (p && !['messages', 'home', 'explore'].includes(p)) setAccountHandle(`@${p}`);
        } else if (host.includes('instagram.com')) {
          setPlatform('instagram');
          const p = parsed.pathname.replace(/^\//, '').split('/')[0];
          if (p && !['direct', 'explore'].includes(p)) setAccountHandle(`@${p}`);
        } else if (host.includes('threads.net')) {
          setPlatform('threads');
          const p = parsed.pathname.replace(/^\/@?/, '').split('/')[0];
          if (p) setAccountHandle(`@${p}`);
        } else if (host.includes('linkedin.com')) {
          setPlatform('linkedin');
        } else if (host.includes('facebook.com')) {
          setPlatform('facebook');
        }
      } catch {}
    } 
    // 2. @ユーザー名形式の場合
    else if (trimmed.startsWith('@')) {
      setAccountHandle(trimmed);
      const clean = trimmed.slice(1);
      if (platform === 'x') setAccountUrl(`https://x.com/${clean}`);
      else if (platform === 'instagram') setAccountUrl(`https://www.instagram.com/${clean}/`);
      else if (platform === 'threads') setAccountUrl(`https://www.threads.net/@${clean}`);
      if (!contactName) setContactName(trimmed);
    } 
    // 3. 一般名や未整形ハンドルの場合
    else {
      if (trimmed.length > 0 && /^[a-zA-Z0-9_.]+$/.test(trimmed)) {
        // アルファベットのみならSNSアカウントと推測
        setAccountHandle(`@${trimmed}`);
        if (platform === 'x') setAccountUrl(`https://x.com/${trimmed}`);
        else if (platform === 'instagram') setAccountUrl(`https://www.instagram.com/${trimmed}/`);
        else if (platform === 'threads') setAccountUrl(`https://www.threads.net/@${trimmed}`);
      } else {
        setContactName(trimmed);
      }
    }
  };

  // 新規作成ボタン
  const handleCreateNew = (newDirection: DmDirection = isOutboundOnly ? 'outbound' : isInboundOnly ? 'inbound' : 'outbound') => {
    setSelectedDmId(null);
    setDirection(newDirection);
    setPlatform('x');
    setTargetAccountInput('');
    setCompanyName('');
    setContactName('');
    setAccountHandle('');
    setAccountUrl('');
    setContextInfo('');
    
    const defaultTpl = DEFAULT_TEMPLATES.find((t) => t.direction === newDirection) || DEFAULT_TEMPLATES[0];
    setApproachGoal(defaultTpl.defaultGoal);
    
    // テンプレートの初期テキスト反映
    let text = defaultTpl.templateText;
    const activeLink = officialLinks.find((l) => l.id === selectedOfficialLinkId) || officialLinks[0];
    if (activeLink) {
      text = text.replace(/{{公式案内リンク}}/g, activeLink.url);
    }
    setMessageText(text);

    setStatus(newDirection === 'inbound' ? 'inbound_waiting' : 'draft');
    setNextActionDate('');
    setNextActionNote('');
    
    setFeedback({
      type: 'info',
      message: newDirection === 'outbound' 
        ? '新規アプローチを作成します。' 
        : '新規の届いたDM返信を作成します。'
    });
    setTimeout(() => setFeedback(null), 2500);
  };

  // テンプレート適用（ワンクリックで即文面完成）
  const handleApplyTemplate = (tpl: DmTemplatePreset) => {
    setApproachGoal(tpl.defaultGoal);
    
    let text = tpl.templateText;
    const targetName = contactName || accountHandle || 'ご担当者';
    text = text.replace(/{{相手のお名前}}/g, targetName);
    text = text.replace(/{{相手の会社名}}/g, companyName || '貴社');
    text = text.replace(/{{相手の投稿・関心事}}/g, contextInfo || '最近の事業やご発信');
    
    const activeLink = officialLinks.find((l) => l.id === selectedOfficialLinkId) || officialLinks[0];
    if (activeLink) {
      text = text.replace(/{{公式案内リンク}}/g, activeLink.url);
    }
    
    setMessageText(text);
    setFeedback({ type: 'success', message: `「${tpl.title}」を反映しました！` });
    setTimeout(() => setFeedback(null), 2000);
  };

  // AIによる自動文章生成
  const handleAIGenerateCustomDM = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: '社内AIが相手のコンテクストを解析し、最適な文面を作成中…' });

    try {
      const activeLink = officialLinks.find((l) => l.id === selectedOfficialLinkId) || officialLinks[0];
      const linkInfo = activeLink ? `【案内したい自社リンク】: ${activeLink.title} (${activeLink.url})` : '';

      const isOutbound = direction === 'outbound';
      const prompt = isOutbound
        ? `あなたはBtoB営業・SNSマーケティングのトッププロフェッショナルです。
以下の情報をもとに、相手の心を動かし、決してスパムだと思われない「極めて自然で礼儀正しく、価値提供のある個別DM文面」を作成してください。

【送信先媒体】: ${PLATFORM_INFOS[platform].name}
【相手のお名前・アカウント】: ${contactName || accountHandle || 'ご担当者様'}
【相手の会社名・屋号】: ${companyName || '（文脈に合わせる）'}
【相手の発信内容・関心メモ】: ${contextInfo || '日頃から有益な発信をされている経営者・担当者様'}
【アプローチの目的】: ${approachGoal || 'お役立ち資料または無料診断の提供'}
${linkInfo}
【現在のベース文章】:
${messageText || '自然で共感のある挨拶から始めてください'}

【厳格な要件】:
1. コピペ感・テンプレート感を徹底的に排除し、「相手の投稿や関心を本当に読んだこと」が伝わる具体的な共感の一文を入れる。
2. 押し売りや誇大表現をしない。まずは有益な知見や無料診断などのギフトから入る。
3. 最後に「返信はお気になさらないでください」または「もしご興味があれば」と相手の心理的負担を下げる配慮を入れる。
4. 送信先媒体（${PLATFORM_INFOS[platform].name}）に適した改行と読みやすさにする。
5. 出力はDM本文のみを返してください。`
        : `あなたはBtoB企業のカスタマーサクセス・営業責任者です。
SNSで相手から届いたDM（問い合わせ）に対して、相手に深い好印象を与え、次のステップ（無料診断やオンライン相談）へ自然に導く「丁寧かつ明快な返信DM文面」を作成してください。

【受信媒体】: ${PLATFORM_INFOS[platform].name}
【問い合わせ主】: ${contactName || accountHandle || 'お客様'}
【相手から届いたDM本文】:
${contextInfo || 'サービス内容や費用について教えてほしい'}
【返信の目的】: ${approachGoal || '疑問への誠実な回答とオンライン日程調整'}
${linkInfo}

【厳格な要件】:
1. 冒頭で問い合わせへの感謝を温かく伝える。
2. 相手の質問にまずは誠実かつ要点を押さえて回答する（料金やプランは柔軟に相談可能な旨を添える）。
3. 「貴社の現状に合わせて具体的にアドバイスできる」として、Zoom日程調整リンク（または無料診断リンク）へ自然に案内する。
4. 押し売り感を出さず、質問があればいつでも追加で聞ける安心感を提供する。
5. 出力はDM返信文面のみを返してください。`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          workModeId: 'marketing_execution',
          character: {
            name: 'SNS DMアプローチ専属コンサルタント',
            role: '個別最適化DMライティング',
            personality: '礼儀正しく、相手目線に立ち、自然な共感と信頼を生み出す文章を書く',
            tone: '誠実でプロフェッショナル',
          },
          stream: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'AI文章の生成に失敗しました。');

      setMessageText(data.text.trim());
      setFeedback({ type: 'success', message: '相手に合わせたAI個別最適化DM文面を作成しました！' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'AI生成エラーが発生しました。' });
    } finally {
      setAiGenerating(false);
    }
  };

  // 保存処理
  const handleSaveDm = async () => {
    if (!messageText.trim()) {
      setFeedback({ type: 'error', message: 'DMのメッセージ本文を入力してください。' });
      return;
    }

    const now = new Date().toISOString();
    let updatedList: DmItem[];

    if (selectedDmId) {
      updatedList = dmList.map((item) => {
        if (item.id === selectedDmId) {
          return {
            ...item,
            direction,
            platform,
            companyName,
            contactName,
            accountHandle,
            accountUrl,
            contextInfo,
            approachGoal,
            messageText,
            status,
            nextActionDate,
            nextActionNote,
            updated_at: now,
          };
        }
        return item;
      });
      setFeedback({ type: 'success', message: '保存しました！' });
    } else {
      const newItem: DmItem = {
        id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        direction,
        platform,
        companyName,
        contactName,
        accountHandle,
        accountUrl,
        templateCategory: approachGoal || '個別アプローチ',
        contextInfo,
        approachGoal,
        messageText,
        status,
        sentAt: status === 'sent_waiting' || status === 'meeting_scheduled' ? now : undefined,
        receivedAt: direction === 'inbound' ? now : undefined,
        nextActionDate,
        nextActionNote,
        created_at: now,
        updated_at: now,
      };
      updatedList = [newItem, ...dmList];
      setSelectedDmId(newItem.id);
      setFeedback({ type: 'success', message: '新規DMを登録しました！' });
    }

    await persistDmList(updatedList);
    setTimeout(() => setFeedback(null), 2500);
  };

  // 削除処理
  const handleDeleteDm = async (id: string) => {
    const updated = dmList.filter((item) => item.id !== id);
    await persistDmList(updated);
    if (selectedDmId === id) {
      if (updated.length > 0) {
        loadDmToForm(updated[0]);
      } else {
        handleCreateNew();
      }
    }
    setFeedback({ type: 'info', message: 'DM履歴を削除しました。' });
    setTimeout(() => setFeedback(null), 2000);
  };

  // クリップボードにコピー
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 送信先URLの計算
  const computedTargetUrl = useMemo(() => {
    let target = accountUrl.trim();
    if (!target && accountHandle) {
      const handle = accountHandle.replace(/^@/, '').trim();
      if (handle) {
        if (platform === 'x') target = `https://x.com/${handle}`;
        else if (platform === 'instagram') target = `https://www.instagram.com/${handle}/`;
        else if (platform === 'threads') target = `https://www.threads.net/@${handle}`;
      }
    }
    if (!target) {
      target = PLATFORM_INFOS[platform]?.defaultUrl || 'https://x.com/messages';
    }
    return target;
  }, [accountUrl, accountHandle, platform]);

  // 文面コピー ＆ 送信ステータス自動更新
  const handleCopyAndMarkSent = () => {
    if (!messageText.trim()) {
      setFeedback({ type: 'error', message: 'コピーする文面がありません。' });
      return;
    }

    copyToClipboard(messageText, 'open_sns');
    const nextStatus: DmStatus = direction === 'outbound' ? 'sent_waiting' : 'replied';
    setStatus(nextStatus);

    // 自動保存
    const now = new Date().toISOString();
    let updatedList: DmItem[];
    if (selectedDmId) {
      updatedList = dmList.map((item) => {
        if (item.id === selectedDmId) {
          return {
            ...item,
            status: nextStatus,
            messageText,
            sentAt: now,
            updated_at: now,
          };
        }
        return item;
      });
    } else {
      const newItem: DmItem = {
        id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        direction,
        platform,
        companyName,
        contactName,
        accountHandle,
        accountUrl,
        templateCategory: approachGoal || '個別アプローチ',
        contextInfo,
        approachGoal,
        messageText,
        status: nextStatus,
        sentAt: now,
        created_at: now,
        updated_at: now,
      };
      updatedList = [newItem, ...dmList];
      setSelectedDmId(newItem.id);
    }
    void persistDmList(updatedList);

    setFeedback({
      type: 'success',
      message: `文面をクリップボードにコピーしました！${PLATFORM_INFOS[platform].name}で送信してください。`
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // CRM見込み客（リード台帳）登録
  const handleRegisterToCrm = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setFeedback({ type: 'error', message: 'Supabase接続がありません。' });
      return;
    }

    const targetCompanyName = companyName.trim() || contactName.trim() || accountHandle.trim() || `${PLATFORM_INFOS[platform].name} 見込み顧客`;
    const targetContactName = contactName.trim() || accountHandle.trim() || '担当者様';

    setCrmLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const currentUserId = auth?.user?.id;

      // 会社を作成または検索
      let resolvedCompanyId: string | undefined = undefined;
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('name', targetCompanyName)
        .maybeSingle();

      if (existingCompany?.id) {
        resolvedCompanyId = existingCompany.id;
      } else {
        const { data: createdCompany, error: compErr } = await supabase
          .from('companies')
          .insert({
            name: targetCompanyName,
            industry: 'SNS経由・アプローチ対象',
            website: accountUrl || undefined,
            user_id: currentUserId,
          })
          .select('id')
          .single();
        if (!compErr && createdCompany) {
          resolvedCompanyId = createdCompany.id;
        }
      }

      // リード（見込み客）を作成
      const leadSource = `SNS (${PLATFORM_INFOS[platform].name})`;
      const leadNotes = `【SNSアカウント】: ${accountHandle || 'なし'} (${accountUrl || 'URLなし'})
【媒体】: ${PLATFORM_INFOS[platform].name}
【種別】: ${direction === 'inbound' ? '届いたDMへの返信' : '攻めのアプローチ'}
【相手のメモ・本文】:
${contextInfo || '特になし'}
【送信文面】:
${messageText.slice(0, 500)}`;

      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          company_id: resolvedCompanyId || null,
          source: leadSource,
          inquiry_type: direction === 'inbound' ? 'SNS問い合わせ・受信DM' : 'SNSアウトバウンドDM営業',
          service_type: approachGoal || '個別相談・診断',
          status: status === 'meeting_scheduled' ? '商談調整中' : 'アプローチ中',
          notes: leadNotes,
          next_action_at: nextActionDate ? `${nextActionDate}T10:00:00Z` : undefined,
        })
        .select('id')
        .single();

      if (leadErr) throw new Error(leadErr.message || 'リード登録に失敗しました。');

      const now = new Date().toISOString();
      if (selectedDmId) {
        const updated = dmList.map((item) => {
          if (item.id === selectedDmId) {
            return {
              ...item,
              crmLeadId: newLead?.id,
              crmCompanyId: resolvedCompanyId,
              crmRegisteredAt: now,
              status: item.status === 'draft' ? 'sent_waiting' : item.status,
            };
          }
          return item;
        });
        await persistDmList(updated);
      }

      setFeedback({
        type: 'success',
        message: `「${targetCompanyName}」をCRM見込み客（リード台帳）に正式登録しました！`
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'CRM連携中にエラーが発生しました。' });
    } finally {
      setCrmLoading(false);
    }
  };

  // フィルタリング処理
  const filteredList = useMemo(() => {
    return dmList.filter((item) => {
      if (filterDirection !== 'all' && item.direction !== filterDirection) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (item.companyName || '').toLowerCase().includes(q);
        const matchContact = (item.contactName || '').toLowerCase().includes(q);
        const matchHandle = (item.accountHandle || '').toLowerCase().includes(q);
        const matchText = (item.messageText || '').toLowerCase().includes(q);
        if (!matchName && !matchContact && !matchHandle && !matchText) return false;
      }
      return true;
    });
  }, [dmList, filterDirection, filterStatus, searchQuery]);

  const activeItem = dmList.find((i) => i.id === selectedDmId);

  return (
    <div className="space-y-4 text-slate-800">
      {/* ── 最上部バナー & 相互ナビゲーション ── */}
      <div className="rounded-2xl border border-purple-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isOutboundOnly ? (
                <>
                  <SendHorizontal className="h-5 w-5 text-purple-700" />
                  <h3 className="text-base font-bold text-slate-900">🎯 攻めのSNS DM開拓（リストアップ ＆ 営業テンプレ送信）</h3>
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                    新規開拓・アウトバウンド営業特化
                  </span>
                </>
              ) : isInboundOnly ? (
                <>
                  <Inbox className="h-5 w-5 text-sky-600" />
                  <h3 className="text-base font-bold text-slate-900">📥 SNS DM受信トレイ（返信対応 ＆ CRM連携）</h3>
                  <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200">
                    守りの返信・CRM顧客化特化
                  </span>
                </>
              ) : (
                <>
                  <MessageSquare className="h-5 w-5 text-purple-700" />
                  <h3 className="text-base font-bold text-slate-900">💬 SNS営業・DM個別管理スタジオ</h3>
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                    攻め（開拓）＆ 守り（返信）両対応
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {isOutboundOnly
                ? 'アカウント名またはURLを入力し、営業テンプレを選ぶだけ。手入力なしでAI個別最適化と安全な手動送信が行えます。'
                : isInboundOnly
                ? '届いたDMをペーストして返信テンプレを選ぶだけ。ワンクリックで返信文をコピーしてSNSを開けます。'
                : '見込み客への個別アプローチと届いたDMへの返信対応を一元管理できます。'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOutboundOnly ? (
              <>
                <button
                  type="button"
                  onClick={() => handleCreateNew('outbound')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ＋ 新規アプローチ追加
                </button>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      try { localStorage.setItem('unified_inbox_active_channel', 'social_dm'); } catch {}
                      onNavigateTab('inbox_hub', { inboxChannel: 'social_dm' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition cursor-pointer"
                    title="届いたDMの返信対応は統合受信トレイで行います"
                  >
                    <Inbox className="h-3.5 w-3.5 text-sky-600" />
                    <span>📥 届いたDM返信トレイへ</span>
                  </button>
                )}
              </>
            ) : isInboundOnly ? (
              <>
                <button
                  type="button"
                  onClick={() => handleCreateNew('inbound')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ＋ 届いたDMを登録
                </button>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('ai_acquisition_active_tab', 'social_studio');
                        localStorage.setItem('social_studio_mode', 'dm_sales');
                      } catch {}
                      onNavigateTab('ai_acquisition', { acquisitionTab: 'social_studio', studioMode: 'dm_sales' });
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold transition cursor-pointer"
                    title="攻めのDM営業（リストアップ）はAI集客運用で行います"
                  >
                    <SendHorizontal className="h-3.5 w-3.5 text-purple-600" />
                    <span>🎯 攻めのDM営業（リストアップ）へ</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleCreateNew('outbound')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs"
                >
                  <SendHorizontal className="h-3.5 w-3.5" />
                  ＋ 新規アプローチ (攻め)
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateNew('inbound')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-xs"
                >
                  <Inbox className="h-3.5 w-3.5" />
                  ＋ 届いたDM返信 (受け)
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── フィードバックトースト ── */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-xs animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : feedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-purple-200 bg-purple-50 text-purple-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* ── 2カラムレイアウト（左: リスト / 右: 超効率ワークスペース） ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ── 左カラム: リスト一覧 (5カラム) ── */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-purple-700" />
                <span>
                  {isOutboundOnly
                    ? `🎯 アプローチ先リスト (${filteredList.length}件)`
                    : isInboundOnly
                    ? `📥 届いたDM一覧 (${filteredList.length}件)`
                    : `DM履歴一覧 (${filteredList.length}件)`}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => handleCreateNew(isInboundOnly ? 'inbound' : 'outbound')}
                className="text-[11px] text-purple-700 hover:text-purple-800 font-semibold"
              >
                ＋新規
              </button>
            </div>

            {/* 検索ボックス & ステータスフィルター */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="検索（名前・文面）"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-purple-500 focus:outline-none"
              >
                <option value="all">全ステータス</option>
                {Object.entries(STATUS_LABELS).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
            </div>

            {/* リスト表示 */}
            <div className="space-y-1.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredList.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs bg-slate-50">
                  {isOutboundOnly
                    ? 'アプローチ先がまだ登録されていません。「＋新規」から追加してください。'
                    : '届いたDM履歴がまだありません。'}
                </div>
              ) : (
                filteredList.map((item) => {
                  const isSelected = item.id === selectedDmId;
                  const platInfo = PLATFORM_INFOS[item.platform] || PLATFORM_INFOS.other;
                  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.draft;

                  return (
                    <div
                      key={item.id}
                      onClick={() => loadDmToForm(item)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition text-xs space-y-1 relative group ${
                        isSelected
                          ? 'bg-purple-50/80 border-purple-400 shadow-xs ring-1 ring-purple-300'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${platInfo.color}`}>
                            {platInfo.badge}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {item.contactName || item.accountHandle || item.companyName || 'ターゲット'}
                          </span>
                        </div>

                        <span className={`text-[10px] px-1.5 py-0.2 rounded border ${statusInfo.badgeColor} shrink-0`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* 本文プレビュー */}
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-sans">
                        {item.messageText || item.contextInfo || '(文面なし)'}
                      </p>

                      <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                        <span>
                          {item.crmLeadId ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> CRM登録済
                            </span>
                          ) : (
                            <span className="text-slate-400">未登録</span>
                          )}
                        </span>

                        <InlineDeleteButton
                          onConfirm={() => handleDeleteDm(item.id)}
                          confirmLabel="削除"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          ariaLabel="この履歴を削除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </InlineDeleteButton>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── 右カラム: 超効率・手入力ゼロ志向のワークスペース (7カラム) ── */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-xs">
            
            {/* ヘッダー＆プラットフォーム選択（1タップボタン） */}
            <div className="space-y-2 border-b border-slate-200 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-purple-700" />
                  <span>① 対象SNSを選択:</span>
                </span>
                {!isOutboundOnly && !isInboundOnly && (
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setDirection('outbound')}
                      className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                        direction === 'outbound' ? 'bg-purple-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      攻め (開拓)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('inbound')}
                      className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                        direction === 'inbound' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      受け (届いたDM)
                    </button>
                  </div>
                )}
              </div>

              {/* SNSワンタップ選択ピル */}
              <div className="flex flex-wrap gap-1.5">
                {(['x', 'instagram', 'linkedin', 'facebook', 'threads'] as DmPlatform[]).map((p) => {
                  const info = PLATFORM_INFOS[p];
                  const isSelected = platform === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPlatform(p);
                        if (accountHandle && accountHandle.startsWith('@')) {
                          const clean = accountHandle.slice(1);
                          if (p === 'x') setAccountUrl(`https://x.com/${clean}`);
                          else if (p === 'instagram') setAccountUrl(`https://www.instagram.com/${clean}/`);
                          else if (p === 'threads') setAccountUrl(`https://www.threads.net/@${clean}`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        isSelected
                          ? `${info.color} ring-2 ring-purple-400 shadow-xs`
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {info.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 相手情報 ＆ メモ入力（必要最小限に集約！） ── */}
            {direction === 'inbound' ? (
              /* INBOUND MODE: 届いたDMをペーストするだけ */
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Inbox className="h-3.5 w-3.5 text-sky-600" />
                      <span>② 届いたDM本文（ここに貼り付け）:</span>
                    </span>
                    <span className="text-[10px] text-sky-700 font-normal">※ペーストして下のテンプレを押すだけ</span>
                  </label>
                  <textarea
                    rows={3}
                    value={contextInfo}
                    onChange={(e) => setContextInfo(e.target.value)}
                    placeholder="例: 「はじめまして！投稿で紹介されていた業務改善システムについて、導入費用と期間を教えていただきたいです」"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-700 font-medium text-[11px]">相手のユーザー名 / お名前（任意）</label>
                    <input
                      type="text"
                      value={targetAccountInput}
                      onChange={(e) => handleTargetInputChange(e.target.value)}
                      placeholder="例: @yamada_biz または 山田社長"
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 font-mono text-xs focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-medium text-[11px]">案内したい自社リンク</label>
                    <select
                      value={selectedOfficialLinkId}
                      onChange={(e) => setSelectedOfficialLinkId(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-800 text-xs truncate focus:bg-white focus:border-purple-500 focus:outline-none"
                    >
                      {officialLinks.map((link) => (
                        <option key={link.id} value={link.id}>
                          {link.title} ({link.url})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* OUTBOUND MODE: アプローチ先と1行メモだけ */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-purple-700" />
                      <span>② アプローチ先（@アカウント名 または URL）:</span>
                    </label>
                    <input
                      type="text"
                      value={targetAccountInput}
                      onChange={(e) => handleTargetInputChange(e.target.value)}
                      placeholder="例: @yamada_biz または https://x.com/..."
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 font-mono text-xs focus:bg-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-purple-700" />
                      <span>案内したい自社リンク:</span>
                    </label>
                    <select
                      value={selectedOfficialLinkId}
                      onChange={(e) => setSelectedOfficialLinkId(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-800 text-xs truncate focus:bg-white focus:border-purple-500 focus:outline-none"
                    >
                      {officialLinks.map((link) => (
                        <option key={link.id} value={link.id}>
                          {link.title} ({link.url})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 font-medium text-[11px] flex items-center justify-between">
                    <span>相手の発信内容・関心メモ（任意・1行でOK）</span>
                    <span className="text-[10px] text-purple-700 font-normal">※AIがこの内容に共感した文面を作成</span>
                  </label>
                  <input
                    type="text"
                    value={contextInfo}
                    onChange={(e) => setContextInfo(e.target.value)}
                    placeholder="例: 「採用課題に苦戦している」と発信していた / 介護事業所のDXに関心あり"
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ── ワンタップ・テンプレート選択（手入力なしで即文面完成） ── */}
            <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5 text-purple-700" />
                  <span>③ ワンクリックで文面を呼び出し:</span>
                </span>
                <span className="text-[10px] text-slate-500">タップで文面が即座に入ります</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_TEMPLATES.filter((t) => t.direction === direction).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-900 transition shadow-xs cursor-pointer"
                    title={tpl.description}
                  >
                    <span>{tpl.icon}</span>
                    <span className="font-semibold">{tpl.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── 送信DM本文（テキストエリア ＋ AI個別最適化ボタン） ── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-purple-700" />
                  <span>④ 送信DM本文（そのまま送信可能・直接微調整もOK）</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({messageText.length}文字)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleAIGenerateCustomDM}
                  disabled={aiGenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiGenerating ? 'AIが文面を最適化中…' : direction === 'outbound' ? '✨ 相手に合わせてAIで個別最適化' : '✨ 相手のDMに合わせてAI返信文を作成'}
                </button>
              </div>

              <textarea
                rows={8}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="上記のテンプレートを押すか、AI生成を押すとここに文面が自動入力されます…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 leading-relaxed focus:bg-white focus:border-purple-500 focus:outline-none font-sans"
              />
            </div>

            {/* ── 詳細オプション（通常は開く必要なし・折りたたみ） ── */}
            <details className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
              <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium flex items-center justify-between">
                <span>⚙️ 補足詳細設定（会社名・次回アクションメモ・ステータス手動変更）</span>
                <span className="text-[10px] text-slate-500">※必要な場合のみ開く</span>
              </summary>
              <div className="mt-3 pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-slate-600 text-[10px] block">会社名・屋号</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例: 株式会社サンプル"
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-[10px] block">担当者名</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="例: 田中 太郎"
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-[10px] block">ステータス手動選択</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DmStatus)}
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label className="text-slate-600 text-[10px] block">次回アクション日</label>
                  <input
                    type="date"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-600 text-[10px] block">次回アクションメモ</label>
                  <input
                    type="text"
                    value={nextActionNote}
                    onChange={(e) => setNextActionNote(e.target.value)}
                    placeholder="例: 反応がなければ来週別テーマで再連絡"
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </details>

            {/* ── アクション実行バー（超巨大ワンタップCTA） ── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDm}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition border border-slate-200 shadow-xs cursor-pointer"
                >
                  <Bookmark className="h-3.5 w-3.5 text-purple-700" />
                  保存のみ
                </button>

                <button
                  type="button"
                  onClick={handleRegisterToCrm}
                  disabled={crmLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  title="CRM見込み客台帳に正式登録"
                >
                  <Building className="h-3.5 w-3.5" />
                  {crmLoading ? 'CRM登録中…' : '🏢 CRMリードへ登録'}
                </button>
              </div>

              {/* メインCTA: コピーしてSNSを開くリンクボタン */}
              <a
                href={computedTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCopyAndMarkSent}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs cursor-pointer bg-purple-700 hover:bg-purple-800"
              >
                <Copy className="h-4 w-4" />
                <span>
                  {direction === 'inbound'
                    ? `返信文をコピーして ${PLATFORM_INFOS[platform].name} を開く`
                    : `文面をコピーして ${PLATFORM_INFOS[platform].name} を開く`}
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
