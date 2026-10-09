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
    key: 'strategy',
    name: '1. 経営戦略・ビジョン',
    description: '経営陣のAI・DX推進方針と投資・意思決定体制',
    questions: [
      {
        id: 'q_strat_vision',
        category: 'strategy',
        label: '全社的なAI・DXビジョン・方針の策定',
        description: '経営戦略としてAI導入やデジタル変革の明確な目標や方針が定められているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_strat_investment',
        category: 'strategy',
        label: 'IT・AI推進への投資意欲・予算確保',
        description: '業務効率化や新規事業のためのIT・AI投資予算が確保されているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_strat_leadership',
        category: 'strategy',
        label: '経営陣・推進リーダーのコミットメント',
        description: '経営陣自らが推進を後押しし、組織横断でプロジェクトが進む体制があるか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'data_infra',
    name: '2. データ・システム基盤',
    description: '顧客情報・営業データ・業務システムのデジタル化状況',
    questions: [
      {
        id: 'q_data_crm',
        category: 'data_infra',
        label: '顧客・商談データの一元管理（CRM/SFA）',
        description: 'Excelや紙ではなく、クラウド上で顧客情報や商談履歴が集約管理されているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_data_cloud',
        category: 'data_infra',
        label: 'クラウドツール・SaaSの活用度',
        description: '日常業務でクラウドツール（Google Workspace, Slack, クラウドストレージ等）が定着しているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_data_security',
        category: 'data_infra',
        label: '情報セキュリティ・アクセス権限管理',
        description: '機密情報や個人情報の保護ルール、アカウント・アクセス権限制御が整備されているか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'operation',
    name: '3. 業務プロセス・自動化',
    description: '定型業務の自動化余地と業務フローの標準化',
    questions: [
      {
        id: 'q_ops_standardization',
        category: 'operation',
        label: '業務マニュアル・標準化の整備状況',
        description: '属人化せず、業務フローが明文化・標準化されているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_ops_automation',
        category: 'operation',
        label: 'ルーティン・定型反復業務の自動化',
        description: '帳票作成、転記、リマインドメール等の定型作業で自動化ツールやAIが活用されているか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'literacy',
    name: '4. 組織・AIリテラシー',
    description: '従業員のITスキルと生成AIツールへの関心・習熟度',
    questions: [
      {
        id: 'q_lit_mindset',
        category: 'literacy',
        label: '社員の新しいツールへの受容性・学習意欲',
        description: '新しいITツールやAIの導入に対して現場の協力やポジティブな受容性があるか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_lit_ai_usage',
        category: 'literacy',
        label: 'ChatGPT等 生成AIツールの日常利用頻度',
        description: '業務の文章作成や情報収集などで日常的に生成AIを活用しているメンバーがいるか',
        type: 'rating_5',
        weight: 1.0,
      },
    ],
  },
  {
    key: 'sales_marketing',
    name: '5. 営業・マーケティング活用',
    description: 'リード獲得から商談成約、顧客フォローにおけるAI活用',
    questions: [
      {
        id: 'q_sales_followup',
        category: 'sales_marketing',
        label: '見込み客・商談フォローの即時性と継続性',
        description: '問い合わせやリード獲得後の初回接触や追客がタイムリーに行われているか',
        type: 'rating_5',
        weight: 1.0,
      },
      {
        id: 'q_sales_analytics',
        category: 'sales_marketing',
        label: '成約・失注要因のデータ分析と改善サイクル',
        description: '過去の営業結果をもとに要因分析や次回提案の改善が行われているか',
        type: 'rating_5',
        weight: 1.0,
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
          // 5段階を100点換算: 1=20, 2=40, 3=60, 4=80, 5=100
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
