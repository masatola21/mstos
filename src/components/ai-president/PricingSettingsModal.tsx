import React, { useState } from 'react';
import {
  X,
  Coins,
  Settings,
  History,
  Check,
  AlertCircle,
  RotateCcw,
  Clock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { ModelPricingRate, TokenUsageRecord } from '../types';

interface PricingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pricingRates: ModelPricingRate[];
  tokenUsageRecords: TokenUsageRecord[];
  onSavePricingRates: (rates: ModelPricingRate[]) => void;
  onClearUsageRecords?: () => void;
}

export const PricingSettingsModal: React.FC<PricingSettingsModalProps> = ({
  isOpen,
  onClose,
  pricingRates,
  tokenUsageRecords,
  onSavePricingRates,
  onClearUsageRecords,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');

  // Active rate for gemini-3.8-flash
  const currentRate =
    pricingRates.find((r) => r.model === 'gemini-3.8-flash') || pricingRates[0] || {
      model: 'gemini-3.8-flash',
      currency: 'JPY' as const,
      inputPricePerMillion: 75,
      outputPricePerMillion: 300,
      updatedAt: Date.now(),
    };

  const [currency, setCurrency] = useState<'JPY' | 'USD'>(currentRate.currency || 'JPY');
  const [inputPrice, setInputPrice] = useState<string>(
    currentRate.inputPricePerMillion !== null && currentRate.inputPricePerMillion !== undefined
      ? String(currentRate.inputPricePerMillion)
      : ''
  );
  const [outputPrice, setOutputPrice] = useState<string>(
    currentRate.outputPricePerMillion !== null && currentRate.outputPricePerMillion !== undefined
      ? String(currentRate.outputPricePerMillion)
      : ''
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    const parsedInput = inputPrice.trim() === '' ? null : Number(inputPrice);
    const parsedOutput = outputPrice.trim() === '' ? null : Number(outputPrice);

    if (
      (parsedInput !== null && isNaN(parsedInput)) ||
      (parsedOutput !== null && isNaN(parsedOutput))
    ) {
      alert('単価には半角数字を入力してください。');
      return;
    }

    const updatedRates: ModelPricingRate[] = [
      {
        model: 'gemini-3.8-flash',
        currency,
        inputPricePerMillion: parsedInput,
        outputPricePerMillion: parsedOutput,
        updatedAt: Date.now(),
      },
    ];

    onSavePricingRates(updatedRates);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleUnsetRate = () => {
    setInputPrice('');
    setOutputPrice('');
    const updatedRates: ModelPricingRate[] = [
      {
        model: 'gemini-3.8-flash',
        currency,
        inputPricePerMillion: null,
        outputPricePerMillion: null,
        updatedAt: Date.now(),
      },
    ];
    onSavePricingRates(updatedRates);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handlePresetRecommend = () => {
    setCurrency('JPY');
    setInputPrice('75');
    setOutputPrice('300');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>AIモデル単価設定 & 利用量履歴</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                100万トークンあたりの目安単価の設定と、呼び出し単位の実測トークン履歴
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-slate-800 flex items-center gap-2 bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>モデル単価設定</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>呼び出し単位の履歴 ({tokenUsageRecords.length}件)</span>
          </button>
        </div>

        {/* Tab 1: Pricing Settings */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Caution Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>表示料金についての注意事項</span>
              </div>
              <p className="leading-relaxed text-[11px] text-amber-200/80">
                本アプリでの料金表示は、API応答に含まれる「実測トークン数」と下記で設定した「単価」から算出した【料金目安】です。Google Cloud / AI Studioの請求確定額とは区別されます。無料枠の適用有無は判定できないため、実際の請求額を示すものではありません。
              </p>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>単価設定を更新しました！今後のAPI呼び出しに即座に反映されます。</span>
              </div>
            )}

            {/* Model Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>モデル: gemini-3.8-flash</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                      既定モデル
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    現在の料金表更新日:{' '}
                    {currentRate.updatedAt
                      ? new Date(currentRate.updatedAt).toLocaleString('ja-JP')
                      : '未更新'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePresetRecommend}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  公表標準レートをセット
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    通貨単位
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'JPY' | 'USD')}
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="JPY">日本円 (JPY / ¥)</option>
                    <option value="USD">米ドル (USD / $)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    入力単価 (100万トークンあたり)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={inputPrice}
                      onChange={(e) => setInputPrice(e.target.value)}
                      placeholder="未設定 (空欄)"
                      className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-slate-500">
                      {currency === 'JPY' ? '円' : '$'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">空欄の場合は「料金未設定」</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    出力単価 (100万トークンあたり)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={outputPrice}
                      onChange={(e) => setOutputPrice(e.target.value)}
                      placeholder="未設定 (空欄)"
                      className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-slate-500">
                      {currency === 'JPY' ? '円' : '$'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">空欄の場合は「料金未設定」</p>
                </div>
              </div>

              {/* Status Display Preview */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">現在の計算設定ステータス:</span>
                <span className="font-bold">
                  {inputPrice.trim() !== '' && outputPrice.trim() !== '' ? (
                    <span className="text-emerald-400">
                      有効 ({currency === 'JPY' ? '¥' : '$'}
                      {inputPrice}/1M入, {currency === 'JPY' ? '¥' : '$'}
                      {outputPrice}/1M出)
                    </span>
                  ) : (
                    <span className="text-amber-400">単価未設定（料金目安は計算されません）</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleUnsetRate}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 cursor-pointer"
              >
                単価をクリアして「料金未設定」にする
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                単価設定を保存
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Call History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>呼び出し単位の実測トークン履歴 (直近{tokenUsageRecords.length}件)</span>
              {onClearUsageRecords && tokenUsageRecords.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('利用量ログをすべてリセットしますか？')) {
                      onClearUsageRecords();
                    }
                  }}
                  className="text-rose-400 hover:underline cursor-pointer"
                >
                  履歴をクリア
                </button>
              )}
            </div>

            {tokenUsageRecords.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                利用履歴はまだ記録されていません。チャットやAIキャラクター作成を行うと自動記録されます。
              </div>
            ) : (
              <div className="space-y-2">
                {tokenUsageRecords.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{r.endpointName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          {r.model}
                        </span>
                        {r.status === 'acquired' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                            取得済
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                            未取得
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(r.timestamp).toLocaleString('ja-JP')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
                      <div className="text-slate-300">
                        {r.status === 'acquired' ? (
                          <>
                            <span className="font-semibold text-indigo-300">
                              合計: {(r.totalTokens ?? 0).toLocaleString()} tokens
                            </span>
                            <span className="text-slate-500 mx-1.5">|</span>
                            <span>入力: {(r.promptTokens ?? 0).toLocaleString()}</span>
                            <span className="text-slate-500 mx-1.5">/</span>
                            <span>出力: {(r.candidatesTokens ?? 0).toLocaleString()}</span>
                          </>
                        ) : (
                          <span className="text-amber-400">使用量メタデータ未取得</span>
                        )}
                      </div>

                      <div className="text-right">
                        {r.estimatedCost !== null && r.estimatedCost !== undefined ? (
                          <span className="font-bold text-emerald-400">
                            目安: {r.rateSnapshot?.currency === 'USD' ? '$' : '¥'}
                            {r.estimatedCost < 0.01
                              ? r.estimatedCost.toFixed(4)
                              : r.estimatedCost.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-500">料金未設定</span>
                        )}
                      </div>
                    </div>

                    {r.rateSnapshot && (
                      <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-1 flex items-center justify-between">
                        <span>
                          呼び出し時単価:{' '}
                          {r.rateSnapshot.inputPricePerMillion !== null
                            ? `${r.rateSnapshot.currency === 'USD' ? '$' : '¥'}${r.rateSnapshot.inputPricePerMillion}/1M入, ${r.rateSnapshot.currency === 'USD' ? '$' : '¥'}${r.rateSnapshot.outputPricePerMillion}/1M出`
                            : '未設定'}
                        </span>
                        <span>
                          単価更新日:{' '}
                          {new Date(r.rateSnapshot.rateUpdatedAt).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
