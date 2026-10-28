import React, { useState } from 'react';
import { submitLead } from '../lib/supabase';

interface Question {
  id: number;
  category: string;
  title: string;
  description: string;
  options: { label: string; score: number; comment: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    category: '経営者の時間',
    title: '経営者ご自身の時間の使い方はどのような状態ですか？',
    description: '日々の実務やトラブル対応に追われ、戦略や新規事業を考える時間が取れていますか？',
    options: [
      { label: '現場実務や雑務に追われ、経営の仕組みを考える時間がほぼ無い', score: 1, comment: 'トップの属人化が深刻で、成長の天井が生じています。' },
      { label: '実務の合間に何とか経営課題に向き合っているが後手に回りがち', score: 2, comment: '権限移譲と業務の切り出しが最優先課題です。' },
      { label: '定常業務は一部任せられているが、判断やチェックに時間を取られる', score: 3, comment: 'ルール化と可視化を進めることで経営時間を倍増できます。' },
      { label: '実務はスタッフ・仕組みで回り、経営戦略や投資に集中できている', score: 4, comment: '仕組み化が進んでいます。次の成長ステージへ進む段階です。' },
    ],
  },
  {
    id: 2,
    category: '利益と収益構造',
    title: '会社の売上と「手元に残る利益（キャッシュ）」のバランスは？',
    description: '忙しく動いている割に、利益率や手元資金の蓄積に納得できていますか？',
    options: [
      { label: '売上はあるが原価や販管費が嵩み、月末・決算期に残る利益が薄い', score: 1, comment: '利益構造の見直しと案件別採算管理の導入が急務です。' },
      { label: '黒字ではあるが、価格競争やコスト増で利益率が年々低下している', score: 2, comment: '高付加価値化と不採算業務のスクラップが必要です。' },
      { label: '一定の利益は出ているが、より利益率の高い新規事業・サービスを育てたい', score: 3, comment: '収益モデルの多角化・パッケージ化が有効です。' },
      { label: '高い営業利益率を維持し、次期投資に向けた原資が蓄積されている', score: 4, comment: '非常に健全な収益構造です。' },
    ],
  },
  {
    id: 3,
    category: '業務属人化・仕組み化',
    title: '業務の属人化やマニュアル・共有の状況はいかがですか？',
    description: '特定の人しか分からないブラックボックス業務や、急な欠勤での混乱はありませんか？',
    options: [
      { label: '「あの人がいないと分からない」業務だらけで、常に誰かに依存している', score: 1, comment: '業務のブラックボックス化により事業継続リスクが高い状態です。' },
      { label: '口頭伝承が多く、新人育成に膨大な時間がかかっている', score: 2, comment: '業務プロセスの可視化と標準マニュアル化が効果的です。' },
      { label: 'マニュアルはあるが形骸化しており、実際の運用に乖離がある', score: 3, comment: 'システムによる業務の「強制フロー化」が有効です。' },
      { label: 'フローが標準化され、誰が対応しても一定の品質で完了する', score: 4, comment: '属人化が解消された理想的な体制です。' },
    ],
  },
  {
    id: 4,
    category: '集客・マーケティング',
    title: '見込み客の集客や問い合わせ獲得の導線は安定していますか？',
    description: '紹介や既存顧客のリピートだけに頼らず、自前で案件を生み出せていますか？',
    options: [
      { label: '紹介や人脈頼みで、来月・3ヶ月後の集客が読めず不安がある', score: 1, comment: '顧客獲得の自前エンジン（Web・LINE導線）の構築が急務です。' },
      { label: 'HPやSNSはあるが、実際の問い合わせや売上にほとんど繋がっていない', score: 2, comment: '訴求メッセージとターゲット選定の再設計が必要です。' },
      { label: 'ある程度流入はあるが、商談化率や成約率にムラがある', score: 3, comment: '見込み客のナーチャリング（育成）と事前選別が必要です。' },
      { label: 'Web・LINE経由で毎月安定した見込み客が獲得できている', score: 4, comment: 'マーケティング導線がしっかりと機能しています。' },
    ],
  },
  {
    id: 5,
    category: 'IT・DX・システム化',
    title: '社内業務のIT化や自動化（GAS・クラウド・AI）の活用状況は？',
    description: '紙の帳票や手動コピー＆ペースト、二重入力などの無駄な作業は残っていませんか？',
    options: [
      { label: '紙やExcelが散乱し、同じデータを何度も手入力・転記している', score: 1, comment: '年間数百時間のムダ工数が発生している可能性大です。' },
      { label: '色々ツールを試したが使いこなせず、結局手作業に戻ってしまった', score: 2, comment: '無理なパッケージ導入ではなく身の丈に合った自動化が必要です。' },
      { label: 'クラウドツールは使っているが、ツール同士が連携せず手動処理が多い', score: 3, comment: 'API連携やGAS自動化で業務を劇的にスリム化できます。' },
      { label: 'クラウドと自動化システム、AIが連携し、ミスなく高速に業務が回っている', score: 4, comment: '先端的な業務基盤が構築されています。' },
    ],
  },
];

export default function DiagnosisForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);

  // リード収集フォーム
  const [lead, setLead] = useState({
    company: '',
    name: '',
    email: '',
    phone: '',
  });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSelectOption = (score: number) => {
    const nextAnswers = [...answers, score];
    setAnswers(nextAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResult(true);
    }
  };

  const totalScore = answers.reduce((a, b) => a + b, 0);
  const maxScore = QUESTIONS.length * 4;
  const scorePercentage = Math.round((totalScore / maxScore) * 100);

  let diagnosisGrade = 'D';
  let diagnosisTitle = '重度の属人化・仕組み不全（最優先改善ステージ）';
  let diagnosisSummary = '経営者様の時間が現場実務に奪われ、利益構造や業務フローが属人化に依存しています。まずは「社長の業務の棚卸し」と「利益率改善」「反復業務の自動化」から手をつけることで、短期間で大きな改善効果が見込めます。';

  if (totalScore >= 17) {
    diagnosisGrade = 'A';
    diagnosisTitle = '高効率・仕組み化先進ステージ';
    diagnosisSummary = '業務の標準化とIT活用が高度に進んでいます。今後はさらなる利益率の向上、AI経営OS等の先端ツール導入、または新規事業展開への仕組み転用が推奨されます。';
  } else if (totalScore >= 13) {
    diagnosisGrade = 'B';
    diagnosisTitle = '改善推進ステージ（部分最適化状態）';
    diagnosisSummary = '基本的な土台は整いつつありますが、部門間の連携やITツールの自動連携、経営者判断の権限移譲においてボトルネックが残っています。業務の自動化と集客導線の強化で更なる飛躍が可能です。';
  } else if (totalScore >= 9) {
    diagnosisGrade = 'C';
    diagnosisTitle = '属人化過渡期ステージ（要仕組み化）';
    diagnosisSummary = '売上規模に対して現場の業務負担が限界に達しつつあります。このまま人を増やしても教育コストとミスが増加するため、業務フローの標準化と管理ツールの導入が最優先です。';
  }

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitLead({
        company_name: lead.company,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        inquiry_type: 'diagnosis',
        notes: `【3分無料診断結果】\nスコア: ${totalScore}/${maxScore} (${scorePercentage}%)\n判定: ${diagnosisGrade}ランク「${diagnosisTitle}」\n回答詳細: ${answers.join(', ')}`,
        custom_fields: {
          score: totalScore,
          grade: diagnosisGrade,
          answers,
        },
      });
      setLeadSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-sand-300 shadow-xl overflow-hidden">
      {/* 上部ヘッダー進捗バー */}
      <div className="bg-forest-900 text-white p-6 sm:p-8">
        <div className="flex items-center justify-between text-xs font-semibold text-gold-400 mb-2">
          <span>MST 経営ボトルネック無料診断</span>
          <span>
            {showResult ? '診断完了' : `質問 ${currentStep + 1} / ${QUESTIONS.length}`}
          </span>
        </div>
        <div className="w-full bg-forest-950 rounded-full h-2">
          <div
            className="bg-gold-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: showResult
                ? '100%'
                : `${((currentStep + 1) / QUESTIONS.length) * 100}%`,
            }}
          ></div>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        {!showResult ? (
          <div>
            <div className="mb-6">
              <span className="text-xs font-bold text-forest-700 bg-forest-50 px-3 py-1 rounded-full border border-forest-200">
                {QUESTIONS[currentStep].category}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-serif text-forest-900 mt-3 leading-snug">
                {QUESTIONS[currentStep].title}
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                {QUESTIONS[currentStep].description}
              </p>
            </div>

            <div className="space-y-3">
              {QUESTIONS[currentStep].options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(opt.score)}
                  className="w-full text-left p-4 sm:p-5 rounded-xl border border-sand-300 hover:border-gold-500 hover:bg-gold-50/30 transition-all duration-150 group flex items-start justify-between gap-4"
                >
                  <span className="text-sm sm:text-base font-medium text-gray-800 group-hover:text-forest-900">
                    {opt.label}
                  </span>
                  <span className="w-6 h-6 rounded-full border border-sand-400 group-hover:border-gold-600 group-hover:bg-gold-500 flex items-center justify-center shrink-0 mt-0.5">
                    <svg
                      className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            {currentStep > 0 && (
              <div className="mt-6 pt-4 border-t border-sand-200">
                <button
                  onClick={() => {
                    setCurrentStep(currentStep - 1);
                    setAnswers(answers.slice(0, -1));
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-forest-900 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  前の質問に戻る
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* 結果サマリー */}
            <div className="text-center pb-6 border-b border-sand-200">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold bg-gold-100 text-gold-800 mb-3">
                仕組み化スコア: {scorePercentage}点 / 100点
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold font-serif text-forest-900">
                判定：ランク【{diagnosisGrade}】
              </h3>
              <p className="text-lg font-semibold text-gold-700 mt-1">
                {diagnosisTitle}
              </p>
              <p className="text-sm text-gray-600 mt-4 leading-relaxed max-w-xl mx-auto text-left sm:text-center">
                {diagnosisSummary}
              </p>
            </div>

            {/* 各カテゴリの分析 */}
            <div>
              <h4 className="text-sm font-bold text-forest-900 uppercase tracking-wider mb-3">
                カテゴリ別チェック結果
              </h4>
              <div className="space-y-3">
                {QUESTIONS.map((q, idx) => {
                  const score = answers[idx] || 1;
                  const opt = q.options.find((o) => o.score === score);
                  return (
                    <div key={q.id} className="p-4 bg-sand-50 rounded-xl border border-sand-200">
                      <div className="flex items-center justify-between text-xs font-bold mb-1">
                        <span className="text-forest-900">{q.category}</span>
                        <span
                          className={`px-2 py-0.5 rounded ${
                            score >= 3
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {score >= 3 ? '良好' : '要改善ボトルネック'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{opt?.comment}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 詳細カルテの送付 / 個別相談申し込み */}
            {!leadSubmitted ? (
              <form onSubmit={handleLeadSubmit} className="bg-forest-50 p-6 sm:p-8 rounded-2xl border border-forest-100 space-y-4">
                <div className="text-center">
                  <h4 className="text-lg font-bold font-serif text-forest-900">
                    詳細な「改善優先度カルテ」をメールでお受け取りいただけます
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    代表・大橋による具体的な改善ステップの助言付き個別カルテをお届けします（無料）
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <input
                    type="text"
                    required
                    placeholder="貴社名"
                    value={lead.company}
                    onChange={(e) => setLead({ ...lead, company: e.target.value })}
                    className="px-3.5 py-2.5 text-sm bg-white border border-sand-300 rounded-lg outline-none focus:ring-2 focus:ring-forest-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="お名前"
                    value={lead.name}
                    onChange={(e) => setLead({ ...lead, name: e.target.value })}
                    className="px-3.5 py-2.5 text-sm bg-white border border-sand-300 rounded-lg outline-none focus:ring-2 focus:ring-forest-500"
                  />
                  <input
                    type="email"
                    required
                    placeholder="メールアドレス"
                    value={lead.email}
                    onChange={(e) => setLead({ ...lead, email: e.target.value })}
                    className="px-3.5 py-2.5 text-sm bg-white border border-sand-300 rounded-lg outline-none focus:ring-2 focus:ring-forest-500"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="お電話番号"
                    value={lead.phone}
                    onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                    className="px-3.5 py-2.5 text-sm bg-white border border-sand-300 rounded-lg outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-forest-900 hover:bg-forest-800 text-gold-300 font-bold rounded-xl text-sm transition shadow flex items-center justify-center gap-2"
                >
                  {submitting ? '送信中...' : '診断カルテを受け取る ＆ 初回相談を希望する'}
                </button>
              </form>
            ) : (
              <div className="p-6 bg-forest-100 rounded-2xl text-center space-y-3 border border-forest-200">
                <div className="w-10 h-10 bg-forest-700 text-white rounded-full flex items-center justify-center mx-auto">
                  ✓
                </div>
                <h4 className="text-base font-bold text-forest-900">
                  診断カルテの送付申し込みを完了しました
                </h4>
                <p className="text-xs text-gray-600">
                  ご入力いただいたメールアドレス宛に、改善カルテと次の具体的な改善ステップをお送りいたします。
                </p>
                <div className="pt-2">
                  <a
                    href="https://lin.ee/4Vl9v91"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#06C755] text-white text-xs font-bold rounded-lg"
                  >
                    公式LINEで結果について代表に直接相談する
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
