# 商談ヒアリング・提案書 DB設計書(案)

作成日: 2026-11-11 / 対象: `docs/db-proposals/` に置く想定 / 状態: ドラフト(本番DBには未適用)

前提: 「診断・提案書 構成テンプレート仕様書(案)」の段階2〜5(商談中〜承認済み)を保存するためのDB設計。

## 1. 方針

- **既存テーブルは変更しない。追加のみ**(`CREATE TABLE IF NOT EXISTS`)。本番への影響を最小にする。
- 診断パート(D0〜D6)は既存の `diagnoses` / `ai_reports` をそのまま使う。
- 商談中の記入は `hearing_sheets`、提案パート(P1〜P7)は `proposal_drafts` に章ごとに保存する。
- 送付用のHTMLは、承認時に `proposal_drafts` から作り、既存の `customer_documents`(`document_type='proposal'`)に書き込む。**HTMLを正とせず、章データを正とする。**
- 1文書1案。2案併記は今は使わない。将来用に `plan_group_id`(空欄可)だけ持つ。
- `deals.proposal_type`(商品種別として使用中)は触らない。型は別項目で持つ。

## 2. 既存との関係

| 既存 | 使い方 |
| --- | --- |
| `diagnosis_submissions` | HP回答の原本。`answers` に業種・従業員数・お悩みが入る |
| `diagnoses` | 診断の実体。ヒアリングシートと提案書の親 |
| `ai_reports` | D0〜D6の本文。版管理は既存の `version` / `is_latest` |
| `deals` | 商談。`id` は **text**。提案書の紐づけ先 |
| `customer_documents` | 送付する書類。`status`(draft / awaiting_approval / approved / queued / sent …)をそのまま使う |

## 3. 追加テーブル

### 3-1. `hearing_sheets`(ヒアリングシート)

1診断につき1枚(再商談は別枚を許す)。

| 列 | 型 | 内容 |
| --- | --- | --- |
| id | uuid PK | |
| diagnosis_id | uuid FK → diagnoses | 必須 |
| deal_id | text FK → deals | 商談が決まったら入れる(空欄可) |
| company_id | text FK → companies | |
| core_version | text | 固定10問の版(例 `core_v1`) |
| core_answers | jsonb | 固定の質問への回答。キーは `q01`〜`q10`、型判断用は `t01`〜`t03` |
| extra_questions | jsonb | AIの追加質問と回答 `[ {q, a} ]`(最大5) |
| conducted_at | timestamptz | 商談実施日時 |
| status | text | `draft` / `completed` |
| owner_id | uuid | 既存の `customer_documents` と同じ規約 |
| created_at / updated_at | timestamptz | |

固定質問の文面はコード側の定数で持ち、DBには回答だけを保存する(質問を直しても過去の回答は壊れない。版は `core_version` で識別)。

### 3-2. `proposal_drafts`(提案パート)

| 列 | 型 | 内容 |
| --- | --- | --- |
| id | uuid PK | |
| diagnosis_id | uuid FK | 必須 |
| hearing_sheet_id | uuid FK | |
| deal_id | text FK → deals | **承認待ちに進む条件**(下記) |
| plan_group_id | uuid | 将来の2案併記用。今は常にNULL |
| version | int | 1から |
| is_current | bool | 1診断につき現行版は1件 |
| status | text | `drafting` / `awaiting_approval` / `approved` / `sent` / `superseded` |
| our_assessment | text | 当社の見立て: `spot_build` / `retainer` / `hybrid` |
| our_assessment_reason | text | 見立ての理由(一言) |
| customer_intent | text | お客様の意向(同上の値、または NULL) |
| final_kind | text | 最終決定: `spot_build` / `retainer` / `hybrid` / `undecided` |
| payment_mode | text | 既存 `PaymentMode` の値 |
| chapters | jsonb | P1〜P7 の本文と入力値 |
| initial_fee | numeric(14,0) | 初期費用 |
| monthly_fee | numeric(14,0) | 月額 |
| discount_amount | numeric(14,0) | 値引き |
| subtotal | numeric(14,0) | 税抜小計 |
| tax_amount | numeric(14,0) | 消費税 |
| total_amount | numeric(14,0) | 税込合計 |
| issued_on | date | 発行日 |
| valid_until | date | **発行日から自動計算**(例: 発行日+30日。日数は定数) |
| roadmap_confirmed_by / _at | text / timestamptz | P3の担当者確認 |
| approved_by / approved_at | text / timestamptz | 承認 |
| document_id | uuid FK → customer_documents | 承認時に作る送付用HTML |
| supersedes_id | uuid FK(自己) | 置き換え元 |
| owner_id / created_at / updated_at | | |

`mismatch`(見立てと意向の食い違い)は列にせず、`our_assessment <> customer_intent` で画面側が表示する。

**制約(DBで守らせるもの)**
- `final_kind` / `our_assessment` / `customer_intent` の値チェック。
- 現行版は1診断につき1件: `UNIQUE (diagnosis_id) WHERE is_current`。
- `(diagnosis_id, version)` は一意。
- 承認待ち以降(`awaiting_approval` / `approved` / `sent`)では、次をすべて満たすこと(CHECK)。
  - `final_kind <> 'undecided'`
  - `deal_id IS NOT NULL`
  - `payment_mode IS NOT NULL`
  - `subtotal + tax_amount = total_amount`
  - `valid_until IS NOT NULL`
  - `roadmap_confirmed_at IS NOT NULL`(承認待ちへ進む時点)
- 上記のうち「P2の提供内容が入力済み」は、jsonbの中身なので、DBではなくAPI側で検証する。

### 3-3. 型と支払い方式の初期値

| final_kind | payment_mode の初期値 |
| --- | --- |
| spot_build | `lump_sum`(`installments_3` / `installments_6` / `milestone` に変更可) |
| retainer | `retainer` |
| hybrid | `hybrid_setup_retainer` |

初期値は画面側で入れる。DBは「型と支払い方式の組み合わせが矛盾しない」ことだけCHECKする(例: `retainer` の型に `lump_sum` は不可)。

## 4. 状態の流れ

```
drafting ──(必須項目OK)→ awaiting_approval ──(承認者)→ approved ──→ sent
   ↑                                  │
   └──────────(差し戻し)────────────┘
作り直し: 新しい版を作り、旧版は superseded、is_current=false
```

- `sent` 後の変更は新しい版として作る(旧版は編集不可)。
- 診断パートの再生成では、`proposal_drafts` を書き換えない。

## 5. 承認者の限定(未確認事項あり)

現行の承認は、ログイン済みなら誰でもできる(`checkIsAdminUser` が実質全員許可)。
本設計では承認と送付をサーバー側で承認者のみに限定する必要があるが、**承認者を何で識別するか(ロール列、許可メールの一覧など)は決めていない。**

確認済み(2026-11-11、`server.ts` を読んだ):
- `checkIsAdminUser`(7384行付近)は、管理者ロール・特定メール・社内ドメインを見たあと、最後の行が `Boolean(user.email)`(メールがあれば誰でも許可)で、実質ログイン済み全員を通す。
- `/api/ai-reports/:id/approve`(7337行)は `requireAuth` のみ。
- したがって、`checkIsAdminUser` の最終行を消すだけでは足りない可能性がある(同関数は汎用レコード削除APIにも使われており、影響範囲の確認が要る)。承認専用の判定関数を別に作る案が安全。
承認者の限定は、本設計のマイグレーションとは分ける。

**決定(2026-11-12): 現在は利用者が1人のため、承認者の限定は今は実装しない。** 新テーブルは RLS(`owner_id = auth.uid()`)で自分の行しか見えない。**利用者を2人目に増やす前に**、次の対応を必ず行う。
- 承認・送付待ちへの状態変更は、現状 `CommunicationSendCenter.tsx` や送信履歴画面が Supabase を直接更新している(サーバーを通らない)。サーバー側の判定だけでは止まらないため、限定するならDBのトリガー(承認者テーブル、または `app_metadata` のロール)で行う。
- 既存の `checkIsAdminUser` は `user_metadata.role` も信用しているが、`user_metadata` は本人が書き換えられる。承認の判定には使わない。

## 6. 確認が必要な点(実装前)

1. **商品マスタの場所。** `products` テーブルがある一方、契約・請求テーブルのコメントには「商品マスタは現在ワークスペースの状態として保存されている」とあり、`mst_managed_products` もある。P2のサービス名をどこから選ぶかが未確定。確定するまで `chapters` 内に `product_id`(text)を持つだけにし、外部キーは張らない。
2. **RLS。【確認済み】** `customer_documents` は `FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)`(`20261016100000_sales_workspace_consolidation.sql`)。新テーブルも同じ文面で作成済み。なお `diagnoses` / `deals` / `companies` は「ログイン済みなら全員」の方針なので、自分の行だけ見える新テーブルとは粒度が異なる(複数担当者で共有したくなったら見直す)。
3. **金額の持ち方。** `deals` に `initial_fee` / `monthly_fee` / `total_amount` がある。提案書の金額を商談側に書き戻すか、提案書側だけを正とするか。**案: 承認時に `deals` へ書き戻す(提案書が正)。** 見積書・契約書テンプレートは `deals` を読むので、引き継ぎが簡単になる。
4. **消費税の端数処理。【確認済み】** 既存コードは一貫して `Math.floor`(切り捨て)で、税率は10%の直書き(`server.ts` 7751・7892行、`StageTransitionModal.tsx`、`TableManager.tsx` など)。提案書も切り捨てに合わせる。税率は変わりうるため、DBでは `小計+税=合計` の一致だけを CHECK し、税額の計算自体は API 側で行う。

### 追加で分かったこと(2026-11-11)

- `customer_documents` の `document_type` に `proposal` は引き続き使える(`20261022120000` で `estimate` 等が追加されただけ)。
- `customer_documents` には `ai_report_id` 列があり、`(owner_id, ai_report_id)` が一意。提案書の送付用HTMLは `ai_report_id` を入れずに作る(旧方式との衝突を避ける)。
- `deals` の金額列は `int4`。`proposal_drafts` は `numeric(14,0)` なので、承認時の書き戻しで桁あふれは起きない(21億円超は想定外)。
- `proposal_drafts.deal_id` は、承認済みの記録が崩れないよう `ON DELETE RESTRICT`。商談を削除する管理APIは、提案書が紐づく商談で外部キーエラーになる(既存の `formatForeignKeyError` が扱う種類のエラー)。
- 送付済み(`sent`)の版は、DBのトリガーで編集不可にした(`status→superseded` と `is_current→false` だけ許可)。

### 仕様書との突き合わせで追加した点(2026-11-12)

- **型ごとの金額の必須**: 承認待ち以降では、`spot_build` は初期費用>0、`retainer` は月額>0、`hybrid` は両方>0(CHECK `chk_proposal_drafts_fees_by_kind`)。
- **お申し込み・同意記録(仕様書 段階6・P7)**: 提案書側には持たない。既存の `customer_documents` の `consent_method` / `consent_recorded_at` / `consent_user_agent` / `consent_evidence_text` に、公開の申込画面(`PublicDocumentApplyView.tsx`)が既に書いている。`proposal_drafts.document_id` から辿る。
  - 注意1: 申込画面は同意時に書類の `status` を `approved` にする。社内承認の `approved` と同じ語で、意味が違う。提案書の状態は `proposal_drafts.status` を正とし、書類の `status` は参照しない。
  - 注意2: 申込画面は商談(`deals`)を自動起票・成約にする。提案書は承認待ちの時点で `deal_id` が必須なので、申込画面側の起票との重複・不整合が出ないか、実装時に確認する。
  - 注意3: `consent_ip` 列はあるが、申込画面は書いていない(User-Agent のみ)。電子同意の証跡として足りるかは、仕様書 §9-6 の専門家確認の対象。
- **お客様の意向の転記**: 商談中(段階2)の意向は `hearing_sheets.core_answers.t01` に入る。提案書を作る時点(段階3)で、API が `customer_intent` へ転記する。DBの変更はなし。

### 実装状況

SQL案: `20261111100000_proposal_hearing_tables.sql`(同じフォルダ)。使い捨てのPostgreSQL 16で、2回適用しても通ること、各CHECK・一意制約・送付済みの編集禁止・取り消し手順が設計どおり動くことを確認済み。**Supabase本体と既存の全マイグレーションを通した検証は未実施**(スタブの親テーブルで検証)。

## 7. マイグレーション方針

- ファイル名: 現在は `docs/db-proposals/20261111100000_proposal_hearing_tables.sql`(`supabase/migrations/` に置くと自動適用の対象になるため、ステージングで確認するまで docs に置く)。確認後に `supabase/migrations/` へ移す。
- 追加のみ。既存テーブルへの `ALTER` なし。
- 取り消しは `DROP TABLE proposal_drafts, hearing_sheets`(他のテーブルは参照していないため、これで元に戻る)。
- 本番へは先にステージング、またはテスト用プロジェクトで適用して確認する。
