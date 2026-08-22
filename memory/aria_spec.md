# US_Market_Intelligence_Report_movie ワークフロー仕様書

最終更新: 2026年8月18日（夜・第4稿）

> 8/16セッションで決定した画面デザイン刷新（第1段階）を反映。
> 「実測」と付した記述は 2026-08-15 06:00 JSTの本番実行（execution `5982`）の実データ。
> 「8/16適用」と付した記述は本番反映・publish済みだが**未検証**（**8/18（火）朝**の自動実行が初回検証）。

---

## 📺 チャンネル概要

| 項目 | 内容 |
|---|---|
| チャンネル名 | 朝6時、ARIAの米国株速報（`@nippon-investors`） |
| 投稿時刻 | 6:00 JST（= 21:00 UTC）、**火〜土のみ** |
| 本番ワークフローID | **`WFSUfQAF8U2Ycjqy`**（v3） |
| n8n URL | https://n8n.srv958101.hstgr.cloud |
| ノード数 | 128（2026-08-12時点） |
| 動画総尺 | 約196秒（実測: 196.12秒） |
| 動画構成 | オープニング16秒 → 為替ボード → ヒートマップ → 本編（テロップ） → エンディング8秒 → チャンネル登録8秒 |

### ⚠️ 過去のワークフローID（混同注意）

| ID | 状態 |
|---|---|
| `WFSUfQAF8U2Ycjqy` | **現行v3・稼働中** |
| `WBFJCzcpxmBqVJhz` | v2・アーカイブ済み（2026-08-07停止） |
| `YDdY2xuPJRV18rJx` | 初代・停止済み |
| `KtNIo3F2IPKQlBKv` | v2のバックアップ |

---

## ✅ 現在の稼働状態（2026-08-15 確認）

- **スケジュールトリガー: 稼働中**（8/13に品質修正のため一時停止 → 再開済み）
- **YouTube投稿ノード（Upload a video）: 有効**。8/15朝の実行で `uploadId: SHY2dy251ZU` を取得、`Set_YouTube_Thumbnail` も成功
- `Verify_Script_Facts` は空配列を返却 → 方向ミス検知なし・LINE未発火（正常）
- `thumbnailTierSource: claude` / `thumbnailTier: mild_down`（Claude選択が機能）
- 直近の手動実行（8/13 `5904`、8/14 `5937`・`5968`）はいずれもerror。**自動実行（trigger）のみ成功**している状態。手動実行の失敗要因は未調査
- 8/16に `Build_Shotstack_Timeline` を全面差し替え → publish済み。`assetVer: 20260816a`
- 8/16にScheduleトリガーを**火〜土限定**に変更 → publish済み（`activeVersionId: 81555fc2-c2c8-4bdc-a646-fe31b7724588`）
- ⚠️ **新テロップ仕様は未検証**。8/16朝の実行（`6025`）はコード差し替え**前**に走ったため旧仕様。初回検証は**8/18（火）朝**

---

## 🏗️ 全体フロー

```
Schedule Trigger（6:00 JST）
  ├─ 市場データ×10（Yahoo Finance, range=1y）→ Merge
  │    ├─ Check_Market_Open
  │    ├─ Build_Market_Summary
  │    └─ Build_Forex_Chart_HTML → Generate_Forex_Chart_Image
  ├─ RSS×5（BBC Business/Tech, CNBC Top/Tech, Yahoo Finance）→ Merge2
  │    └─ Prepare_US_Report → Fetch_Recent_Topics → Fetch_Market_Log
  │       → Fetch_Earnings_Calendar → Build_Earnings_Data
  │       → Read_Aria_News
  │          └─ Guard_ARIA_News ──false──→ Notify_LINE_News_Missing（終端）
  │                              └─true──→ Fetch_Daily_Input
  │                                        → Fetch_Benchmark_Insights
  │                                        → List_Nakajima_Files → … → Build_Nakajima_Digest
  │                                        → Build_Claude_Prompt
  │                                        → Append_Thumbnail_Tier_Prompt
  │                                        → Claude API → Code in JavaScript
  │                                             ├─ Verify_Script_Facts → Notify_LINE_FactCheck
  │                                             ├─ Prepare_Stock_Mentions_Rows → Push_Stock_Mentions
  │                                             └─ Split_TTS_Chunks → TTS → Code in JavaScript1
  │                                                → Upload file → 公開設定 → Merge_Before_Timeline
  ├─ HM_×50（ヒートマップ用個別取得）→ Build_Heatmap_HTML → Generate_Heatmap_Image
  │                                                          → Merge_Before_Timeline
  ↓
Build_Shotstack_Timeline
  ├─ Validate_Timeline → Shotstack render → ポーリング → 動画DL → Upload a video（YouTube）
  └─ Fetch_Thumbnail_Base → ポーリング → サムネDL
       ↓
Merge_Before_Thumbnail → Set_YouTube_Thumbnail
  → Build_Market_Log_Data
       ├─ Save_Market_Log（データテーブル）
       ├─ Save_Used_Topic（データテーブル）
       └─ Fetch_Market_Log_MD → Build_Market_Log_Push_Body → Push_Market_Log_MD（GitHub）
```

---

## 📆 配信曜日（2026-08-16 修正）

### なぜ火〜土なのか

米国市場の終値が揃うのは日本時間の翌朝。対応関係は以下のとおり。

| 米国の取引日 | 終値が揃う日本時間 | 配信 |
|---|---|---|
| 月〜金 | 火〜土の早朝 | **配信する** |
| （土日は休場） | 日・月 | **配信しない** |

### 8/16に発覚した不具合

**日曜（8/16）に動画が生成され、内容が土曜（8/15）とまったく同じだった。**

- Scheduleトリガーの設定が `{"rule":{"interval":[{"triggerAtHour":6}]}}` で、**曜日の制限がなく毎日発火していた**
- 実行 `5982`（8/15土）と `6025`（8/16日）は、どちらも金曜8/14の終値を参照していた → 2日連続で同一内容
- → `0 6 * * 2-6`（cronExpression）に変更して解消

### ⚠️ `Check_Market_Open` はゲートではない

名前から「市場が閉まっていたら止めるノード」と誤解しやすいが、**実際の出力は `{ isMondayWeeklyMode: false }` のみ**。週明けに週次モードへ切り替えるフラグを立てているだけで、**実行を止める機能は一切持たない**。休場日の抑止はScheduleトリガーの曜日指定で行う。

### ⏸️ 月曜の「週報」構想（現在は停止中）

もともと月曜は「休みの日」ではなく**週報を配信する日**という構想だった。その名残として以下のデータが今も毎回計算されている（ただし**下流で使われているかは未確認**）。

| 出力元 | フィールド |
|---|---|
| `Check_Market_Open` | `isMondayWeeklyMode` |
| `Build_Market_Summary` | `isWeeklyMode` / `sp500WeeklyChange` / `nasdaqWeeklyChange` / `dowWeeklyChange` / `usdJpyWeeklyChange` |

8/16の修正（`2-6`）は月曜を**単純に止めた**だけ。週報を復活させる場合は `1-6` に戻し、月曜だけ別フォーマットへ分岐させる。

- ⚠️ **`isMondayWeeklyMode` 周辺のコードは削除しないこと**。復活時の土台になる
- 週報の内容案: 前週5営業日の指数の動き / 週間で目立った銘柄 / 今週の決算・経済指標の予定
- 「今後のイベント」コーナー（第2段階）と設計が重なるため、**第2段階でコーナー構成が固まってから**着手するのが効率的

### VPS側cronも合わせる

`/root/aria-workflow/run_news.sh` を叩くcronは `25 20 * * 1-6`（月〜土）のまま。動画は作られないので実害はないが、月曜朝に無駄にClaude Codeが回る。`2-6` へ修正すること（未対応）。

---

## 🛡️ 品質ゲート

### Guard_ARIA_News（2026-08-12 新設）

ニュース原稿が当日分で揃っていない場合に、**動画生成を中止する**ハードストップ。

- **位置**: `Read_Aria_News` の直後
- **条件（AND）**
  1. `stdout` に `ARIA_NEWS_NOT_FOUND` を含まない
  2. `stdout` に `<!-- generated: {当日のJST日付} -->` を含む
  3. `stdout` の長さが800文字以上
- **true** → `Fetch_Daily_Input`（通常フロー）
- **false** → `Notify_LINE_News_Missing` で終端。下流には接続しない

### Verify_Script_Facts（2026-08-12 新設・非ブロッキング）

台本の数字方向が決定論データ（`Build_Market_Summary`）と矛盾していないかを検算する。

- `Code in JavaScript` から分岐。**動画生成パイプラインは止めない**
- 方向ミス（実際は下落なのに台本が上昇 等）のみ高精度検知。上昇/下落キーワードが両方または皆無の文は「判定不能」としてスキップ、変化 ±0.05%未満は判定しない
- クリーンなら空配列 → 下流LINEは発火しない。ミスありなら `alertText` 1件 → `Notify_LINE_FactCheck`
- 認証: httpHeaderAuth `BBwVCizwtzzPae8C`（"LINE Messaging API"）

#### 初発火（2026-08-16）と誤検知の判明

導入以来はじめてLINEが飛んだが、**誤検知**だった。

- 通知内容: 「マイクロソフト: 実データ -0.3% なのに台本は『上昇』」
- 該当文: 「マイクロソフトは今月に入ってからも高値圏を維持しており、決算後の**上昇**分を保っています。」
- 台本は**今月の推移**を語っており、前日比とは別の時間軸。前日は下げたが月間では高値圏、は矛盾しない
- 背景: 8/11に「個別株は前日比だけでなく今月の動き・年初来の流れなど時間軸を広げたコメントを追加」という指示を入れており、台本はそれに従っただけ

**対策（未実装）**: 文中に「今月」「先月」「年初来」「今年」「週間」「過去」等の**前日比以外の期間を示す語**が含まれる場合は判定対象から除外する。既存の「上昇/下落キーワードが両方または皆無の文はスキップ」と同じ誤検知回避の延長。

### LINE通知の宛先

いずれも `https://api.line.me/v2/bot/message/push`、ユーザーID `Ufc42465f6e2a02987d7b08e7e99fee43`。

---

## 📰 ニュース収集パイプライン（VPS / Claude Code）

### 経路

```
cron（root, 20:25 UTC = 5:25 JST, 月〜土）
  → /root/aria-workflow/run_news.sh
  → su - aria → claude --print "$(cat /home/aria/news_prompt.txt)"
  → /local-files/aria/aria_news.md
       （ホスト /local-files ↔ コンテナ /files のバインドマウント経由）
  → n8n Read_Aria_News: cat /files/aria/aria_news.md
```

### run_news.sh の要点

- 出力先: `/local-files/aria/aria_news.md`（一時ファイル `.tmp` 経由でアトミックに確定）
- 先頭行に `<!-- generated: YYYY-MM-DD -->`（JST）を付与 ← Guardの判定材料
- stderrは `/local-files/aria/claude_err.log` に分離（原稿への混入防止）
- 800バイト未満は失敗扱い
- 失敗時は **v3（`WFSUfQAF8U2Ycjqy`）** をdeactivate
- ariaユーザーは `/root` に書けないため、ログ出力先を `/root` 配下にしないこと

### ⚠️ 過去の障害（解決済み・2026-07-24〜08-12）

n8nコンテナには `/tmp` がマウントされていない（マウントは `n8n_data:/home/node/.n8n` と `/local-files:/files` の2つのみ）。cronはホストの `/tmp/aria_news.md` に書き、`Read_Aria_News` はコンテナ内の `/tmp` を読んでいたため、**約3週間ニュース原稿が一度も届いていなかった**。出力先変更で解消。

---

## 🎬 映像アセット（2026-08-15 刷新）

### 実写風・宇宙ニューススタジオへ統一

Google Veo 3.1 Quality で生成した映像に全面移行。**焼き込みARIAの背景画像は廃止**し、無人スタジオの静止プレートに統一。ARIAはオープニング／エンディングの映像内にのみ実写で登場する。

| 用途 | アセット（GitHub Pages / trosystems1-aria-audio） | 実測の使われ方 |
|---|---|---|
| 背景プレート（全編） | `bg_studio.png?v=20260815a` | 0〜196.12秒 |
| オープニング映像 | `aria_opening.mp4?v=20260815a` | 0〜8秒、`volume: 0` |
| エンディング映像 | `aria_ending.mp4?v=20260816a` | 本編終了〜+8秒、`volume: 0.3`（8/16に新規動画へ差し替え） |
| ~~チャンネル登録映像~~ | ~~`aria_subscribe.mp4`~~ | **8/16廃止**。エンディングに統合 |
| BGM | `News Theme 1 - Audionautix.mp3` | 0〜16秒、fade out |
| ARIA挨拶音声 | `aria_opening.mp3` | 8〜16秒 |

- **キャッシュバスター運用**: アセットURL末尾に `?v={assetVer}` を付与。`assetVer` は `Build_Shotstack_Timeline` が出力（例: `20260815a`）。差し替え時はこの値を更新する
- ARIAは**喋らせない方式（方式A）**。Veoは外部音声に口を合わせられないため、会釈・微笑・所作のみ。ナレーションはボイスオーバー
- Veoプロンプトでは `news channel` / `news anchor` / `news station` / `anchor desk` 等の放送ジャーナリズム用語がコンテンツポリシーで弾かれる → `orbital station` / `a woman` / `sleek desk` に置換して通過
- 年齢記述は `in her mid twenties, youthful soft features, bright fresh complexion`（`late 20s to 30s` では老けて出る）
- 顔の一貫性はGoogle Flowの**キャラクターサイドバー**にARIAを登録して担保。参照画像 Drive ID `1QR5mElyI8_2Abcx_WbvozHWUE9XhA4m2`
- 「口が閉じたテイク」を引くため出力数は x3〜x4 推奨

### エンディング映像の刷新（8/16）

旧構成は「エンディング8秒（引き）→ チャンネル登録8秒（金色リングへ寄り）」の2本立てだったが、カメラが引いた直後にまた寄るため動きが往復して不自然だった。またリングは「CTAを載せる空きフレーム」として作ったものの、実際には文字が上部に浮きリングは飾りになっていた。→ **リング動画を廃止し、エンディング1本に統合**。CTAは映像下部にテキストで重ねる（音声では言わない）。

新エンディングの内容: ARIAが会釈 → カメラがその場で回転して室内を見渡す → 反対側の全面ガラス越しに大きな月。オープニング（地球）との対比で締める。

**Veo運用で判明した制約（重要）**

- 「窓を通り抜けて船外へ出る」ような**長距離のカメラ移動は8秒では通しで撮れない**。途中で勝手にカットが切られ、船外は新規生成されるためオープニングと別デザインの機体になる
- 同様に「部屋をぐるりと歩いて回る」移動も、途中に存在しない部屋や人物が湧く
- → **カメラを移動させず、その場で回転させるだけ**にすると安定する（`the camera stays in one fixed position and only rotates` / `no camera travel`）
- 不要な要素は明示的に排除する（`no other rooms, no other people`）
- キャラクター指定はプロンプト内に `@ARIA` を**サイドバーの候補から選んで**挿入する。容姿を文章で書くだけでは別人が出る。`@ARIA` と容姿説明を併記すると指示が競合するので説明文は書かない

---

## 🎞️ Shotstackタイムライン（実測トラック構成）

**インデックスが小さいほど前景**（mp4出力時）

| # | 内容 |
|---|---|
| 0 | テロップ＋エンディング文言＋チャンネル登録文言（HTML） |
| 1 | オープニングAgenda HTML（8〜16秒） |
| 2 | 為替ボード（16秒〜）／ヒートマップ画像 |
| 3 | ARIA映像 mp4（opening / ending） |
| 4 | 背景プレート `bg_studio.png`（全編） |
| 5 | BGM（0〜16秒、fade out） |
| 6 | ARIA挨拶音声（8〜16秒） |
| 7 | 本編音声（16秒〜） |

### タイムライン（8/15実測）

| 区間 | 内容 |
|---|---|
| 0〜8s | オープニング映像 |
| 8〜16s | Agenda（本日のトピックス3件）＋ARIA挨拶音声 |
| 16〜25.1s | 為替ボード（`buildForexHeroHtml`） |
| 25.1〜38.4s | ヒートマップ画像（hcti.io） |
| 38.4〜180.1s | 本編テロップ |
| 本編終了〜+8s | エンディング（8秒、下部にCTAテキスト） |

※ 8/16のリング動画廃止により**総尺は8秒短縮**（196秒 → 188秒前後）

- **テロップは forex / market コーナーには表示しない**（専用ボード・ヒートマップを全画面表示するため。仕様であり不具合ではない）
### テロップ書式（8/16適用）

| 項目 | 値 | 決定理由 |
|---|---|---|
| フォント | **56px** bold 白 | 46pxから拡大。視認性重視 |
| 行間 | 1.6（＝1行 89.6px） | 据え置き |
| 上余白 | **120px**（`TELOP_TOP_PAD`） | 4行時の下端が壁紙の金ライン(y≈520px)に触れない上限 |
| 左端 | 80px・左寄せ | 中央寄せは不可（順一さん指示） |
| 行数 | **3行目安・最大4行** | 5行で金ラインに接触するため |
| 1行上限 | 22文字（`TELOP_MAX_CHARS`、安全弁） | 56pxで1行に入る上限 |

**`valign="middle"` はShotstackで効かない**（今朝の動画で文字が画面上端に貼り付いていた原因）。`padding-top` で上余白を固定する方式に変更。行数によらず1行目の位置は不動。

#### 文節境界での折り返し（`wrapJaPhrase`）

旧実装は文字数で機械的に折り返していたため「AIブー／ムは」「〜していま／す。」のように語中で切れ、2行目に1〜2文字だけ残る状態が頻発していた。→ **文字数ではなく意味の切れ目で折り返す**方式に変更。右にまだ余裕があっても文節が終わったら改行する。

優先順位: (1) 読点・句点の直後 → (2) 助詞の直後（では/には/から/まで/ため/ので/って/は/が/を/に/で/と/も/や/の） → (3) それでも見つからなければ文字数で切る。`TELOP_MIN_CHARS = 8` 未満での改行は抑制（細切れ防止）。

#### コーナー見出し表示（`detectAgendaHeading` / `makeHeading`）

「次に主要株価です。」のような遷移文は、**全文をテロップにせず Agenda の項目名だけを中央に大きく出す**（76px・中央揃え・上余白280px）。音声のセリフはそのまま読み上げる。

判定条件: 「次に/続いて/最後に/まず/ここからは」で始まり、24文字以内で「です。」で終わる文。キーワードから `為替・指数` / `主要株価` / `ニュース` / `日本への影響` / `今後のイベント` にマッピングする。判定に外れると従来どおりのテロップになるため、**台本側の表現を固定する必要がある（第2段階）**。

### 配色ルール（2026-08-16 決定）

**米国式に統一する。上昇＝緑、下落＝赤。**

日本の証券会社（SBI証券等）は上昇＝赤／下落＝青が標準だが、Appleの株価アプリは日本語表示でも米国式。米国市場を扱うチャンネルであること、ヒートマップが既に米国式であることから、全画面で米国式に揃える。

**為替チャートの線と塗りはニュートラル（白）**。為替は上下に善悪がなく（円安は輸出企業に追い風・輸入企業に逆風）、赤で塗ると「悪いこと」という印象を与えるため。右上の変化幅表示だけ緑／赤で色を付ける。※現在は線・塗りともに赤。**白への変更は未実装**

### Shotstack注意点

- HTMLレンダラーはHTML4/CSS2.1相当。**flexbox/grid/position:absolute/SVGは非対応** → テーブルレイアウトを使う
- 静止画（JPG/PNG）出力ではtrack順序が逆（最後定義が最前景）
- `quality` は文字列（`'high'`）。数値は不可
- `volume` のキーフレーム指定は非対応 → `transition: {out:'fade'}`
- キャンバスは 1280×720

---

## 🔊 TTS・テロップ同期

### チャンク分割

Google TTSの5000バイト制限に対応するため、`Split_TTS_Chunks` が `<s>` 単位で分割（`MAX_BYTES = 4200`）。

### テロップのタイミング算出

- **新方式**: チャンクごとの実測音声長を、そのチャンク内の**実TTS文字数**で按分
- **旧方式**: 音声全体の長さを元テキストの文字数で按分 → チャンク間の発話速度差が蓄積し、中盤で最大5秒のズレ

`Code in JavaScript` が `ttsUnits` を出力し、`Split_TTS_Chunks` が `unitStart`/`unitEnd` を記録、`Code in JavaScript1` が逆算する。出力の `timingMode` が `per_chunk` なら新方式、`legacy_ratio` ならフォールバック。

### splitLong の単語境界分割（2026-08-13 修正）

旧実装は `part.slice(i, i + maxLen)` の**固定長スライス**で、語の途中で切れてTTSが誤読していた（「サップ／イーアール マイクロコンピューター」「もの歌詞数」「ナン／しい」「ソフ／ト系」）。単語境界での分割に変更済み。`Code in JavaScript` 内の `toTtsTag` から2箇所呼ばれるため、変更時は両方を直すこと。

### 音声設定

- 本編: `ja-JP-Chirp3-HD-Sulafat` / LINEAR16 / 24000Hz
- 複数チャンクはPCMを連結して1本のWAVに

---

## 🎨 サムネイル

事前生成された9枚の固定素材から選択する方式（Gemini自動生成は2026-07に廃止）。

**素材フォルダ**: Google Drive `ARIA`（`1N5ZZ3H61xg6QmCITqdOvB8mUub8oysgS`）

| tier | ファイル |
|---|---|
| strong_up | thumb_strong_up.png |
| mild_up | thumb_mild_up.jpg |
| mild_down | thumb_mild_down.jpg |
| strong_down | thumb_strong_down.jpg |
| forex | thumb_forex.png |
| earnings_miss | thumb_earnings_miss.png |
| earnings_beat | thumb_earnings_beat.png |
| ai_chip | thumb_ai_chip.png |
| geopolitics | thumb_geopolitics.png |

### 選択ロジック（3段階）

1. **Claudeが選んだ `thumbnail_tier`**（`Append_Thumbnail_Tier_Prompt` で指示、`Code in JavaScript` でホワイトリスト検証）
2. 取得できなければキーワード判定にフォールバック
3. それでも決まらなければ騰落率で4段階

出力に `thumbnailTier` と `thumbnailTierSource`（`claude` / `fallback`）を含む。運用監視に使う。

### 出力仕様（実測）

素材画像1枚のみの1トラック構成、`{format:'jpg', size:{width:1280, height:720}, quality:'high'}`。**HTML文字演出レイヤーは現在載っていない**（tier画像に文言が焼き込まれている前提）。

### バリエーション追加時の手順（3箇所）

1. `Build_Shotstack_Timeline` の `THEME_IMAGES` にキーとDrive URLを追加
2. `Append_Thumbnail_Tier_Prompt` の候補リストに1行追加
3. `Code in JavaScript` の `THUMB_TIERS` にキーを追加

---

## 📝 台本生成

### 構成（7パート）

| # | パート | 対応する出力キー |
|---|---|---|
| 1 | オープニング（3トピック予告） | `news_topic_headlines` |
| 2 | 為替指数 | `forex_corner` |
| 3 | 株の変動Map | `market_corner` |
| 4 | トピック解説（メイン） | `news_corner` |
| 5 | 日本への影響 | `japan_corner` |
| 6 | まとめ | `tonight_corner` + 固定クロージング |
| 7 | チャンネル登録画面 | システム自動 |

### モデル

`claude-sonnet-4-6` / max_tokens 8000

### 3トピックの構造（2026-08-13 固定化）

- トピック1: **日本人投資家が今知りたいことを問いの形にしたテーマ**
- トピック2: 為替
- トピック3: 次に重要な米国市場ニュース
- Agenda見出しは10文字（トリマーは12文字で切る。以前14文字で見切れていた）

### コンテンツ品質原則

- 「事実→なぜ重要か→日本人投資家への示唆」の3層構造
- **為替・指数は `forex_corner` だけで完結（2文以内）**。market / news / japan / tonight では為替・指数に一切触れない（違反多発のため厳守ルール化）
- `market_corner` は「上がった主な銘柄・下がった主な銘柄」を挙げるだけ。指数の話・銘柄間の比較は禁止。**3文以内**
- `news_corner` は8文（旧12文から短縮）
- VIXは1回のみ言及
- 1文38文字以内、算用数字のみ、銘柄名はカタカナ
- 二度づけ禁止・瑣末な小ネタ禁止・中身を薄くしない
- データがないセクションには触れない（「データがない」とも言わない）

### 🚫 情報源の扱い（最重要ルール）

競合チャンネル分析・中島聡さんメルマガ・永江一石さんブログは、**「日本人が今どのテーマを知りたがっているか」を把握するテーマ選定専用の入力**。

- 台本内での引用・要約・マージ・**存在への言及は一切禁止**（「競合チャンネルでも話題になっている」等の表現が過去に混入した）
- 台本の根拠は市場データと米国の報道のみ
- 永江一石さんブログ（`https://www.landerblue.co.jp/blog/`, RSS `/feed/`）は `Build_Claude_Prompt` に**独立セクションとしてタイトル・日付のみ**提供。RSSニュース群（`Merge2`）には混ぜない

### 入力される情報源

- 市場データ（前日終値、個別株対比、全体傾向）
- 直近5営業日のトレンド（`aria_market_log`）
- ドル円の俯瞰データ（高安レンジ、期間変化）
- 順一さんからの当日リクエスト（最優先）
- 競合チャンネルの分析（旬の話題把握のみ）
- 中島聡さんメルマガ（話題のヒントのみ）
- 永江一石さんブログ（タイトル・日付のみ）
- ARIA Research収集ニュース
- 決算予定・経済指標カレンダー
- 過去7日間の自分の話題（重複回避）

### YouTubeメタデータ（実測）

- タイトル形式: `ARIA速報｜{キーワード}｜米国市場の最新動向`
- 説明欄: 台本冒頭の数文＋`#米国株 #投資 #株式市場 #NASDAQ #SP500 #ARIA`

---

## 🗄️ データストア

### n8nデータテーブル

| 名前 | ID | 用途 |
|---|---|---|
| `aria_market_log` | `pm1J0ua1vqmuV80S` | 日次市場データ（長期記憶・第1層） |
| `aria_used_news_topics` | `uQBLmZ66QBiJTUvt` | トピック重複防止 |
| `aria_stock_mentions` | `yC36pkdhISbo5Uzh` | 3情報源の個別銘柄言及 |
| `aria_tonight_predictions` | `E2LOJf7tbHIPtHzC` | 翌日予測の答え合わせ |

### Supabase（investment-dashboard）

| テーブル | 用途 |
|---|---|
| `aria_daily_requests` | 順一さんからの日次インプット |
| `aria_benchmark_insights` | 競合チャンネルのGemini分析結果 |

### GitHub（`trosystems1/aria-audio`）

- `memory/market_log.md` — 長期記憶・第2層
- `memory/rejected_solutions.md` — 失敗パターン記録
- 静的ファイル（フォント、BGM、ARIA挨拶音声、**ARIA映像mp4、bg_studio.png**）をGitHub Pagesでホスト

---

## 🔗 競合分析

### 経路

```
Vercel cron /api/cron/aria-benchmark（毎日19:00 UTC = 4:00 JST）
  → lib/aria-benchmark.ts
      ├─ @handle → チャンネルID解決
      ├─ RSS で最新動画1本を取得
      └─ Gemini（gemini-2.5-flash）で動画を直接解析
  → lib/aria-hub.ts saveBenchmarkInsights()
  → Supabase aria_benchmark_insights
  → /api/aria/benchmark-insights（GET）
  → n8n Fetch_Benchmark_Insights
  → Build_Claude_Prompt の benchmarkSection
```

**対象チャンネル**: ばっちゃま（`@bacchama`）、投資アスクワン（`@info_ask1`）

**未解決**: 投資アスクワンが25秒タイムアウトに間に合わない場合がある。頻発するようなら動画解析をやめてタイトル＋概要文のテキスト解析に切り替える。

---

## 🖥️ インフラ・クレデンシャル

- VPS: Hostinger `srv958101.hstgr.cloud`（72.60.64.54）
- n8n self-hosted v2.29.10（コンテナ `root-n8n-1`、ボリューム `n8n_data`）
- Docker Compose + Traefik（`/root/docker-compose.yml`）
- マウント: `n8n_data:/home/node/.n8n`、`/local-files:/files`
- investment-dashboard: Vercel（Hobby）+ Supabase + Next.js
- タイムゾーン: Asia/Tokyo

| 用途 | n8nクレデンシャル名 |
|---|---|
| Shotstack | `Shotstack` |
| Claude API | `Claude API` |
| Google Cloud TTS | `Google Cloud TTS` |
| hcti.io | `HCTI_API` |
| GitHub PAT | `GitHub PAT (aria-audio)` |
| YouTube | `YouTube account 3` |
| Google Drive | `Google Drive account` |
| LINE | `LINE Messaging API` |

> APIキーの値は本仕様書に記載しない。n8nのクレデンシャル画面で管理する。
> `meta-health withings` 系のワークフローにはSupabase service_roleキー等が平文で埋め込まれている（別途クレデンシャル化を推奨）。

---

## ⚠️ 運用上の鉄則

### publish を忘れない（最重要）

**2026-08-13に実害が発生**: `publish_workflow` を省いたセッションが続き、`Verify_Script_Facts` を含む複数日ぶんの修正が一度もactive versionに届いていなかった。同じ指摘が何度も再発していた根本原因はこれ。

- `update_workflow` 後は必ず `publish_workflow`
- **`versionId === activeVersionId` を確認するまで作業を終えない**
- UIでの保存も未publishのドラフトになる

### n8n UI での編集リスク

**2026-08-12に発生**: UIでPin dataを解除しただけのセッション中に、`Upload file` ノードから `operation: "upload"` が消失した。

- UIで開いたら、変更せず閉じる／編集はMCP経由
- 複数タブ・デバイスでの同時編集は競合の原因。MCP作業中は他デバイスのエディタタブを閉じる

### テスト実行

- `execute_workflow` はドラフトではなく**activeVersionを実行**する（「ドラフトで安全テスト」は成立しない）
- 本番でフル実行すると**実際にYouTubeへ公開投稿される**。安易に回さない
- Pin dataはテスト後に必ず解除し、再publish

### n8n式・APIの制約

- **式（`{{ }}`）内で `Buffer` は使えない**（Codeノード限定）。`Push_Market_Log_MD` がこれで壊れていた → `Build_Market_Log_Push_Body`（Codeノード）でbase64化する構成に変更
- Codeノードで `fetch()` / `$helpers.httpRequest()` の可否はバージョン依存
- `setNodeParameter`（パス指定）を使う。`updateNodeParameters` の `replace: True` は全パラメータ置換で危険
- `removeConnection` は `removeNode` の前
- `get_workflow_details` はクレデンシャルを常にnullで返す（セキュリティ仕様）
- `Merge_Before_Timeline` の `combineByPosition` は最短入力で発火。入力数と接続順に注意
- **Unicodeエスケープ破損**: 日本語を含む `update_workflow` で `\u` エスケープが1箇所でも壊れると、operations配列全体が文字列として扱われ**無音で失敗**する
- `get_execution` は `nodeNames` フィルタ＋`truncateData: 1` で必要ノードだけ取得する（全ノード取得はコンテキストを食い潰す）

---

## 🔴 2026-08-18 の指摘一覧（未着手・最優先）

8/18朝の動画（初めて新テロップ仕様で走った回）へのフィードバック。**誤読辞書以外はすべて未実装**。

### 画面（`Build_Shotstack_Timeline`）

| # | 指摘 | 原因の見立て |
|---|---|---|
| 1 | Agendaの青タイトルが上端に貼り付き | テロップには120px余白を入れたが、**Agenda画面に適用し忘れ**。全画面共通にする |
| 2 | テロップが右の窓際まで届く | 1行22文字が長い。窓を避けるなら18〜19文字 |
| 3 | 「ニュース」見出しが3回出る | `detectAgendaHeading` の判定が広すぎ、遷移文でない文まで拾っている |
| 4 | クロージングに全画面の黒透かし | CTAの背景ボックスが全画面に広がっている。**下部のみに限定する** |
| 5 | 為替チャートが緑のまま | **白（ニュートラル）への変更を実装し忘れ**（8/16に決定済み） |
| 6 | テロップが音声より約2秒早い | コーナー境界の時刻計算のズレ。中盤以降で拡大 |

### 台本（`Build_Claude_Prompt`）

| # | 指摘 |
|---|---|
| 7 | 1つ目のコーナーで「次に為替コーナーです」。日本語として不自然。1つ目は「まず」 |
| 8 | 「全面安」と言うが緑のタイルもある → 「全体的に株安」等に |
| 9 | 「最も大きく売られたのはMS」がヒートマップと矛盾（METAのほうが下落）。**台本が参照する個別株が主要5銘柄（NVDA/TSLA/MSFT/AAPL/GOOGL）に限られている疑い**。要確認 |
| 10 | SpaceX（+4%）が銘柄リストに入っていない |
| 11 | Agendaを「本日のニュースはこちらです」等に変更し、冒頭に「為替・株価指数」を追加 |

### TTS読み辞書（`Code in JavaScript`）

| # | 指摘 | 状態 |
|---|---|---|
| 12 | 「米国」「米30年債」の「米」を「コメ」と誤読 → 「ベイ」 | **8/18対応済み**（貼り付け＋publish待ち） |
| 13 | 「コスト増」→「コストゾウ」 | 同上 |

実装は `ttsR` に以下を追加。直前が漢字のときは変換しないため「日米」「欧米」「北米」は保護される。

```js
[/(^|[^一-龥])米(?=[一-龥ァ-ヶー0-9０-９])/g,'$1ベイ'],
[/コスト増/g,'コストゾウ'],[/需要増/g,'需要ゾウ'],[/供給増/g,'供給ゾウ'],
[/難しい/g,'むずかしい'],[/難しく/g,'むずかしく'],
[/スーパーマイクロコンピュータ[ー]?/g,'スーパーマイクロ'],
[/生産者物価指数/g,'生産者ぶっかしすう'],
```

---

## 🧩 `Build_Shotstack_Timeline` のノード分割（次回セッションの最初にやる）

### なぜ必要か

n8n MCPには**コードの部分置換が無く、`jsCode` は常に全文置換**。現在このノードは18KBあり、1文字直すにも全文を書き出す必要がある。会話が長くなるとClaudeが書き切れず、修正が止まる。実際に8/18のセッションではこれが理由で修正を持ち越した。

### 分割案

現状1ノードで性質の違う3つの仕事をしている。

| 新ノード | 担当 | 目安 |
|---|---|---|
| `Build_Telop_HTML` | テロップの折り返し・見出し・書式（`wrapJaPhrase` / `makeTelop` / `makeHeading` / `detectAgendaHeading`） | 5〜7KB |
| `Build_Board_HTML` | 為替ボード・指数表・Agenda・エンディングCTA | 5〜7KB |
| `Build_Shotstack_Timeline` | クリップの時刻計算とトラック構成、サムネtier判定 | 5〜7KB |

「テロップだけ直す」なら1ノードで済むようになる。

### 注意

**構造変更なので失敗すると翌朝の動画が出ない。** 時間に余裕のあるセッションの冒頭でやること。`removeConnection` → `removeNode` → `addNode` → `addConnection` の順序を守り、publish後に `versionId === activeVersionId` を確認する。

---

## 📅 残課題

### 🔴 第2段階（8/16セッションで仕様確定・未実装）

画面周り（第1段階）は8/16に適用済み。以下は台本生成（`Build_Claude_Prompt`）の改修を伴うため次回に持ち越し。

- [ ] **Agendaを番組の目次に変更**（現在は「本日のトピックス3つ」）。6項目・固定で3つ目だけ動的
  1. 為替/指数　2. 主要株価　3. ニュース（動的）　4. 日本の投資家への影響　5. 今後のイベント　6. クロージング
- [ ] **「今後のイベント」コーナーの新設**。控えている決算・経済指標。データは `Build_Earnings_Data` に既にある
- [ ] **オープニング挨拶の差し替え**。「どこよりも早く米国経済ニュースをAIの力でお届けします」→「**本日も米国経済ニュースを独自の目線でお届けします**」。※固定音声 `aria_opening.mp3` の作り直しが必要（Chirp3-HD-Sulafat）
- [ ] **為替コーナーを2画面構成に**。前半約30秒＝為替チャート画像（`Generate_Forex_Chart_Image`）で変動要因を解説 → 後半＝指数一覧の表。どちらもテロップなし・音声のみ。現在の `forex_corner` は「2文以内」制約なので前半/後半で別出力にする必要あり
- [ ] **指数一覧を `<table>` で新規作成**（`buildForexHeroHtml` を置換）
  - 5行: USD/JPY / **NYダウ** / S&P500 / NASDAQ / VIX（「DOW」ではなく「NYダウ」表記）
  - 1列目は左寄せ、値と前日比はセル内右寄せ。文字は可能な限り大きく。前日比はヒートマップと同じ赤緑
  - ⚠️ **`Build_Market_Summary` の改修が前提**。現在は `sp500Change` 等の変化率しか出力しておらず、**指数の値（終値）を持っていない**。`sp500Val` / `nasdaqVal` / `dowVal` の出力追加が必要
- [ ] **遷移文の表現を固定**。`detectAgendaHeading` が拾えるよう「次に{Agenda項目名}です。」の形に統一する指示を追加
- [ ] 1文38文字ルールを実際に効かせる（現状46文字が混入し、テロップが4行に膨らむ原因）

### 映像・レイアウト

- [x] ~~為替ボードのflex問題~~ → 第2段階の `<table>` 化で解消予定
- [ ] C群 市場ムード別b-roll（`bg_bull` / `bg_bear` / `bg_neutral`）の生成と、台本の「全体傾向」ラベルによる自動選択
- [ ] D群セクター素材・E群日本素材

### TTS読み辞書

- [ ] 「スーパーマイクロコンピュータ」の誤読（company/ticker読み辞書）
- [ ] 「難しい」→「ナンしい」誤読の矯正
- [ ] ドル円の小数読み（「164.40」→ 整数部は通常読み＋読点、小数部は各桁をかな。%の点読みは維持）
- [ ] 為替セリフ末尾「歌詞数です」＝誤読＋末尾切れの原因調査（正規化 / チャンク境界 / 尺のいずれか）

### コンテンツ品質

- [ ] news_cornerの話題重複（同じ大型ニュースの繰り返し）
- [ ] **指標の単位混在**。8/15の台本に「前回マイナス0.4%だったCPIが今回3.4%に戻した」という前月比と前年比を並べた比較が混入。`Verify_Script_Facts` は方向のみ見るため検知できない。単位・期間の整合チェックの追加を検討

### 運用・整理

- [ ] 手動実行（`5904` / `5937` / `5968`）が連続でerrorになっている件の原因調査
- [ ] YouTubeショート系ノードがv3に残存しているか未確認（8/15実行では発火せず）
- [ ] `aria_subscribe.mp4` はリポジトリに残存するが未参照。整理可
- [ ] `ARIA_Benchmark_Ingest`（`PpKB1aOogZwONw9B`）は旧経路。アーカイブ推奨
- [ ] `TEMP_GitHub_Access_Test`（`2XNYCBUvTJ3oPCT8`）は作業用。整理推奨
- [ ] `meta-health withings-LINE` の `Send LINE` ノードが無効化されたまま
- [ ] VPS `/root/n8n_backup_20260710.tar.gz`（2.0GB）の削除
- [ ] GitHubへのv3ワークフローJSONバックアップ（`trosystems1/n8n-workflows-US_Market_Intelligence_Report_movie`）
- [ ] 中島聡さんメルマガの過去バックフィル（6/22〜5/4の約8通）
- [ ] `/watchlist` トップへの「ARIA編集デスク →」リンク追加（GitHub API Base64エラーで保留）

---

## 🔍 翌朝の確認ポイント

| 項目 | 確認場所 | 期待値 |
|---|---|---|
| ニュース原稿が読めたか | LINE通知の有無 | 通知が来ていない |
| 事実検算 | LINE通知の有無 / `Verify_Script_Facts` | 空配列 |
| サムネイル選択 | `Build_Shotstack_Timeline` の `thumbnailTierSource` | `claude` |
| テロップ同期 | `Code in JavaScript1` の `timingMode` | `per_chunk` |
| アセット版 | `assetVer` | `20260816a` |
| 総尺 | `timeline` | 188秒前後（リング廃止で8秒短縮） |
| テロップ | 動画を目視 | 56px・上余白あり・文節で改行・最大4行 |
| コーナー見出し | 動画を目視 | 「主要株価」等の項目名だけが中央に大きく出る |
| エンディング | 動画を目視 | 新しい月の映像＋下部にCTAのみ |
| YouTube投稿 | `Upload a video` | `uploadId` が返る |
| サムネ設定 | `Set_YouTube_Thumbnail` | `youtube#thumbnailSetResponse` |
| market_log.md更新 | `Push_Market_Log_MD` | 成功 |
| 競合分析 | `Fetch_Benchmark_Insights` | `insights` に1件以上 |
| 配信曜日 | 実行履歴 | 火〜土のみ。日・月は実行されない |
