@AGENTS.md

# Scottish Rugby Leaderboard — Project Context

Single-page Next.js app (App Router, no routing) that reads a publicly shared Google Sheet via CSV export and displays a live-updating leaderboard. No backend — everything runs client-side.

## Stack
- Next.js 16.2.4, React 19, TypeScript, Tailwind CSS v4
- PapaParse (CSV), html-to-image + jsPDF (PDF export)

## Sheet contract
Columns must be: `Date`, `Name`, `Position` (case-insensitive), then any number of metric columns. Metrics are discovered dynamically. CSV URL format: `https://docs.google.com/spreadsheets/d/{id}/export?format=csv&gid={gid}`

## Key files
- `app/page.tsx` — all state and orchestration lives here
- `app/globals.css` — Tailwind v4 theme + all custom CSS animations
- `components/LeaderboardTable.tsx` — ranked rows, bar chart, rank-change arrows, 2/3-column layout
- `components/PodiumView.tsx` — top-3 podium (presentation mode only)
- `components/LeaderboardControls.tsx` — filter panel
- `lib/leaderboard.ts` — filtering and ranking logic
- `lib/csv.ts` — PapaParse wrapper
- `lib/googleSheets.ts` — URL parsing and CSV export URL builder
- `types/leaderboard.ts` — all shared types

## Styling conventions
- Theme tokens: `bip-bg`, `bip-surface`, `bip-panel`, `bip-border`, `bip-accent`, `bip-text`, `bip-muted`
- Dark navy bg (`#080e1a`), sky-blue accent (`#38bdf8`), Geist fonts
- All new CSS animations go in `app/globals.css`

## Key behaviours
- Auto-refresh every 15s; rank-change arrows shown 30s after refresh
- New-leader detection triggers fullscreen overlay + Web Audio brass sound
- Presentation mode: fullscreen, hides all controls, enables podium toggle
- PDF export pauses animations via `.export-snapshot` class
- Last-used sheet URL persisted in localStorage
