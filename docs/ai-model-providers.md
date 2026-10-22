# AIプロバイダー設定ガイド

AIチャットおよび各役割AIでは、Google Gemini、Groq、OpenRouter の接続先とモデルIDを選択・個別指定できます。既定値は Google Gemini（`gemini-3.8-flash`）です。
設定は画面下部フッターの「AIモデル設定」または役割AI一覧画面から行え、MSTワークスペースに保存・同期されます。

## APIキーの設定（サーバー側環境変数）

サーバー（バックエンド）の環境変数（`.env`）に利用する提供元のAPIキーを登録してください。APIキーはブラウザやデータベースには保存されず、サーバー間通信でのみ安全に使用されます。

- `GEMINI_API_KEY` — Google AI Studio / Gemini API
- `GROQ_API_KEY` — Groq Cloud API
- `OPENROUTER_API_KEY` — OpenRouter API

※ APIキーを設定していない提供元を選択して実行した場合は、設定エラーが通知されます。キーを追記した後はサーバーを再起動してください。

## 提供元ごとの特徴と無料枠

1. **Google Gemini**
   - 既定モデル: `gemini-3.8-flash`
   - 特徴: 高精度かつ高速、長文コンテキストにも対応。

2. **Groq**
   - 推奨モデル: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
   - 特徴: 圧倒的な生成速度。Groqアカウントの無料レート制限内で高速レスポンスを実現。

3. **OpenRouter**
   - 推奨モデル: `openrouter/auto`, `meta-llama/llama-3.3-70b-instruct:free`
   - 特徴: 多彩なオープンソースモデルへ一括アクセス可能。`:free` 付きの無料提供モデルも選択可能。

## フォールバック（自動フェイルオーバー）機能

MST経営OSでは、主モデル（Primary）がレート制限やプロバイダー障害等で一時的にエラーとなった場合、設定された予備モデル（Fallback）へ自動で切り替えて回答を継続するフォールバック機能を備えています。

- 役割ごとに主モデル＋最大2つの予備モデルを設定可能
- 応答データには「どのモデルで生成されたか」「フォールバックが発生したか」が明記されます
