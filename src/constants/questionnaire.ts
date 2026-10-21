export interface QuestionItem {
  id: string;
  category: string;
  label: string;
  description: string;
  type: 'rating_5' | 'select' | 'text';
  options?: { value: string; label: string }[];
  weight: number;
}

export interface QuestionCategory {
  key: string;
  name: string;
  description: string;
  questions: QuestionItem[];
}

export const QUESTIONNAIRE_V1: QuestionCategory[] = [
  {
    key: 'profit_sales',
    name: '1. 売上・利益・集客のボトルネック',
    description: '売上はあるのに利益が残らない、集客〜商談〜フォローの詰まり',
    questions: [
      {
        id: 'q_profit_margin',
        category: 'profit_sales',
        label: '売上と利益構造（利益が残る体質か）',
        description: '売上に見合った利益が手元に残っているか、コストや時間の使い方が最適化されているか',
        type: 'rating_5',
        weight: 1.2,
      },
      {
        id: 'q_sales_pipeline',
        category: 'profit_sales',
        label: '集客〜商談〜追客の仕組み化',
        description: '集客が点で終わらず、問い合わせから商談・成約・フォローまで一連の流れがつながっているか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'operations',
    name: '2. 業務・手作業・属人化のボトルネック',
    description: '手作業・二重入力の負担や、特定の人への業務集中',
    questions: [
      {
        id: 'q_ops_manual_work',
        category: 'operations',
        label: '請求・見積・事務作業の二重入力・手作業削減',
        description: '毎月の請求処理やツール間の重複入力、転記作業などの手作業が削減されているか',
        type: 'rating_5',
        weight: 1.2,
      },
      {
        id: 'q_ops_dependency',
        category: 'operations',
        label: '属人化の解消（限られた人員で回る仕組み）',
        description: '経営者や特定の人に仕事が集中せず、情報共有や引き継ぎがスムーズに回る体制があるか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'management_time',
    name: '3. 経営者の時間と改善の実行力',
    description: '改善を考える時間の確保と、優先順位を決めた実行・定着',
    questions: [
      {
        id: 'q_mgmt_time',
        category: 'management_time',
        label: '経営者の時間の確保（現場作業からの解放）',
        description: '日々の業務や火消しに追われず、経営判断・戦略・次の一手に向き合う時間が取れているか',
        type: 'rating_5',
        weight: 1.2,
      },
      {
        id: 'q_mgmt_execution',
        category: 'management_time',
        label: '改善の継続性（優先順位づけと定着）',
        description: '部分的なツール導入で終わらず、優先順位を決めて現場で使える形に改善が定着しているか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'systems_ai',
    name: '4. システム・AI・自動化の活用余地',
    description: '業務に合わせた仕組みの構築とIT・AIの活用',
    questions: [
      {
        id: 'q_system_automation',
        category: 'systems_ai',
        label: 'ツール連携と定型業務の自動化（GAS・スプレッドシート等）',
        description: '既製品に無理に合わせず、自社の業務に合った形で自動化やツール連携が活用されているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_future_clarity',
        category: 'systems_ai',
        label: '次の一手・新規事業への展開力',
        description: '本業を仕組み化し、新たな収益源の創出や新規事業に挑戦できる状態にあるか',
        type: 'rating_5',
        weight: 0.8,
      },
    ],
  },
];

// 回答からカテゴリ別スコアおよび総合スコア（0〜100点）を簡易算出するヘルパー
export function calculateScores(answers: Record<string, unknown>): {
  totalScore: number;
  categoryScores: Record<string, number>;
  answeredCount: number;
  totalQuestions: number;
} {
  let totalScoreSum = 0;
  let totalWeight = 0;
  let answeredCount = 0;
  let totalQuestions = 0;
  const categoryScores: Record<string, number> = {};

  for (const cat of QUESTIONNAIRE_V1) {
    let catScoreSum = 0;
    let catWeight = 0;

    for (const q of cat.questions) {
      totalQuestions += 1;
      const rawVal = answers[q.id];
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        answeredCount += 1;
        const numVal = Number(rawVal);
        if (!isNaN(numVal) && numVal >= 1 && numVal <= 5) {
          // 5段階を100点換算: 1=20点, 2=40点, 3=60点, 4=80点, 5=100点
          const point = numVal * 20;
          catScoreSum += point * q.weight;
          catWeight += q.weight;
          totalScoreSum += point * q.weight;
          totalWeight += q.weight;
        }
      }
    }

    categoryScores[cat.key] = catWeight > 0 ? Math.round(catScoreSum / catWeight) : 0;
  }

  const totalScore = totalWeight > 0 ? Math.round(totalScoreSum / totalWeight) : 0;

  return {
    totalScore,
    categoryScores,
    answeredCount,
    totalQuestions,
  };
}
