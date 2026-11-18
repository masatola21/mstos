import type { MarketingScenario, MarketingTrigger } from '../types/marketing';

/**
 * 面談実施後〜提案フェーズの自動フォロー対象トリガー。
 * これらは「予約済み」や「リードステータス=商談化」の段階では止まらず、
 * 「成約・受注・失注・返信」になった時だけ自動停止する。
 */
export const POST_MEETING_TRIGGERS: readonly MarketingTrigger[] = [
  'meeting_completed',
  'report_approved',
  'report_sent',
  'proposal_approved',
  'proposal_sent',
] as const;

export function isPostDealStageTrigger(trigger: string): boolean {
  return (POST_MEETING_TRIGGERS as readonly string[]).includes(String(trigger || '').trim());
}

const CLOSED_DEAL_STATUSES = ['成約', '受注', 'won', 'closed_won', '失注', '見送り', 'lost'];
const PRE_MEETING_STOP_LEAD_STATUSES = ['商談化', '成約', '受注'];
const POST_MEETING_STOP_LEAD_STATUSES = ['成約', '受注', '失注', '見送り'];

/**
 * stopOnDeal が有効なシナリオを停止すべきかを判定する。
 * - 資料請求後・診断後・営業メール等の「商談前」フォロー: 商談化/成約/受注で停止
 * - 面談後・レポート送付後・提案書送付後の「商談後」フォロー: 成約/受注/失注/見送りでのみ停止（「商談化」では止めない）
 */
export function shouldStopScenarioForDeal(params: {
  trigger: string;
  dealProposalStatus?: string | null;
  leadStatus?: string | null;
}): { stop: boolean; reason: string } {
  const dealStatus = String(params.dealProposalStatus || '').trim();
  const leadStatus = String(params.leadStatus || '').trim();
  const isPostMeeting = isPostDealStageTrigger(params.trigger);

  if (dealStatus && CLOSED_DEAL_STATUSES.includes(dealStatus)) {
    return {
      stop: true,
      reason: `成約・終了済みのため停止（商談ステータス: ${dealStatus}）`,
    };
  }

  const targetLeadStatuses = isPostMeeting ? POST_MEETING_STOP_LEAD_STATUSES : PRE_MEETING_STOP_LEAD_STATUSES;
  if (leadStatus && targetLeadStatuses.includes(leadStatus)) {
    return {
      stop: true,
      reason: `${isPostMeeting ? '成約・終了' : '商談化'}のため停止（リードステータス: ${leadStatus}）`,
    };
  }

  return { stop: false, reason: '' };
}

// ---------------------------------------------------------------------------
// 1. 分岐A: 3分無料経営診断 フォロー（LINE + メール両対応）
// ---------------------------------------------------------------------------
export const MST_DIAGNOSIS_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【A1・未回答教育】1日後：まだお済みでない方へ（その場で簡易診断結果が出ます）',
    trigger: 'tag_added',
    targetTag: '選択:診断',
    channel: 'line',
    audience: '「選択:診断」タグ（HP診断未送信者のみ）',
    waitMinutes: 1440,
    emailSubject: '',
    emailBody: '',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n昨日は無料経営診断をお選びいただきありがとうございました！\n多くの企業様で課題となる「人手不足・利益が残らない悩み」は、実は人ではなく【業務の配管（仕組み）の詰まり】が原因であることがほとんどです。\n\nホームページの選択式チェック（約3分）にご回答いただくと、送信直後にその場で【簡易診断結果（ボトルネック傾向・最初の一手）】をご確認いただけますので、お時間のある際にぜひお試しください。',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【3分無料診断】回答直後に簡易診断結果をご確認いただけます',
    flexTitle: '📊 3分で「簡易診断結果」を即時表示',
    flexBody:
      '{recipient_name} 様\n業務や利益のボトルネック傾向が約3分で分かり、回答直後にホームページ上で【簡易診断結果】をご確認いただけます（無料）。',
    flexButtonLabel: '3分簡易診断を始める',
    flexButtonUrl: '{link_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: 'LINE診断ルート選択時の配信同意に基づく',
  },
  {
    name: '【A2・簡易結果の解説】1日後：簡易診断結果の見方と最初の急所',
    trigger: 'diagnosis_completed',
    channel: 'both',
    audience: 'HP診断送信済み・商談未予約者（LINE+メール両対応）',
    waitMinutes: 1440,
    emailSubject: '【MST】先日の無料経営診断：結果の見方と「最初に着手すべき急所」について',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n先日は「3分無料経営診断」にご回答いただき誠にありがとうございました。\n画面上に表示された【簡易診断結果】はご覧いただけましたでしょうか。\n\n簡易診断では「いま御社の業務・利益のどこに詰まりが出やすいか」の傾向を整理しています。\nもし結果をご覧になって「自社の場合は具体的にどこから手を付けるのが一番効果的か」が気になられましたら、30分の無料オンライン商談をご活用ください。\n\nなお、より踏み込んだ【詳細診断レポート】および【改善提案書】は、机上の空論を避けるため、30分商談で直接状況をお伺いした方限定で商談後に作成・進呈しております。\n\n▼ 30分無料オンライン商談の日程を選ぶ\n{booking_url}\n\n本メールへのご返信でもご相談を承っております。どうぞお気軽にご連絡ください。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n先日は「3分無料経営診断」へのご回答ありがとうございました！ホームページ上に表示された【簡易診断結果】はご覧いただけましたでしょうか？\n\n簡易診断では「いまどこに詰まりが出やすいか」の傾向を整理しています。\nなお、御社の実情に合わせた【詳細な診断レポート・改善提案書】は、直接お話を伺った上で「30分のオンライン商談を実施された方限定」で商談後に作成・お渡ししております。\n\n▼ 無料オンライン商談（30分）の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【簡易診断結果の解説】最初の改善候補と詳細レポートのご案内',
    flexTitle: '🔎 簡易診断結果の活かし方',
    flexBody:
      '{recipient_name} 様\nHP上の簡易診断結果で把握した傾向をもとに、どこから着手すべきかを30分の無料商談で一緒に整理しませんか？（詳細な診断レポート・提案書は商談後に作成・進呈しております）',
    flexButtonLabel: '30分商談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【A3・事例教育×商談案内】3日後：仕組み化事例 ＆ 詳細レポート付き商談',
    trigger: 'diagnosis_completed',
    channel: 'both',
    audience: 'HP診断送信済み・商談未予約者（LINE+メール両対応）',
    waitMinutes: 4320,
    emailSubject: '【MST改善事例】簡易診断から小さく始めて「利益が残る仕組み」を整えた事例',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n先日の経営診断に続き、同規模の企業様がどのように改善を進められているか事例を1つ共有いたします。\n\n多くの企業様では、最初から大きなシステムを入れるのではなく、\n・見積・請求・顧客情報の二重入力の整理\n・問い合わせ〜商談予約までの自動導線化\nなど「一番効果が出やすい1点」から小さく着手することで、現場に負担をかけずに利益が残る体制を整えられています。\n\n30分のオンライン商談では、先日の簡易診断結果をベースに「御社が最初に直すならここ」を一緒に絞り込み、商談後に御社専用の【詳細診断レポート・改善提案書】をお渡ししております。\n\n▼ 30分オンライン商談（改善作戦会議）の日程を選ぶ\n{booking_url}\n\n情報収集の一環としてもお気軽にご活用ください。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n先日の簡易診断に続き、同規模の企業様が「請求・見積・顧客情報の二重入力の解消」や「集客〜商談の導線接続」から小さく着手し、手元に利益が残る体制を整えた改善事例をご案内しております。\n\n30分のオンライン商談では、簡易診断の結果をベースに「御社が最初に直すべき1点」を絞り込み、商談後に御社専用の【詳細診断レポート・改善提案書】を進呈しております。\n\n▼ 個別商談の日程を選ぶ\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【改善事例】簡易診断から仕組み化に着手した事例＆詳細レポートのご案内',
    flexTitle: '💡 仕組み化の事例 ＆ 個別商談',
    flexBody:
      '{recipient_name} 様\n簡易診断で見えたボトルネックを現場に負担なく解消した他社事例をご紹介。商談を実施された方限定で、商談後に「詳細診断レポート＆改善提案書」をお渡ししています。',
    flexButtonLabel: '詳細レポート付き商談を予約',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
  {
    name: '【A4・最終商談案内】7日後：簡易診断後1週間・30分無料個別相談のご案内',
    trigger: 'diagnosis_completed',
    channel: 'both',
    audience: 'HP診断送信済み・商談未予約者（LINE+メール両対応）',
    waitMinutes: 10080,
    emailSubject: '【MST】無料診断から1週間：30分オンライン作戦会議のご案内',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n無料経営診断にご回答いただいてから1週間が経ちました。\n「診断結果を見て気になっているが、日々の業務に追われてなかなか進められていない」というご相談もよくいただきます。\n\nもしよろしければ、30分の無料オンライン商談にて現状の優先順位を一緒に整理させてください。整理した内容をもとに、商談後には御社専用の【詳細診断レポート・改善提案書】をお送りいたします。\n\n▼ 相談枠の確認・ご予約はこちら\n{booking_url}\n\n※なお、ご希望がございましたら本メールへの一言ご返信でも結構です。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n簡易診断をご回答いただいてから1週間が経ちました。もし「結果を見て気になっているが、日々の対応に追われて進められていない」という場合は、30分の無料オンライン相談をご活用ください。\n\n現状の優先順位を整理した上で、商談後に御社専用の【詳細診断レポート・改善提案書】をお届けいたします。\n\n▼ 相談枠の確認・ご予約はこちら\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【最終案内】簡易診断後の30分無料個別相談（詳細レポート進呈）',
    flexTitle: '🗓️ 30分無料・個別作戦会議のご案内',
    flexBody:
      '{recipient_name} 様\n簡易診断から1週間が経過しました。まずは30分のオンライン商談で改善の優先順位を整理しませんか？（詳細診断レポート・提案書は商談実施後に進呈）',
    flexButtonLabel: '今月の相談枠を確認する',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '診断フォーム回答時の同意に基づく',
  },
];

// ---------------------------------------------------------------------------
// 2. 資料請求後の自動追客ステップ（1日後・3日後・7日後）
// ---------------------------------------------------------------------------
export const MST_MATERIAL_FOLLOWUP_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【資料請求①】1日後：資料をご覧いただけましたか？（ポイント解説）',
    trigger: 'material_requested',
    channel: 'both',
    audience: '資料請求者（LINE・メール両対応／返信・予約で停止）',
    waitMinutes: 1440,
    emailSubject: '【MST】先日は資料をご請求いただきありがとうございました（読みどころのご案内）',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n昨日は弊社資料をご請求いただき、誠にありがとうございました。\n\n資料は無事お手元でご覧いただけましたでしょうか。\nお忙しい中かと思いますので、特に経営者様から「参考になった」とよくいただくポイントを1点だけお伝えします。\n\nそれは「現場の属人化や利益の漏れを直すときは、ツールを足す前に“いま詰まっている1箇所の業務フロー”を見極めるだけで大きく変わる」という点です。\n\nもし「自社だとどこが詰まっているか、まずは手軽に確認してみたい」という場合は、3分で結果が分かる無料経営診断もご活用いただけます。\n\n▼ 3分無料経営診断はこちら\n{link_url}\n\n▼ 個別のご相談・30分オンライン相談はこちら\n{booking_url}\n\n資料内容についてご質問がございましたら、このままご返信いただければすぐにお答えいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n昨日は資料をご請求いただきありがとうございました！無事ご覧いただけましたでしょうか？\n\n「自社の場合はどこから改善するのが一番効果的か整理したい」という場合は、約3分で簡易診断結果が出る無料診断や、30分の個別オンライン相談もお気軽にご活用ください。\n\n▼ 3分無料経営診断はこちら\n{link_url}\n\n※資料に関するご質問も、このままLINEにご返信ください！',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【資料請求フォロー】資料はご覧いただけましたか？（無料診断・相談案内）',
    flexTitle: '📘 資料のご確認ありがとうございます',
    flexBody:
      '{recipient_name} 様\n先日の資料はご覧いただけましたでしょうか？「自社ならどこから改善できるか」を手軽に把握できる3分無料診断もご用意しています。',
    flexButtonLabel: '3分無料診断を試す',
    flexButtonUrl: '{link_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '資料請求フォーム送信時の同意に基づく',
  },
  {
    name: '【資料請求②】3日後：同規模企業様の改善事例 ＆ 30分無料相談のご案内',
    trigger: 'material_requested',
    channel: 'both',
    audience: '資料請求者（商談未予約者／返信・予約で停止）',
    waitMinutes: 4320,
    emailSubject: '【MST改善事例】資料の活用例と「30分無料・個別作戦会議」のご案内',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n先日の資料に続けて、実際に仕組み化に取り組まれた企業様の変化を1つご紹介いたします。\n\n「日々の見積・請求・顧客管理に追われて本来やりたい事業に時間が割けない」とお悩みだった企業様でも、業務の流れを棚卸しして不要な二重作業を整理したことで、社長や現場の負担を大きく減らすことができました。\n\n資料の内容を「自社に当てはめるとどうなるか」を30分の無料オンライン相談で一緒に整理することも可能ですので、ご都合のよろしいタイミングでご活用ください。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n{booking_url}\n\nもちろん売り込みなどは一切いたしませんので、現状の壁打ちとしてお気軽にお使いください。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n資料でお伝えしている仕組み化について、「自社に当てはめるとどこから取り組むのが良いか」を30分の無料オンライン相談で一緒に整理することも可能です。\n\n▼ 30分無料オンライン相談の日程を選ぶ\n{booking_url}\n\nまだ具体的な検討段階でない場合も、壁打ちとしてお気軽にご活用ください。',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【資料活用】自社に当てはめて整理できる30分無料オンライン相談のご案内',
    flexTitle: '💡 30分無料・改善作戦会議のご案内',
    flexBody:
      '{recipient_name} 様\n資料の内容を「御社ならどこから着手すべきか」に落とし込む30分の無料オンライン相談をご案内しております。',
    flexButtonLabel: '30分相談の日程を選ぶ',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '資料請求フォーム送信時の同意に基づく',
  },
  {
    name: '【資料請求③】7日後：もしお困りの点があれば一言ご返信ください',
    trigger: 'material_requested',
    channel: 'both',
    audience: '資料請求者（最終フォロー／返信・予約で停止）',
    waitMinutes: 10080,
    emailSubject: '【MST】資料請求から1週間：お困りごとやご相談はございませんか？',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n\n資料をご請求いただいてから1週間が経過いたしました。\nその後、社内でのお取り組みやご検討状況はいかがでしょうか。\n\nもし「資料を読んで気になる点があった」「具体的な事例や費用感について少し聞いてみたい」ということがございましたら、本メールへ一言ご返信いただくか、下記より個別相談をご利用ください。\n\n▼ 30分無料オンライン相談のご予約\n{booking_url}\n\nまたお役に立てることがございましたら、いつでもお声がけください。今後ともよろしくお願いいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n資料をご請求いただいてから1週間が経ちました。資料の内容や今後の進め方について気になる点がございましたら、いつでも一言LINEでお送りください。\n\n▼ 30分無料オンライン相談のご予約はこちら\n{booking_url}',
    lineMessageType: 'flex',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '【資料請求1週間フォロー】ご不明点・個別相談のご案内',
    flexTitle: '📅 資料に関するご質問・個別相談',
    flexBody:
      '{recipient_name} 様\n資料請求から1週間が経過しました。気になる点のご質問や個別相談のご希望があれば、いつでもお気軽にご連絡ください。',
    flexButtonLabel: '相談枠を確認する',
    flexButtonUrl: '{booking_url}',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: true,
    stopOnDeal: true,
    consentBasis: '資料請求フォーム送信時の同意に基づく',
  },
];

// ---------------------------------------------------------------------------
// 3. 面談後・レポート・提案書送付後の自動フォロー（stopOnBooking: false / stopOnDeal: true）
// ---------------------------------------------------------------------------
export const MST_POST_MEETING_STARTER_SCENARIOS: Omit<MarketingScenario, 'id' | 'updatedAt'>[] = [
  {
    name: '【面談後①】2時間後：本日はお時間をいただきありがとうございました（お礼＆次回案内）',
    trigger: 'meeting_completed',
    channel: 'both',
    audience: '個別面談を完了したお客様（返信・成約で自動停止）',
    waitMinutes: 120,
    emailSubject: '本日は貴重なお時間をいただきありがとうございました｜有限会社MST',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n本日はお忙しい中、オンラインでの個別面談にお時間をいただき誠にありがとうございました。\n\n本日お伺いいたしました現場の状況や課題感をもとに、現在内容を整理しております。\nお約束しておりました資料・ご提案の準備が整い次第、改めてお送りいたしますので、今しばらくお待ちくださいませ。\n\nなお、面談後に「これも補足しておきたい」「社内でこんな話が出た」という点がございましたら、このまま本メールへのご返信にてお気軽にお知らせください。\n\n引き続き、どうぞよろしくお願い申し上げます。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋真人です。\n\n本日はお忙しい中、お打ち合わせのお時間をいただき誠にありがとうございました！\n\nお伺いした内容をもとに整理・準備を進めておりますので、まとまり次第またご連絡いたします。\n補足やご質問などございましたら、いつでもこのままLINEへお送りください。',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-20:00',
    preferredSendTime: '',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: '商談・面談実施に伴う顧客フォロー（取引関連連絡）',
  },
  {
    name: '【レポート後】3日後：詳細診断レポートのご確認状況のお伺い',
    trigger: 'report_sent',
    channel: 'both',
    audience: '詳細診断レポート送付済みのお客様（返信・成約で自動停止）',
    waitMinutes: 4320,
    emailSubject: '【ご確認のお伺い】先日の詳細診断レポートについて｜有限会社MST',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n先日は詳細診断レポートをお送りさせていただきましたが、内容をご確認いただけましたでしょうか。\n\nレポートの中で「ここはもう少し詳しく聞きたい」「自社の実情に合わせて優先順位を相談したい」という箇所がございましたら、どうぞお気軽にお知らせください。\n\nご希望に合わせて、具体的な改善ステップや体制案をご案内することも可能です。本メールへのご返信、または下記日程調整リンクよりご連絡をお待ちしております。\n\n▼ 追加のお打ち合わせ日程はこちら\n{booking_url}',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n先日お送りいたしました詳細診断レポートはご覧いただけましたでしょうか？\n気になる点や「具体的な改善ステップも相談したい」という箇所がございましたら、このままLINEまたは下記よりお気軽にご連絡ください。\n\n▼ 追加相談の日程はこちら\n{booking_url}',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: '詳細診断レポート送付後の顧客フォロー',
  },
  {
    name: '【提案後①】3日後：ご提案書のご確認状況 ＆ ご質問のお伺い',
    trigger: 'proposal_sent',
    channel: 'both',
    audience: '提案書送付済みのお客様（返信・成約で自動停止）',
    waitMinutes: 4320,
    emailSubject: '【ご確認のお伺い】先日のご提案書について｜有限会社MST',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\n先日お送りいたしましたご提案書について、社内でのご確認状況はいかがでしょうか。\n\nご検討にあたり、\n・支援内容やスケジュール感をもう少し詳しく知りたい\n・一部の範囲に絞ってスモールスタートする案も検討したい\nといったご要望がございましたら、柔軟に調整いたしますのでご遠慮なくお申し付けください。\n\n本メールへのご返信にてご質問・ご要望をお聞かせいただければ幸いです。よろしくお願いいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\n先日お送りいたしましたご提案書はご確認いただけましたでしょうか？\n「一部の範囲から始めたい」「詳細を質問したい」などございましたら、このままLINEで一言お送りいただければ調整いたします！',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: '提案書送付後の顧客フォロー',
  },
  {
    name: '【提案後②】7日後：ご検討状況のお伺い（導入範囲の調整・個別相談）',
    trigger: 'proposal_sent',
    channel: 'both',
    audience: '提案書送付済みのお客様（返信・成約で自動停止）',
    waitMinutes: 10080,
    emailSubject: '【MST】ご提案内容のその後いかがでしょうか（導入範囲や時期のご相談）',
    emailBody:
      '{recipient_name} 様\n\n有限会社MSTの大橋真人です。\nご提案書をお送りしてから1週間ほど経ちましたため、その後のご検討状況をお伺いしたくご連絡いたしました。\n\n社内でのご検討に際して、もし前提条件の見直しやご予算・開始時期に合わせたプラン再設計が必要でしたら、15〜30分ほどオンラインで整理し直すことも可能です。\n\n▼ 再調整のお打ち合わせ日程はこちら\n{booking_url}\n\n今回は時期を見送る場合も含め、現在のご状況を一言お知らせいただけますと大変助かります。どうぞよろしくお願いいたします。',
    messageBody:
      '{recipient_name} 様\n有限会社MSTの大橋です。\n\nご提案書をお送りしてから1週間が経ちましたため、その後のご状況をお伺いいたしました。\n開始時期や範囲の調整をご希望の場合は、15〜30分のオンラインで再整理も可能ですので、下記またはご返信にてお知らせください。\n\n▼ 再打ち合わせ日程はこちら\n{booking_url}',
    lineMessageType: 'text',
    lineImageUrl: '',
    linePreviewImageUrl: '',
    flexAltText: '',
    flexTitle: '',
    flexBody: '',
    flexButtonLabel: '',
    flexButtonUrl: '',
    status: 'prepared',
    automationEnabled: true,
    sendTimeWindow: '09:00-19:00',
    preferredSendTime: '10:00',
    stopOnBooking: false,
    stopOnDeal: true,
    consentBasis: '提案書送付後の顧客フォロー',
  },
];

export const LEGACY_BRANCH_A_PREFIXES = [
  '【1. 初回',
  '【2. 診断',
  '【3. レポート',
  '【4. 3日',
  '【5. 7日',
  '【A1・教育リマインド】',
  '【A2・診断直後】',
  '【A3・レポート送付】',
  '【A4・3日後教育】',
  '【A5・7日後商談案内】',
];

export function isLegacyBranchAScenarioName(name: string): boolean {
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  return (
    LEGACY_BRANCH_A_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) ||
    /^【[1-5][\.．、・:\s]/.test(trimmed)
  );
}

export function mergeStarterScenarioBatch(
  existingScenarios: MarketingScenario[],
  presets: Omit<MarketingScenario, 'id' | 'updatedAt'>[],
  options?: { replaceLegacyBranchA?: boolean; nowMs?: number }
): { merged: MarketingScenario[]; addedCount: number; updatedCount: number } {
  const now = options?.nowMs ?? Date.now();
  const baseList = options?.replaceLegacyBranchA
    ? existingScenarios.filter((s) => !isLegacyBranchAScenarioName(s.name || ''))
    : [...existingScenarios];

  const existingByName = new Map<string, MarketingScenario>();
  baseList.forEach((s) => existingByName.set(s.name.trim(), s));

  let addedCount = 0;
  let updatedCount = 0;
  const updatedList = [...baseList];

  presets.forEach((preset, index) => {
    const pName = preset.name.trim();
    const existing = existingByName.get(pName);
    if (existing) {
      const targetIndex = updatedList.findIndex((s) => s.id === existing.id || s.name.trim() === pName);
      if (targetIndex !== -1) {
        updatedList[targetIndex] = {
          ...existing,
          ...preset,
          updatedAt: now,
        };
        updatedCount++;
      }
    } else {
      let hash = 0;
      for (let i = 0; i < pName.length; i++) hash = ((hash << 5) - hash) + pName.charCodeAt(i);
      const stableId = `starter-${preset.channel}-${Math.abs(hash).toString(36)}-${index}`;

      const newScenario: MarketingScenario = {
        ...preset,
        id: stableId,
        updatedAt: now + index * 10,
      };
      updatedList.unshift(newScenario);
      existingByName.set(pName, newScenario);
      addedCount++;
    }
  });

  // Deduplicate by name preserving latest updatedAt
  const dedupMap = new Map<string, MarketingScenario>();
  for (const s of updatedList) {
    const key = (s.name || '').trim();
    if (!key) continue;
    const prev = dedupMap.get(key);
    if (!prev || (s.updatedAt || 0) >= (prev.updatedAt || 0)) {
      dedupMap.set(key, s);
    }
  }

  return { merged: Array.from(dedupMap.values()), addedCount, updatedCount };
}
