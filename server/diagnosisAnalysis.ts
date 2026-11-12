/**
 * 診断の「急所」の判定(サーバー用)。
 *
 * HP(hp/src/lib/supabase.ts)と OS(src/components/PublicIntakeForm.tsx)の analyzeBottleneck と
 * 同じ判定・同じ文面を持つ。HP側は import.meta.env を使うためサーバーから読めず、ここに写している。
 * 文面の一致は tests/diagnosisAnalysisParity.test.ts で確認する(typeTitle / summary / firstStep)。
 * AI は急所を決め直さない。この結果を事実として渡し、説明と根拠の引用だけを書かせる。
 */

export interface BottleneckSummary {
  typeTitle: string;
  badge: string;
  summary: string;
  firstStep: string;
}

export function classifyBottleneck(answers: Record<string, unknown>): BottleneckSummary {
  const ops = String(answers?.q_ops_bottleneck ?? '');
  const profit = String(answers?.q_profit_bottleneck ?? '');
  const delay = String(answers?.q_delay_reason ?? '');

  if (ops.includes('請求書') || ops.includes('二重入力') || ops.includes('属人化') || ops.includes('顧客対応') || ops.includes('散乱')) {
    return {
      typeTitle: '経営者の現場拘束 ＆ 事務手作業・属人化タイプ',
      badge: '業務・手作業の急所',
      summary: '売上はあるものの、請求書や見積書の手作業、顧客対応、特定の人への属人化に時間を奪われ、経営者が「次の一手」を打つ時間が取りにくくなっている可能性が高い状態です。',
      firstStep: '最初の候補は、請求・見積・顧客情報など、複数の場所に同じ内容を入力している作業の見直しです。商談で、どの作業から着手するのが良いかを一緒に絞り込みます。',
    };
  }
  if (profit.includes('残りにくい') || profit.includes('分断') || profit.includes('単価') || profit.includes('依存')) {
    return {
      typeTitle: '利益流出 ＆ 集客〜成約導線分断タイプ',
      badge: '売上・利益の急所',
      summary: '集客から商談・フォローまでの一連の流れが分断されているか、単価・コストの見直しが進んでいないため、売上規模に対して手元に残る利益が削られている可能性が高い状態です。',
      firstStep: '最初の候補は、集客から問い合わせ・商談・フォローまでのつながりと、案件ごとの利益の見え方を整理することです。商談で、どこで途切れているかをお伺いします。',
    };
  }
  if (delay.includes('火消し') || delay.includes('優先順位') || delay.includes('定着') || delay.includes('右腕')) {
    return {
      typeTitle: '改善後回し ＆ 優先順位停滞タイプ',
      badge: '改善実行の急所',
      summary: '「改善したい」と思いながらも日々の現場対応や火消しに追われ、どこから手を付ければ一番効果が出るのか優先順位が決まらず、改善が後回しになっている状態です。',
      firstStep: '最初の候補は、改善テーマを1つに絞り、小さく着手して定着させることです。商談で、いま一番優先したいテーマをお伺いします。',
    };
  }
  return {
    typeTitle: '経営の仕組み化 ＆ 次の一手着手タイプ',
    badge: '事業成長ステージ',
    summary: '現状の事業基盤を活かしながら、経営者が現場作業から完全に離れ、新規事業や新収益源の創出・自走組織づくりへとシフトするタイミングです。',
    firstStep: '最初の候補は、経営者の方に集まっている判断や作業を洗い出し、任せられる形に整えることです。商談で、次に力を入れたい方向をお伺いします。',
  };
}
