import React, { useState, useEffect } from 'react';
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
  SendHorizontal
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
  direction: DmDirection;            // 'outbound' (こちらから送信) or 'inbound' (相手から届いたDM)
  platform: DmPlatform;
  companyName: string;
  contactName: string;
  accountHandle: string;             // 例: @sample_ceo
  accountUrl: string;                // SNSプロフURL
  templateCategory: string;          // 初回 / リアクション後 / 返信 / 資料案内 / 商談誘導
  contextInfo: string;               // 相手の投稿内容・事業内容（または届いたDMの本文）
  approachGoal: string;              // 今回のゴール（壁打ち相談、診断誘導、事例紹介など）
  messageText: string;               // 実際に送信するDM文面
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
  description: string;
  templateText: string;
  defaultGoal: string;
}

const DEFAULT_TEMPLATES: DmTemplatePreset[] = [
  // ── 攻めのアプローチ（Outbound） ──
  {
    id: 'out_reaction',
    category: '投稿へのリアクション後',
    title: 'いいね・リポスト・コメントへのお礼',
    direction: 'outbound',
    description: '自社の投稿に反応してくれた見込み客へ、押し付け感なく自然に挨拶と共感を伝える',
    defaultGoal: '関係構築・お礼と軽い意見交換',
    templateText: `{{相手のお名前}}様

突然のメッセージ失礼いたします。{{自分の会社/屋号}}の{{自分の名前}}と申します。

先ほどは私の「{{反応があった投稿テーマ}}」の投稿に{{リアクション内容}}をいただき、誠にありがとうございました！

{{相手の会社名}}様の{{相手の事業や投稿内容}}に関する発信も日頃より拝見しており、{{共感・感銘を受けたポイント}}に深く共感しておりました。

もしよろしければ、今後とも情報交換などさせていただけますと幸いです。
急ぎの用件ではございませんので、返信などはお気になさらないでくださいね。

引き続きよろしくお願いいたします！`
  },
  {
    id: 'out_first_touch',
    category: '初回アプローチ',
    title: '新規開拓・経営課題への共感',
    direction: 'outbound',
    description: 'ターゲット企業の投稿や事業内容をしっかり読み込んだ上で、課題解決の知見をギフトする',
    defaultGoal: '無料診断シートまたは事例の提供',
    templateText: `{{相手のお名前}}様

突然のDMにて失礼いたします。
{{自分の会社/屋号}}にて{{専門分野}}の支援をしております、{{自分の名前}}と申します。

{{相手のお名前}}様の「{{相手の最近の投稿や課題}}」に関する発信を拝見し、まさに多くの経営者様が直面されているテーマだと強く感じ、ご連絡いたしました。

弊社でも同様の課題を抱えていた企業様向けに、「{{提供できる資料やノウハウ}}」をまとめた事例集（無料診断）をご用意しております。

押し売り等は一切ございませんので、もし貴社の今後の参考になりそうでしたら、ご覧いただけますと幸いです。
▼ {{公式案内リンク}}

お忙しいところ恐縮ですが、何卒よろしくお願いいたします。`
  },
  {
    id: 'out_content_gift',
    category: '資料・情報の案内',
    title: '事例・お役立ちシートのプレゼント',
    direction: 'outbound',
    description: '相手の興味関心が高いテーマの特典PDFや診断ツールを案内する',
    defaultGoal: '診断ツールの実施・資料ダウンロード',
    templateText: `{{相手のお名前}}様

いつも有益な発信を拝見しております。{{自分の名前}}です。

先日の{{相手の投稿・関心事}}の件、非常に興味深く拝読いたしました。

実はちょうど今週、{{相手の業種や職種}}向けに「{{資料・診断ツールの名称}}」を公開いたしました。
3分ほどで{{得られるメリットや可視化できる課題}}がわかる内容になっております。

{{相手のお名前}}様の今後の施策のヒントになれば嬉しく思い、共有させていただきました。
▼ 無料診断はこちら: {{公式案内リンク}}

ご興味がございましたら、ぜひご活用ください！`
  },
  {
    id: 'out_meeting_invite',
    category: '商談・相談への誘導',
    title: '30分オンライン壁打ち・個別相談の提案',
    direction: 'outbound',
    description: 'やり取りが数往復続いた相手へ、自然にカジュアルなオンライン相談をご案内する',
    defaultGoal: '30分オンライン相談の日程確定',
    templateText: `{{相手のお名前}}様

ご丁寧なメッセージをいただき、ありがとうございます！

{{相手のお名前}}様のお話を伺い、{{相手の抱える具体的なボトルネックや目標}}について、ぜひ一度弊社の事例なども交えて詳しくお力添えできればと感じました。

もしよろしければ、営業色のない30分ほどの「オンライン無料壁打ち相談」はいかがでしょうか？
以下のカレンダーより、ご都合の良い日時を1タップでお選びいただけます。

▼ オンライン相談 日程調整リンク
{{公式案内リンク}}

画面越しにお話しできますことを楽しみにしております！`
  },

  // ── 届いたDMへの返信（Inbound） ──
  {
    id: 'in_service_inquiry',
    category: '相手からの問い合わせへの返信',
    title: 'サービス・料金への問い合わせ返信',
    direction: 'inbound',
    description: '届いた質問に明快かつ誠実に回答し、次の具体的なステップ（無料診断や相談）へスムーズに繋げる',
    defaultGoal: '相談会の日程調整・詳細ヒアリング',
    templateText: `{{相手のお名前}}様

はじめまして、{{自分の会社/屋号}}の{{自分の名前}}と申します。
この度は弊社への温かいお問い合わせをいただき、誠にありがとうございます！

ご質問いただきました「{{相手の質問内容}}」について回答させていただきます。

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
    id: 'in_collaboration',
    category: '相手からの問い合わせへの返信',
    title: '提携・協業・取材の打診への返信',
    direction: 'inbound',
    description: '協業やコラボの打診に対して、前向きかつスムーズに一次面談へ誘導する',
    defaultGoal: 'オンライン一次面談の設定',
    templateText: `{{相手のお名前}}様

ご連絡いただき、誠にありがとうございます！{{自分の名前}}です。

{{相手の会社名}}様からの協業・コラボレーションのご提案、大変光栄に存じます。
ご提示いただきました{{提案内容のポイント}}について、ぜひ詳しくお話しを伺えれば幸いです。

まずは30分ほど、オンラインにて概要のお打ち合わせはいかがでしょうか？
▼ オンライン面談の日程調整リンク:
{{公式案内リンク}}

日程のご都合が合わない場合は、候補日時を2〜3いただけましたら調整いたします。
お話しできますことを心待ちにしております！`
  }
];

const PLATFORM_INFOS: Record<DmPlatform, { name: string; badge: string; color: string; domain: string }> = {
  x: { name: 'X (Twitter)', badge: 'X', color: 'bg-zinc-800 text-white border-zinc-700', domain: 'https://x.com/' },
  instagram: { name: 'Instagram', badge: 'IG', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30', domain: 'https://www.instagram.com/' },
  linkedin: { name: 'LinkedIn', badge: 'LI', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', domain: 'https://www.linkedin.com/' },
  facebook: { name: 'Facebook', badge: 'FB', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', domain: 'https://www.facebook.com/' },
  threads: { name: 'Threads', badge: 'TH', color: 'bg-zinc-700/30 text-zinc-300 border-zinc-600', domain: 'https://www.threads.net/' },
  other: { name: 'その他・SNS', badge: 'SNS', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', domain: '' },
};

const STATUS_LABELS: Record<DmStatus, { label: string; badgeColor: string }> = {
  draft: { label: '下書き・準備中', badgeColor: 'bg-slate-700/40 text-slate-300 border-slate-600' },
  sent_waiting: { label: '送信済・返信待ち', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  inbound_waiting: { label: 'DM受信・返信作成中', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  replied: { label: '返信あり・対話中', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  meeting_scheduled: { label: '商談・相談確定', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  converted: { label: 'リード化・成約', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  closed: { label: '見送り・終了', badgeColor: 'bg-zinc-700/30 text-zinc-400 border-zinc-700' },
};

const STORAGE_KEY = 'ai_social_dm_sales_items_v1';

export const SocialDmSalesStudio: React.FC = () => {
  // 公式URL一覧（誘導用リンクの埋め込み用）
  const [officialLinks, setOfficialLinks] = useState<OfficialLinkItem[]>([]);
  const [selectedOfficialLinkId, setSelectedOfficialLinkId] = useState<string>('');

  // DMアイテム一覧
  const [dmList, setDmList] = useState<DmItem[]>([]);
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);

  // 編集・作成フォームの状態
  const [direction, setDirection] = useState<DmDirection>('outbound');
  const [platform, setPlatform] = useState<DmPlatform>('x');
  const [companyName, setCompanyName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [accountHandle, setAccountHandle] = useState<string>('');
  const [accountUrl, setAccountUrl] = useState<string>('');
  const [templateCategory, setTemplateCategory] = useState<string>(DEFAULT_TEMPLATES[0].category);
  const [contextInfo, setContextInfo] = useState<string>('');
  const [approachGoal, setApproachGoal] = useState<string>(DEFAULT_TEMPLATES[0].defaultGoal);
  const [messageText, setMessageText] = useState<string>('');
  const [status, setStatus] = useState<DmStatus>('draft');
  const [nextActionDate, setNextActionDate] = useState<string>('');
  const [nextActionNote, setNextActionNote] = useState<string>('');

  // UI状態
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [filterDirection, setFilterDirection] = useState<'all' | 'outbound' | 'inbound'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [crmLoading, setCrmLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

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
          if (parsed.length > 0) {
            loadDmToForm(parsed[0]);
          }
        }
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
            loadDmToForm(data.payload.items[0]);
          }
        }
      } catch (err) {
        console.warn('Failed to load remote DM records:', err);
      }
    };

    void loadRemote();
  }, []);

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
    setTemplateCategory(item.templateCategory || DEFAULT_TEMPLATES[0].category);
    setContextInfo(item.contextInfo || '');
    setApproachGoal(item.approachGoal || '');
    setMessageText(item.messageText || '');
    setStatus(item.status || 'draft');
    setNextActionDate(item.nextActionDate || '');
    setNextActionNote(item.nextActionNote || '');
  };

  // 新規アプローチ作成ボタン
  const handleCreateNew = (newDirection: DmDirection = 'outbound') => {
    setSelectedDmId(null);
    setDirection(newDirection);
    setPlatform('x');
    setCompanyName('');
    setContactName('');
    setAccountHandle('');
    setAccountUrl('');
    
    const defaultTpl = DEFAULT_TEMPLATES.find((t) => t.direction === newDirection) || DEFAULT_TEMPLATES[0];
    setTemplateCategory(defaultTpl.category);
    setContextInfo('');
    setApproachGoal(defaultTpl.defaultGoal);
    setMessageText(defaultTpl.templateText);
    setStatus(newDirection === 'inbound' ? 'inbound_waiting' : 'draft');
    setNextActionDate('');
    setNextActionNote('');
    
    setFeedback({
      type: 'info',
      message: newDirection === 'outbound' 
        ? '新規のアウトバウンド（攻めのアプローチ）作成を開始しました。' 
        : '新規のインバウンド（届いたDMへの返信）作成を開始しました。'
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // テンプレート適用
  const handleApplyTemplate = (tpl: DmTemplatePreset) => {
    setTemplateCategory(tpl.category);
    setApproachGoal(tpl.defaultGoal);
    
    let text = tpl.templateText;
    text = text.replace(/{{相手のお名前}}/g, contactName || '担当者');
    text = text.replace(/{{相手の会社名}}/g, companyName || '貴社');
    
    const activeLink = officialLinks.find((l) => l.id === selectedOfficialLinkId);
    if (activeLink) {
      text = text.replace(/{{公式案内リンク}}/g, activeLink.url);
    }
    
    setMessageText(text);
    setFeedback({ type: 'success', message: `テンプレート「${tpl.title}」を反映しました！` });
    setTimeout(() => setFeedback(null), 2500);
  };

  // AIによる個別最適化生成
  const handleAIGenerateCustomDM = async () => {
    if (aiGenerating) return;
    setAiGenerating(true);
    setFeedback({ type: 'info', message: '社内AIが相手のコンテクストを分析し、自然な文面を最適化中…' });

    try {
      const activeLink = officialLinks.find((l) => l.id === selectedOfficialLinkId);
      const linkInfo = activeLink ? `【案内したい自社リンク】: ${activeLink.title} (${activeLink.url})` : '';

      const isOutbound = direction === 'outbound';
      const prompt = isOutbound
        ? `あなたはBtoB営業・SNSマーケティングのトッププロフェッショナルです。
以下の情報をもとに、相手の心を動かし、決してスパムだと思われない「極めて自然で礼儀正しく、価値提供のある個別DM文面」を作成してください。

【送信先媒体】: ${PLATFORM_INFOS[platform].name}
【相手の会社名・屋号】: ${companyName || '（未入力・文脈に合わせる）'}
【相手の氏名・役職】: ${contactName || 'ご担当者様'}
【相手のSNSアカウント】: ${accountHandle || 'なし'}
【相手の投稿内容・事業内容・課題】:
${contextInfo || '日頃から有益な発信をされている経営者様'}
【今回のアプローチ目的・ゴール】: ${approachGoal || '無料相談または診断シートの提供'}
${linkInfo}
【現在のベース文章・希望トーン】:
${messageText || '自然で共感のある挨拶から始めてください'}

【厳格な要件】:
1. コピペ感・テンプレート感を徹底的に排除し、「相手の投稿や事業を本当に読んだこと」が伝わる具体的な共感の一文を入れる。
2. 押し売りや誇大表現をしない。まずは有益な知見や無料診断などのギフトから入る。
3. 最後に「返信はお気になさらないでください」または「もしご興味があれば」と相手の心理的負担を下げる配慮を入れる。
4. 送信先媒体（${PLATFORM_INFOS[platform].name}）に適した改行と読みやすさにする。
5. 出力はDM本文のみを返してください。`
        : `あなたはBtoB企業のカスタマーサクセス・営業責任者です。
SNSで相手から届いたDM（問い合わせ）に対して、相手に深い好印象を与え、次のステップ（無料診断やオンライン相談）へ自然に導く「丁寧かつ明快な返信DM文面」を作成してください。

【受信媒体】: ${PLATFORM_INFOS[platform].name}
【問い合わせ主】: ${companyName ? `${companyName} ` : ''}${contactName || 'お客様'}
【相手から届いたDMのメッセージ本文】:
${contextInfo || 'サービス内容や費用について教えてほしい'}
【返信のゴール】: ${approachGoal || '疑問への誠実な回答とオンライン日程調整'}
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
      setTimeout(() => setFeedback(null), 4000);
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
      // 既存の更新
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
            templateCategory,
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
      setFeedback({ type: 'success', message: 'DMアプローチ情報を更新・保存しました！' });
    } else {
      // 新規作成
      const newItem: DmItem = {
        id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        direction,
        platform,
        companyName,
        contactName,
        accountHandle,
        accountUrl,
        templateCategory,
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
      setFeedback({ type: 'success', message: '新規DMアプローチを台帳に登録しました！' });
    }

    await persistDmList(updatedList);
    setTimeout(() => setFeedback(null), 3000);
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
    setFeedback({ type: 'info', message: 'DMアプローチ記録を削除しました。' });
    setTimeout(() => setFeedback(null), 2500);
  };

  // クリップボードにコピー
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // SNSを開いて手動送信
  const handleOpenSnsAndCopy = () => {
    if (!messageText.trim()) {
      setFeedback({ type: 'error', message: 'コピーする文面がありません。' });
      return;
    }

    // 1. 文面をクリップボードにコピー
    copyToClipboard(messageText, 'open_sns');

    // 2. 相手のアカウントURLまたはSNSのDMページを新しいタブで開く
    let targetUrl = accountUrl.trim();
    if (!targetUrl) {
      const handle = accountHandle.replace(/^@/, '').trim();
      if (handle) {
        if (platform === 'x') targetUrl = `https://x.com/${handle}`;
        else if (platform === 'instagram') targetUrl = `https://www.instagram.com/${handle}/`;
        else if (platform === 'threads') targetUrl = `https://www.threads.net/@${handle}`;
      }
    }

    // URLが特定できない場合のデフォルト
    if (!targetUrl) {
      if (platform === 'x') targetUrl = 'https://x.com/messages';
      else if (platform === 'instagram') targetUrl = 'https://www.instagram.com/direct/inbox/';
      else if (platform === 'linkedin') targetUrl = 'https://www.linkedin.com/messaging/';
      else if (platform === 'facebook') targetUrl = 'https://www.facebook.com/messages/';
      else targetUrl = 'https://x.com/messages';
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');

    // 3. ステータスを自動で「送信済・返信待ち」に更新（下書きの場合）
    if (status === 'draft') {
      setStatus('sent_waiting');
    }

    setFeedback({
      type: 'success',
      message: `文面をクリップボードにコピーし、${PLATFORM_INFOS[platform].name} を開きました！そのまま貼り付けて送信してください。`
    });
    setTimeout(() => setFeedback(null), 5000);
  };

  // CRM（リード・会社台帳）へ連携
  const handleRegisterToCrm = async () => {
    if (crmLoading) return;
    setCrmLoading(true);

    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabaseクライアントが見つかりません。');

      const targetCompanyName = companyName.trim() || `${contactName || 'SNS見込み顧客'}（${PLATFORM_INFOS[platform].name}）`;
      
      // 1. 会社台帳 (companies) へ登録または既存検索
      let resolvedCompanyId: string | undefined;
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .ilike('company_name', targetCompanyName)
        .maybeSingle();

      if (existingCompany?.id) {
        resolvedCompanyId = existingCompany.id;
      } else {
        const { data: newCompany, error: compErr } = await supabase
          .from('companies')
          .insert({
            company_name: targetCompanyName,
            representative_name: contactName.trim() || undefined,
            website_url: accountUrl.trim() || undefined,
            notes: `SNS DM営業より自動登録 (媒体: ${PLATFORM_INFOS[platform].name}, アカウント: ${accountHandle})`,
          })
          .select('id')
          .single();

        if (!compErr && newCompany) {
          resolvedCompanyId = newCompany.id;
        }
      }

      // 2. リード台帳 (leads) へ登録
      const leadSource = `SNS DM営業（${PLATFORM_INFOS[platform].name}）`;
      const leadNotes = `【SNS DM営業記録】
媒体: ${PLATFORM_INFOS[platform].name}
種別: ${direction === 'outbound' ? '攻めのアプローチ' : '届いたDMへの返信'}
アカウント: ${accountHandle || 'なし'}
アプローチ目的: ${approachGoal || '個別相談'}
コンテクスト: ${contextInfo || 'なし'}
最新DM文面:
${messageText.slice(0, 300)}...
次回アクション: ${nextActionNote || '返信確認'} (${nextActionDate || '日程未定'})`;

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
      // 現在のアイテムを更新
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
        message: `「${targetCompanyName}」をCRM（顧客台帳・リード一覧）に見込み客として正式登録しました！`
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      console.error('CRM Register Error:', err);
      setFeedback({ type: 'error', message: err.message || 'CRM連携中にエラーが発生しました。' });
    } finally {
      setCrmLoading(false);
    }
  };

  // フィルタリング処理
  const filteredList = dmList.filter((item) => {
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

  const activeItem = dmList.find((i) => i.id === selectedDmId);

  return (
    <div className="space-y-5 text-slate-100">
      {/* ── ツール紹介・実績向上バナー ── */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">💬 SNS営業・DM個別管理スタジオ</h3>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-bold text-indigo-300 border border-indigo-500/30">
                攻め（アプローチ）＆ 受け（届いたDM返信）両対応
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              投稿へのリアクションや特定ターゲットへの個別アプローチ、さらに相手から届いたDMへのAI返信案作成とCRM連携をワンストップで管理します。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCreateNew('outbound')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
            >
              <SendHorizontal className="h-3.5 w-3.5" />
              ＋ 新規アプローチ (攻め)
            </button>
            <button
              type="button"
              onClick={() => handleCreateNew('inbound')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Inbox className="h-3.5 w-3.5" />
              ＋ 届いたDMの返信作成 (受け)
            </button>
          </div>
        </div>

        {/* 開閉式ガイド */}
        {showGuide && (
          <div className="mt-4 pt-3 border-t border-indigo-500/20 grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] leading-relaxed">
            <div className="rounded-xl bg-slate-950/70 p-3 border border-indigo-500/20 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px]">1</span>
                ① シーン別テンプレ
              </div>
              <p className="text-slate-400">
                初回挨拶、リアクション後のお礼、届いた質問への返答、資料案内、日程調整などシーン別に即座に呼び出し可能。
              </p>
            </div>

            <div className="rounded-xl bg-slate-950/70 p-3 border border-indigo-500/20 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px]">2</span>
                ② AI個別最適化
              </div>
              <p className="text-slate-400">
                相手の投稿や届いた質問を1行入れるだけで、AIがスパム感ゼロの誠実で魅力的な返信文にカスタマイズ。
              </p>
            </div>

            <div className="rounded-xl bg-slate-950/70 p-3 border border-indigo-500/20 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px]">3</span>
                ③ 手動送信で垢BANゼロ
              </div>
              <p className="text-slate-400">
                ボタン1つで文面コピー＆相手のSNSを開く安全設計。ボットによる凍結リスクなく安全に運用できます。
              </p>
            </div>

            <div className="rounded-xl bg-slate-950/70 p-3 border border-indigo-500/20 space-y-1">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px]">4</span>
                ④ CRMリードへ即時登録
              </div>
              <p className="text-slate-400">
                見込み顧客をワンクリックで会社台帳・リード一覧へ保存。商談や受注までの営業パイプラインに直結します。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── フィードバックバナー ── */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs shadow-md animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200'
              : feedback.type === 'error'
              ? 'border-rose-500/40 bg-rose-950/60 text-rose-200'
              : 'border-indigo-500/40 bg-indigo-950/60 text-indigo-200'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
          {feedback.type === 'info' && <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />}
          <div className="font-medium leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* ── メインレイアウト（左：一覧台帳、右：作成・AI最適化ワークスペース） ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ── 左カラム: DM管理リスト (5カラム) ── */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-md">
            
            {/* フィルター & 検索 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4 text-indigo-400" />
                  <span>アプローチ・DM履歴一覧 ({filteredList.length}件)</span>
                </h4>
              </div>

              {/* 種別タブ（すべて / 攻め / 受け） */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterDirection('all')}
                  className={`py-1 text-center font-bold rounded-lg transition ${
                    filterDirection === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  すべて
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDirection('outbound')}
                  className={`py-1 text-center font-bold rounded-lg transition ${
                    filterDirection === 'outbound' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  攻め (アプローチ)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDirection('inbound')}
                  className={`py-1 text-center font-bold rounded-lg transition ${
                    filterDirection === 'inbound' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  受け (届いたDM)
                </button>
              </div>

              {/* 検索ボックス & ステータスフィルター */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="会社名・氏名・文面検索"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">全ステータス</option>
                  {Object.entries(STATUS_LABELS).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* リスト表示 */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredList.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  該当するDMアプローチ履歴はありません。
                </div>
              ) : (
                filteredList.map((item) => {
                  const isSelected = item.id === selectedDmId;
                  const platInfo = PLATFORM_INFOS[item.platform];
                  const statusInfo = STATUS_LABELS[item.status];

                  return (
                    <div
                      key={item.id}
                      onClick={() => loadDmToForm(item)}
                      className={`p-3 rounded-xl border cursor-pointer transition text-xs space-y-1.5 relative group ${
                        isSelected
                          ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            item.direction === 'inbound'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          }`}>
                            {item.direction === 'inbound' ? '受信' : '送信'}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${platInfo.color}`}>
                            {platInfo.badge}
                          </span>
                          <span className="font-bold text-white truncate">
                            {item.companyName || item.contactName || item.accountHandle || '名称未設定'}
                          </span>
                        </div>

                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusInfo.badgeColor} shrink-0`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* 相手氏名・アカウント */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {item.contactName && <span>{item.contactName} 様</span>}
                        {item.accountHandle && <span className="font-mono text-cyan-300/80">{item.accountHandle}</span>}
                      </div>

                      {/* 本文プレビュー */}
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-sans">
                        {item.messageText || '(文面なし)'}
                      </p>

                      {/* CRM連携バッジ & 次回アクション */}
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/80">
                        <div className="flex items-center gap-1 text-slate-400">
                          {item.nextActionDate && (
                            <span className="flex items-center gap-0.5 text-amber-300">
                              <Calendar className="h-3 w-3" /> 次回: {item.nextActionDate}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.crmLeadId ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="h-3 w-3" /> CRM連携済
                            </span>
                          ) : (
                            <span className="text-slate-500">CRM未登録</span>
                          )}

                          <InlineDeleteButton
                            onConfirm={() => handleDeleteDm(item.id)}
                            confirmLabel="削除"
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                            ariaLabel="このDM履歴を削除"
                          >
                            <Trash2 className="h-3 w-3" />
                          </InlineDeleteButton>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── 右カラム: 送信内容の個別編集 & AI個別最適化 ワークスペース (7カラム) ── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-md">
            
            {/* ワークスペースヘッダー */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>
                    {activeItem ? `「${companyName || contactName || 'ターゲット'}」のDM作成・個別最適化` : '新規DMアプローチ作成'}
                  </span>
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {direction === 'outbound'
                    ? '相手の投稿や関心に合わせてAIが礼儀正しく刺さるDMを自動生成します。'
                    : '届いたDMの質問に的確に回答し、無料診断や相談へと自然に導く返信を作成します。'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">種別:</span>
                <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setDirection('outbound')}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      direction === 'outbound' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    攻め (アプローチ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('inbound')}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      direction === 'inbound' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    受け (届いたDM返信)
                  </button>
                </div>
              </div>
            </div>

            {/* ── 相手の情報入力フォーム ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium">送信先媒体</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as DmPlatform)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white font-semibold"
                >
                  {Object.entries(PLATFORM_INFOS).map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium">会社名・屋号</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="例: 株式会社サンプル"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">相手の氏名・役職</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="例: 山田 太郎 代表"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium">相手のSNSアカウント（ユーザー名）</label>
                <input
                  type="text"
                  value={accountHandle}
                  onChange={(e) => setAccountHandle(e.target.value)}
                  placeholder="例: @yamada_biz"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">相手のSNSプロフURL（またはDMリンク）</label>
                <input
                  type="text"
                  value={accountUrl}
                  onChange={(e) => setAccountUrl(e.target.value)}
                  placeholder="例: https://x.com/yamada_biz"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white font-mono"
                />
              </div>
            </div>

            {/* ── 相手のコンテクスト & アプローチ目的 ── */}
            <div className="space-y-2 text-xs">
              <label className="text-slate-300 font-medium flex items-center justify-between">
                <span>
                  {direction === 'outbound'
                    ? '相手の投稿内容・事業内容・関心事（AIがここに深く共感して文章を作ります）'
                    : '届いたDMのメッセージ本文（相手からの質問・要望をここに貼り付け）'}
                </span>
                <span className="text-[10px] text-cyan-400 font-normal">※1〜2行でOK・AIが解析</span>
              </label>
              <textarea
                rows={2}
                value={contextInfo}
                onChange={(e) => setContextInfo(e.target.value)}
                placeholder={
                  direction === 'outbound'
                    ? '例: 「来期の介護スタッフ採用の母集団形成に悩んでいる」という投稿をしていた。ケアマネ向け新事業も開始された模様。'
                    : '例: 「はじめまして！投稿で紹介されていた業務改善システムについて、導入費用と期間を教えていただきたいです」'
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none leading-relaxed"
              />
            </div>

            {/* ── 誘導リンク & シーン別テンプレート選択 ── */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-300 font-medium">案内・埋め込みたい公式リンク</label>
                  <select
                    value={selectedOfficialLinkId}
                    onChange={(e) => setSelectedOfficialLinkId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
                  >
                    {officialLinks.map((link) => (
                      <option key={link.id} value={link.id}>
                        {link.title} ({link.url})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium">アプローチ・返信のゴール</label>
                  <input
                    type="text"
                    value={approachGoal}
                    onChange={(e) => setApproachGoal(e.target.value)}
                    placeholder="例: 無料診断の受診、30分相談の日程確定"
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
                  />
                </div>
              </div>

              {/* シーン別テンプレートボタン */}
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5 text-indigo-400" />
                  <span>シーン別テンプレート（選んで文面のベースを即座に作成）:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_TEMPLATES.filter((t) => t.direction === direction).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                      title={tpl.description}
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── DM文面（テキストエリア ＋ AI個別最適化ボタン） ── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-400" />
                  <span>送信DM本文（直接編集可能）</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    ({messageText.length} 文字)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleAIGenerateCustomDM}
                  disabled={aiGenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:opacity-90 text-white text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {aiGenerating ? 'AIが個別最適化中…' : '✨ 相手に合わせてAIで個別最適化'}
                </button>
              </div>

              <textarea
                rows={9}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="ここにDM文面を入力するか、上記の「✨ 相手に合わせてAIで個別最適化」を押して自動作成します…"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-xs text-white leading-relaxed focus:border-indigo-500 focus:outline-none font-sans"
              />
            </div>

            {/* ── 送信ステータス & 次回アクション管理 ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/70 text-xs">
              <div>
                <label className="text-slate-300 font-medium">現在の進行ステータス</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DmStatus)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white font-bold"
                >
                  {Object.entries(STATUS_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-amber-400" />
                  次回アクション日
                </label>
                <input
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium">次回アクションメモ</label>
                <input
                  type="text"
                  value={nextActionNote}
                  onChange={(e) => setNextActionNote(e.target.value)}
                  placeholder="例: 返信なければ来週別記事共有"
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-white"
                />
              </div>
            </div>

            {/* ── アクション実行バー ── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDm}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition border border-slate-700"
                >
                  <Bookmark className="h-3.5 w-3.5 text-indigo-400" />
                  保存・下書き登録
                </button>

                {/* CRMへ登録ボタン */}
                <button
                  type="button"
                  onClick={handleRegisterToCrm}
                  disabled={crmLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                  title="この相手をCRMのリード台帳・会社台帳に見込み客として登録"
                >
                  <Building className="h-3.5 w-3.5" />
                  {crmLoading ? 'CRM登録中…' : '🏢 CRM顧客台帳（リード）へ登録'}
                </button>
              </div>

              {/* SNSを開いて手動送信ボタン */}
              <button
                type="button"
                onClick={handleOpenSnsAndCopy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>文面をコピーして {PLATFORM_INFOS[platform].name} を開く</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
