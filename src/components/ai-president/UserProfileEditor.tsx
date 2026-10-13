import React, { useState } from 'react';
import { UserCheck, Save, Check, Brain, Sparkles, BookOpen, Heart, Target, Briefcase } from 'lucide-react';
import { UserProfile } from '../types';

interface UserProfileEditorProps {
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
}

export const UserProfileEditor: React.FC<UserProfileEditorProps> = ({
  userProfile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<UserProfile>({ ...userProfile });
  const [saveNotice, setSaveNotice] = useState(false);

  const handleSave = () => {
    onSaveProfile(formData);
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">あなた（作成者）の記憶・プロファイル</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              ここで設定した情報は、あなたが作成したすべての自分用AIに自動共有・記憶されます。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>記憶を保存</span>
        </button>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>あなたの記憶プロファイルを更新しました！</span>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name / Nickname */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>AIからの呼ばれ方・ニックネーム</span>
          </div>
          <input
            type="text"
            value={formData.userName}
            onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
            placeholder="例: まさと, まーくん, ボス, 先輩"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            設定すると、AIがあなたの名前を呼んで親密に接してくれます。
          </p>
        </div>

        {/* Occupation / Background */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>お仕事・主な活動</span>
          </div>
          <input
            type="text"
            value={formData.userOccupation}
            onChange={(e) => setFormData({ ...formData, userOccupation: e.target.value })}
            placeholder="例: Webエンジニア, 経営企画, 大学生, クリエイター"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            仕事の相談や専門用語の理解に役立てられます。
          </p>
        </div>

        {/* Goals */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Target className="w-4 h-4" />
            <span>現在の目標・挑戦していること</span>
          </div>
          <textarea
            rows={2}
            value={formData.userGoals}
            onChange={(e) => setFormData({ ...formData, userGoals: e.target.value })}
            placeholder="例: 年内に個人アプリをリリースする / 毎朝早起きして30分英語の勉強をする"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            AIがあなたの目標達成を応援・リマインドする基準になります。
          </p>
        </div>

        {/* Hobbies / Interests */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Heart className="w-4 h-4" />
            <span>趣味・好きなこと・関心</span>
          </div>
          <textarea
            rows={2}
            value={formData.userHobbies}
            onChange={(e) => setFormData({ ...formData, userHobbies: e.target.value })}
            placeholder="例: サウナ, コーヒーの自家焙煎, SF映画鑑賞, ポーカー"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-[11px] text-slate-500">
            雑談や例え話にあなたの好みが自然に反映されます。
          </p>
        </div>

        {/* Core Values */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 md:col-span-2 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>大切にしている価値観・ポリシー</span>
          </div>
          <input
            type="text"
            value={formData.userValues}
            onChange={(e) => setFormData({ ...formData, userValues: e.target.value })}
            placeholder="例: 効率よりもワクワク感を重視 / 体と心の健康第一 / 誠実なコミュニケーション"
            className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* AI Long-term Notes / Memories */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Brain className="w-4 h-4" />
              <span>AIが蓄積したパーソナル記憶メモ (長期的記憶)</span>
            </div>
            <span className="text-[11px] text-slate-400">対話画面の「記憶を更新」からも自動蓄積されます</span>
          </div>

          <textarea
            rows={5}
            value={formData.userNotes}
            onChange={(e) => setFormData({ ...formData, userNotes: e.target.value })}
            placeholder={`・朝が苦手で夜型になりがち\n・猫が好きで白猫を飼っている\n・最近React 19とTailwind CSSの学習に夢中`}
            className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
          />
          <p className="text-[11px] text-slate-500">
            箇条書きで自由に追記・編集できます。AIはこのメモを参照して回答します。
          </p>
        </div>
      </div>
    </div>
  );
};
