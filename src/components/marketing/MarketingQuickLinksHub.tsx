import React, { useState } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Share2, 
  FileText, 
  MessageCircle, 
  Calendar, 
  Globe,
  QrCode
} from 'lucide-react';

export const MarketingQuickLinksHub: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedMedium, setSelectedMedium] = useState<string>('note');
  const [campaignName, setCampaignName] = useState<string>('brand_awareness');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mstos.app';

  // 基本公式リンク定義
  const coreLinks = [
    {
      id: 'diagnosis',
      title: '3分無料ボトルネック診断',
      description: '経営・業務の急所と改善処方箋を特定する自動診断フォーム',
      url: `${origin}/f/business-diagnosis`,
      badge: '高成約率',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: Sparkles,
      iconColor: 'text-indigo-400',
    },
    {
      id: 'care_consult',
      title: '介護保険外サービス開業・個別相談',
      description: '診断不要で直接30分面談を申し込める専用受付フォーム',
      url: `${origin}/f/care-consultation`,
      badge: '高額パッケージ直結',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: FileText,
      iconColor: 'text-emerald-400',
    },
    {
      id: 'line_add',
      title: '公式LINE 友だち追加リンク',
      description: 'ステップ配信（実話ストーリー7話）や無料ツール配布の入口',
      url: 'https://line.me/R/ti/p/@mst_management',
      badge: 'リスト獲得',
      badgeColor: 'bg-green-500/20 text-green-300 border-green-500/30',
      icon: MessageCircle,
      iconColor: 'text-green-400',
    },
    {
      id: 'booking',
      title: '30分無料作戦会議（面談日程調整）',
      description: '対面営業や相談後に案内するオンライン面談カレンダー',
      url: `${origin}/apply/booking`,
      badge: '商談直行',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: Calendar,
      iconColor: 'text-cyan-400',
    },
    {
      id: 'media_top',
      title: '自社オウンドメディア / コーポレートHP',
      description: '会社概要・専門コラム・デジタル商品の本拠地',
      url: `${origin}/`,
      badge: '信頼・資産',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: Globe,
      iconColor: 'text-purple-400',
    },
  ];

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // UTMリンクジェネレーター
  const generateUtmUrl = (baseUrl: string) => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}utm_source=${encodeURIComponent(selectedMedium)}&utm_campaign=${encodeURIComponent(campaignName)}`;
  };

  return (
    <div className="space-y-6">
      {/* ── 1. 公式導線リンク集 ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Link2 className="h-5 w-5 text-indigo-400" />
            集客・導線公式リンク集（ワンクリックコピー）
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            SNS、ブログ、広告、名刺・チラシに貼るための公式URLです。クリックしてすぐにコピーできます。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {coreLinks.map((item) => {
            const Icon = item.icon;
            const isCopied = copiedKey === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between hover:border-slate-700 transition shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <Icon className={`h-4 w-4 ${item.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-sm text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-3 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 truncate">
                    {item.url}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
                  >
                    確認する <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.url, item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> コピー完了
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> URLをコピー
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. 流入計測（UTMリンク）発行ツール ── */}
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Share2 className="h-4 w-4 text-cyan-400" />
            媒体別 流入追跡リンク（UTM計測URL）発行ツール
          </h3>
          <p className="mt-1 text-xs text-slate-300">
            「noteに貼る用」「X投稿用」「Web広告用」など、媒体名を選ぶだけで流入元がCRMダッシュボードで自動追跡されるURLを生成します。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-slate-300 font-medium">貼り付け先の媒体（流入元）</label>
            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"
            >
              <option value="note">note（ブログ・記事）</option>
              <option value="x_twitter">X / Twitter（SNS投稿）</option>
              <option value="meta_ads">Meta広告（Facebook / Instagram）</option>
              <option value="google_ads">Googleリスティング広告</option>
              <option value="youtube">YouTube（概要欄）</option>
              <option value="newsletter">メルマガ / LINE配信</option>
              <option value="flyer_qr">チラシ・名刺（QRコード用）</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium">施策・キャンペーン名</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="例: care_opening, dx_consulting"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold text-slate-400">生成された追跡URL（クリックでコピー）:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {coreLinks.slice(0, 4).map((link) => {
              const utmUrl = generateUtmUrl(link.url);
              const isCopied = copiedKey === `utm_${link.id}`;
              return (
                <div
                  key={link.id}
                  onClick={() => copyToClipboard(utmUrl, `utm_${link.id}`)}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:border-indigo-500/60 transition group"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{link.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{utmUrl}</div>
                  </div>
                  <button
                    type="button"
                    className={`shrink-0 p-1.5 rounded-lg text-xs ${
                      isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
