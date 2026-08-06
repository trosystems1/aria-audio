# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`aria-audio` is currently a minimal scaffold for an automated nightly job (project "ARIA") that will eventually generate short-form vertical videos and publish them to YouTube Shorts. As of now, only the scaffolding and a placeholder task logger exist — the actual video generation pipeline is not implemented yet (see TODOs in `scripts/nightly-task.mjs`).

There is no package.json, no dependency manifest, and no test suite. `scripts/nightly-task.mjs` is a plain Node.js ES module script run directly with `node` (no build step, no npm install required).

## Commands

- Run the nightly task script manually: `node scripts/nightly-task.mjs`
- There is no lint, build, or test command configured in this repo.

## Architecture

- **`scripts/nightly-task.mjs`** — the only piece of logic in the repo. It:
  1. Computes "today" in JST (`Date.now() + 9h` offset, not `Intl`-based).
  2. Writes a status log to `tasks/{YYYY-MM-DD}.md` recording that the script ran.
  3. Is a placeholder — the comments in the file document the intended future pipeline: fetch the day's `market_corner` audio URL and heatmap image URL from an n8n API, render a 720×1280 vertical short via Shotstack, publish it via the YouTube Shorts API, then record the result in `tasks/{date}.md`.
- **`.github/workflows/nightly.yml`** — GitHub Actions workflow, cron-scheduled at UTC 17:00 (JST 2:00 AM) plus manual `workflow_dispatch`. It checks out the repo, sets up Node 20, runs `node scripts/nightly-task.mjs` with `SHOTSTACK_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` as env secrets (unused today, reserved for the future pipeline), then commits and pushes any new/changed files under `tasks/` back to `main` with `[skip ci]`.
- **`tasks/*.md`** — auto-generated, one file per day, committed by the CI job itself. Treat these as generated logs, not hand-authored content; don't hand-edit historical entries.
- **Root media/asset files** (`aria_opening.mp3`, `News Theme 1 - Audionautix.mp3`, `NotoSansJP-Bold.ttf`, `qr_code.png`) — raw assets staged for the future video-rendering pipeline (opening jingle, background music, a Japanese-supporting font for on-screen text, and a QR code overlay). They aren't referenced by any code yet.

## Working conventions specific to this repo

- Comments and generated log content in this repo are written in Japanese; match that style when editing `scripts/nightly-task.mjs` or files under `tasks/`.
- The CI workflow pushes directly to `main` from within the Action — be aware of this when reasoning about history on `main`, since automated commits interleave with human ones.
- When implementing the real pipeline (n8n fetch → Shotstack render → YouTube publish), follow the TODO steps already outlined in `scripts/nightly-task.mjs` rather than redesigning the flow, unless asked otherwise.
