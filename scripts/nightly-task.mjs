import { mkdirSync, writeFileSync } from "node:fs";

// JSTの日付を取得
const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
const date = jst.toISOString().slice(0, 10);

mkdirSync("tasks", { recursive: true });

// ─────────────────────────────────────────────
// ここに夜間タスクのロジックを追加していく
// 現在はプレースホルダー。後からショート動画生成に差し替え。
// ─────────────────────────────────────────────

// TODO: ショート動画生成ロジック（実装予定）
// 1. n8n APIから当日のmarket_corner音声URLとヒートマップ画像URLを取得
// 2. Shotstackで縦型(720×1280)ショート動画をレンダリング
// 3. YouTube Shorts APIで投稿
// 4. 結果をtasks/{date}.mdに記録

const content = `# ${date} 夜間タスク

## ステータス
- [x] スクリプト実行完了
- [ ] ショート動画生成（未実装）

## ログ
- 実行時刻: ${jst.toISOString().replace("T", " ").slice(0, 16)} JST

_generated at ${jst.toISOString().replace("T", " ").slice(0, 16)} JST_
`;

writeFileSync(`tasks/${date}.md`, content);
console.log(`tasks/${date}.md を生成しました`);
