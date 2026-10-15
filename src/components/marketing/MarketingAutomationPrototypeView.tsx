import React, { useState } from 'react';
import { Activity, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, CirclePlay, Clock3, GitBranch, Mail, MessageCircle, MousePointerClick, Plus, Radio, Search, Settings2, Tags, Users, Webhook, Zap } from 'lucide-react';

type Scenario = { id: number; name: string; trigger: string; path: string; status: '稼働中' | '下書き'; runs: number; };
const initialScenarios: Scenario[] = [
  { id: 1, name: '診断フォーム登録後フォロー', trigger: '診断フォーム送信', path: 'タグ付与 → LINEで案内 → 予約待ち', status: '稼働中', runs: 128 },
  { id: 2, name: '予約前日のリマインド', trigger: '予約日の前日', path: 'LINE通知 → 未読ならメール案内', status: '稼働中', runs: 46 },
  { id: 3, name: '提案後のフォローアップ', trigger: '提案書を送付', path: '3日後に確認タスク → 担当者へ通知', status: '下書き', runs: 0 },
];

export const MarketingAutomationPrototypeView: React.FC = () => {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [activeTab, setActiveTab] = useState<'overview' | 'scenarios' | 'connections'>('overview');
  const [notice, setNotice] = useState('');
  const runDemo = (id: number) => {
    setScenarios((items) => items.map((item) => item.id === id ? { ...item, runs: item.runs + 1 } : item));
    setNotice('デモ実行を記録しました。外部サービスへの送信・顧客データ更新は行っていません。');
  };
  const tabs = [
    { id: 'overview' as const, label: '顧客導線', icon: GitBranch },
    { id: 'scenarios' as const, label: 'シナリオ', icon: Zap },
    { id: 'connections' as const, label: '連携候補', icon: Webhook },
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-white">マーケティングオートメーション</h1>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">プロトタイプ</span>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">見込み客の登録から診断・案内・予約・商談・契約後フォローまでを、営業・顧客管理の中でつなぐ構想画面です。</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs text-slate-300"><span className="font-bold text-amber-300">デモモード</span><br />この画面は外部に送信しません</div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto border-t border-slate-800 pt-4">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setActiveTab(id); setNotice(''); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </section>

      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {activeTab === 'overview' && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '見込み客', value: '248', note: '+18 今月', icon: Users, color: 'text-cyan-300' },
            { label: '稼働中シナリオ', value: String(scenarios.filter((s) => s.status === '稼働中').length), note: 'ルールベースで実行', icon: Zap, color: 'text-amber-300' },
            { label: '今月の自動処理', value: String(scenarios.reduce((sum, s) => sum + s.runs, 0)), note: 'デモ用カウンター', icon: Activity, color: 'text-emerald-300' },
            { label: '要対応の予約', value: '6', note: '営業・顧客管理と連携', icon: CalendarDays, color: 'text-purple-300' },
          ].map(({ label, value, note, icon: Icon, color }) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><Icon className={`h-4 w-4 ${color}`} /></div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[11px] text-slate-500">{note}</div></div>)}
        </div>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-white">顧客導線</h2><p className="mt-1 text-xs text-slate-400">固定ルールでの自動処理を基本とし、必要な場面だけAIを使います。</p></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">AI呼び出しなしで運用可能</span></div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { title: '集客・登録', detail: '広告 / SNS / 紹介', icon: MousePointerClick },
              { title: 'フォーム・診断', detail: '回答・スコア保存', icon: CheckCircle2 },
              { title: 'タグ・区分', detail: '条件で自動分類', icon: Tags },
              { title: 'LINE・メール', detail: '承認済み文面を配信', icon: MessageCircle },
              { title: '予約・商談', detail: '予約案内・担当タスク', icon: CalendarDays },
              { title: '契約後フォロー', detail: '契約・請求・継続支援', icon: BadgeCheck },
            ].map(({ title, detail, icon: Icon }, index) => <div key={title} className="relative rounded-xl border border-slate-800 bg-slate-950/70 p-4"><Icon className="mb-3 h-5 w-5 text-indigo-300" /><div className="text-sm font-bold text-white">{title}</div><div className="mt-1 text-[11px] text-slate-400">{detail}</div>{index < 5 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-slate-600 xl:block" />}</div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2"><Radio className="h-4 w-4 text-indigo-300" /><h2 className="font-bold text-white">運用イメージ</h2></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-950 p-4"><div className="text-xs font-bold text-cyan-300">1. 顧客情報を受け取る</div><p className="mt-2 text-xs leading-5 text-slate-400">診断フォームやLINE登録を起点に、顧客・見込み客の記録を作成します。</p></div>
            <div className="rounded-xl bg-slate-950 p-4"><div className="text-xs font-bold text-amber-300">2. 条件で業務を動かす</div><p className="mt-2 text-xs leading-5 text-slate-400">タグ付与、担当タスク、予約案内などの定型処理はプログラムで実行します。</p></div>
            <div className="rounded-xl bg-slate-950 p-4"><div className="text-xs font-bold text-purple-300">3. 必要な時だけAIを呼ぶ</div><p className="mt-2 text-xs leading-5 text-slate-400">戦略、診断所見、個別提案、配信文案など判断や文章が必要な場面に限定します。</p></div>
          </div>
        </section>
      </>}

      {activeTab === 'scenarios' && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-white">シナリオ一覧</h2><p className="mt-1 text-xs text-slate-400">条件・待機時間・実行アクションを組み合わせる想定です。</p></div><button onClick={() => { setScenarios((items) => [...items, { id: Date.now(), name: '新しいシナリオ（下書き）', trigger: 'トリガー未設定', path: 'アクション未設定', status: '下書き', runs: 0 }]); setNotice('デモ用シナリオを追加しました。'); }} className="flex items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"><Plus className="h-4 w-4" />シナリオを追加</button></div>
        <div className="space-y-3">{scenarios.map((scenario) => <article key={scenario.id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:grid-cols-[1.2fr_1fr_1.5fr_auto] lg:items-center"><div><div className="font-bold text-white">{scenario.name}</div><div className="mt-1 text-xs text-slate-400">開始条件：{scenario.trigger}</div></div><div className="text-xs text-slate-300">{scenario.path}</div><div className="flex flex-wrap items-center gap-3 text-xs text-slate-400"><span>{scenario.runs} 回（デモ値）</span><span className={scenario.status === '稼働中' ? 'text-emerald-300' : 'text-slate-500'}>{scenario.status}</span></div><button onClick={() => runDemo(scenario.id)} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"><CirclePlay className="h-4 w-4" />デモ実行</button></article>)}</div>
      </section>}

      {activeTab === 'connections' && <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-indigo-500/30 bg-slate-900 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-white">LINE Harness OSS</h2><p className="mt-1 text-xs text-slate-400">LINE公式アカウント連携候補</p></div><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-amber-300">未接続</span></div><p className="mt-4 text-sm leading-6 text-slate-300">セルフホスト型のLINE CRM候補。LINE配信、友だち・タグ管理、フォームや予約などの機能を、MST側の顧客・シナリオとどう連携するかを検討するためのカードです。</p><div className="mt-4 flex flex-wrap gap-2">{['OSS / MIT', 'LINE Messaging API', 'セルフホスト候補'].map((x) => <span key={x} className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300">{x}</span>)}</div><a href="https://github.com/Shudesu/line-harness-oss" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">GitHubリポジトリを確認 <ArrowRight className="h-3.5 w-3.5" /></a><p className="mt-3 text-[11px] leading-5 text-slate-500">ソフトウェアのライセンスと、ホスティング・LINE公式アカウント側の費用は別です。実際の接続には認証情報・権限・データ同期設計が必要です。</p></section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-lg font-bold text-white">将来の連携構成</h2><p className="mt-1 text-xs text-slate-400">送信ツールを顧客台帳の唯一の保存先にしない構成を想定。</p><ol className="mt-4 space-y-3 text-xs leading-5 text-slate-300"><li className="flex gap-2"><span className="font-bold text-cyan-300">MST</span><span>顧客・診断・商談・契約などの基幹データ</span></li><li className="flex gap-2"><span className="font-bold text-indigo-300">LINE Harness</span><span>LINE配信などチャネル実行部分</span></li><li className="flex gap-2"><span className="font-bold text-amber-300">ルールエンジン</span><span>条件分岐・待機・重複防止・監査ログ（AIなしで実行）</span></li><li className="flex gap-2"><span className="font-bold text-purple-300">役割別AI</span><span>企画・診断・提案・文面など必要な作業だけ呼び出す</span></li></ol></section>
      </div>}
    </div>
  );
};
