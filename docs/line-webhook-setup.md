# LINE Webhook 接続手順

## この実装が行うこと

- POST /api/line/webhook でLINE Messaging APIのwebhookを受け取る。
- raw request bodyを使ってx-line-signatureをHMAC-SHA256で検証する。
- follow/unfollow/message等のイベントをcrm_ingestion_eventsへ冪等に記録する。
- userIdがあるイベントでは連絡先とline_friendsをupsertし、友だち状態・最終メッセージ日時を更新する。
- LINE友だち追加だけを理由にリードは作成しない。既存の同じLINE IDのリードがあればcontact_idを補完する。

受信メッセージ本体は現在crm_ingestion_events.payloadに監査用として保存します。専用の会話履歴テーブル、受信箱UI、自動返信、個別/一斉送信はこの段階では含みません。

## サーバー環境変数

ホスティング先の**サーバー側の秘密情報設定**に以下を登録します。

- SUPABASE_URL: SupabaseのProject URL
- SUPABASE_SERVICE_ROLE_KEY: Supabaseのservice_role/secret key。サーバーのみで使用し、VITE_を付けない
- LINE_CHANNEL_SECRET: LINE Developers ConsoleにあるMessaging APIチャネルのChannel secret
- LINE_CHANNEL_ACCESS_TOKEN: 長期チャネルアクセストークン。プロフィール表示名取得用（なくてもイベント取込は可能）

SUPABASE_SERVICE_ROLE_KEYとLINEの秘密情報をブラウザへ渡さないでください。リポジトリへ実値をコミットしないでください。

## LINE Developers Console

1. Messaging APIチャネルのWebhook URLに、公開サーバーの https://<domain>/api/line/webhook を設定する。
2. Use webhookを有効にする。
3. Verifyを押す。署名済み空イベントにもHTTP 200を返す。
4. テストアカウントから友だち追加、メッセージ送信、ブロック/解除を行い、MSTのLINE友だち・タグ画面で確認する。

チャネルアクセストークンが未設定の場合、友だち名は「LINE友だち」として登録され、イベント取込は続行します。LINEのイベントを再送する場合に備え、webhookEventIdを冪等キーに使います。

## 適用条件と制約

PR #21のCRM migrationが適用されていること。サーバーが環境変数を読み込める構成でデプロイされていること。フロントエンドのみの静的ホスティングではwebhookを受け取れません。LINE DevelopersのVerifyを押して確認できる公開HTTPS URLが必要です。

LINEの署名は本文をJSON解析・再整形する前のraw bytesで検証します。これはLINE公式の[署名検証手順](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)に合わせています。LINEから友だち追加・メッセージ等のイベントがWebhookに届く仕組みは[受信Webhookの公式説明](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)を参照してください。
