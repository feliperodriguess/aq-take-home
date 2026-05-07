@AGENTS.md

# AI Interviewer Platform — Working Agreement

This take-home is time-boxed (4 hours total). Optimize for shipping a working, polished demo over architectural perfection. The full design lives in `specs/00-architecture.md` through `specs/05-session-and-evaluation.md` — read the relevant spec before touching code in that area.

## Stack & purposes

| Tech | Purpose |
|---|---|
| **Next.js 16.2.5** (App Router, RSC) | Framework. Server Components by default, client islands only where needed (mic, audio). Read `node_modules/next/dist/docs/` before using any Next API — Next 16 has breaking changes vs older training data (async `params`, `RouteContext`, Cache Components). |
| **React 19** | UI library. Server Components + `useTransition`/`useReducer` for the interview state machine. |
| **TypeScript** | All source. Treat type errors as build failures — no `any` escapes. |
| **Tailwind v4 + shadcn/ui** (Base UI under the hood) | Styling + component primitives. All new UI uses these — never hand-roll classes that duplicate shadcn primitives. Add new shadcn components with `pnpm dlx shadcn add <name>`. |
| **Phosphor Icons** (`@phosphor-icons/react`) | Iconography. |
| **Drizzle ORM 0.45 + Neon Postgres** (`@neondatabase/serverless`) | Persistence. Schema in `src/db/schema.ts`; migrations via `pnpm db:migrate`; seed via `pnpm db:seed`. |
| **Zod v4** | Validation everywhere — env (`src/lib/env.ts`), API request/response shapes, OpenAI Structured Outputs schemas. Optional fields passed to OpenAI MUST be `.optional().nullable()`. |
| **OpenAI** (`openai` v6) | The "interviewer brain" + final evaluator. Use the Responses API + `zodTextFormat()` for Structured Outputs. Default model `gpt-4.1` via `OPENAI_INTERVIEW_MODEL` / `OPENAI_EVAL_MODEL` env vars. |
| **ElevenLabs** (`@elevenlabs/elevenlabs-js`) | Voice — both directions, single vendor. STT via `speechToText.convert({ modelId: "scribe_v2" })`; TTS via `textToSpeech.convert(voiceId, { modelId: "eleven_flash_v2_5", outputFormat: "mp3_44100_128" })`. |
| **Biome 2.2** | Lint + format. Single tool, no ESLint/Prettier. |
| **Vercel** | Deployment target. Node runtime only (Edge breaks the ElevenLabs SDK's Node primitives). |

## Workflow rules

### Before writing code with any library/SDK
**When in doubt about an API, query [Context7](https://context7.com)** — your training data may not reflect the latest version.
- MCP: `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`.
- CLI fallback (verify availability with `ctx7 --version`): `ctx7 <library> "<query>"`.

This applies especially to: Next.js 16, Drizzle, OpenAI Responses API, ElevenLabs SDK, shadcn (component install commands evolve), Tailwind v4 (config moved to CSS).

### UI components
1. **Consult the UI handoff first.** Bundle lives at `/Users/felipe/dev/afterquery/iris-ai-ui-handoff/` — see the dedicated section below before writing any UI.
2. **Use Tailwind + shadcn/ui.** Compose with existing primitives (`Button`, `Card`, `Dialog`, `Toast`, etc.). Add missing primitives via `pnpm dlx shadcn add <name>` — don't reinvent them. Where the handoff has its own primitive (e.g. `IrisAvatar`, `AccentLine`, `Pill` with semantic tones), build a thin component matching the handoff's API rather than forcing a shadcn equivalent.
3. Filename convention is **kebab-case** (`mic-button.tsx`, `score-header.tsx`); the exported component identifier stays PascalCase (`export function MicButton()`).
4. **Component files are capped at 250 lines.** When a `.tsx` file approaches the limit, split it: extract sub-components into siblings, pull pure helpers into `src/lib/<feature>/`, and lift side-effectful logic into custom hooks under `src/app/<route>/_hooks/`. Multi-level ternary chains (`a ? b : c ? d : e ? f : g`) are a smell — replace them with a small helper using a sequence of `if` statements that read top-to-bottom.

### Verifying features in the browser
After implementing or fixing a flow that's hard to validate via types alone (mic capture, audio playback, navigation, state machine transitions), drive the browser via the **Playwright MCP** (`mcp__playwright__browser_*` tools) to confirm the path works end-to-end before committing.

### Pre-commit checks (every commit)
Run these in order, fix everything they surface, then commit:
```bash
pnpm biome check --write   # lint + auto-fix + format in one pass
pnpm tsc --noEmit          # TypeScript: zero errors
pnpm build                 # only if you suspect Next-specific issues; skip otherwise
```
- Biome warnings count as errors. If a rule genuinely doesn't apply, disable it locally with a `// biome-ignore` and a 1-line reason — don't suppress globally.
- TypeScript errors block the commit. Fix the type, don't widen to `any`.

### Commit cadence
Commit **as you go**, in the smallest coherent units possible. The target is a focused diff a reviewer can hold in their head — typically a single feature, a single route, a single refactor stage, or one logical layer of a wave. Concretely:

- **Aim for ~5–10 files per commit.** When a change touches more than ~15 files, split it: routes vs. UI, schema vs. consumers, helpers/hooks vs. the components that use them, refactor moves vs. behaviour changes.
- **Never bundle "everything I did this session" into one commit.** A wave from `specs/00-architecture.md` is *multiple* commits — one per track at minimum, often more.
- **Refactors get their own commits.** Don't sneak a rename or extraction into a feature commit.
- **Each commit must compile and biome-clean on its own.** It's fine if an intermediate commit doesn't render a working app end-to-end (e.g. a helper before its consumer) as long as the tree builds.

A feature is one of: a finished spec wave, a working UI flow, a passing route handler, etc. Use the **GitHub CLI** (`gh`) for branch/PR operations as needed:
```bash
gh repo view              # sanity-check we're on the right repo
gh pr create --fill       # if working on a branch
```

Commit message format:
```
<area>: <imperative summary>

<optional body explaining what + why, not how>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```
Examples:
- `db: add jobs/sessions/turns/evaluations schema + seed`
- `interview: wire push-to-talk to /api/stt`
- `engine: structured outputs + decision-panel signals`

Push to GitHub at every commit so progress is recoverable.

## UI handoff — "Iris"

The product has a real design. Bundle path:

```
/Users/felipe/dev/afterquery/iris-ai-ui-handoff/
├── README.md
└── project/
    └── interviewer/         ← THIS is the relevant subfolder for our build
        ├── index.html       ← entry point; lists asset/script load order
        ├── tokens.css       ← design tokens (CSS custom properties)
        ├── primitives.jsx   ← Button, Pill, Card, Input, AccentLine, Logo, IrisAvatar, Icon
        ├── data.jsx         ← sample jobs / packs / rubrics (reference only — we use our own seed data)
        ├── JobsView.jsx     ← jobs list (matches our spec 02)
        ├── InterviewRoom.jsx← interview UX (matches our spec 03)
        ├── ResultsView.jsx  ← results page (matches our spec 05)
        ├── App.jsx          ← page router/shell
        └── tweaks-panel.jsx ← design-time tweaks (NOT shipped — ignore)
```

**Read the handoff `interviewer/index.html` and `tokens.css` end-to-end before building any UI. Follow imports — open every `.jsx` file referenced.** The handoff is HTML/CSS/JS prototype (React + Babel via CDN); our job is to recreate it pixel-faithfully in our Next.js + Tailwind v4 + shadcn stack. **Do not** copy the prototype's inline-styles or runtime structure — copy the visual output and component anatomy.

### Brand & tone
- **Persona name:** "Iris". Use it in copy ("Iris will ask you 6–8 questions…", "Generated by Iris", etc.).
- **Voice/feel:** editorial, warm, candid. Magazine layout: small uppercase mono eyebrow → display-serif headline with one italicized accent word → apricot full-stop. Example: `Pick a role. Step inside.` (with "Step inside" italicized and "." in apricot.)

### Translating tokens to Tailwind v4
The handoff defines tokens as CSS custom properties in `interviewer/tokens.css`. Port them to **Tailwind v4's `@theme` directive** in `src/app/globals.css` so they're usable as utility classes (`bg-bg-raised`, `text-fg-2`, `border-border-default`, `text-accent`, etc.).

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-bg-canvas: #14110f;
  --color-bg-raised: #1c1916;
  --color-bg-hover:  #252119;
  --color-bg-tint:   rgba(244,162,97,0.06);

  --color-border-subtle:  #221f1c;
  --color-border-default: #2d2925;
  --color-border-strong:  #3d3833;

  --color-fg-1: #f5efe6;
  --color-fg-2: #c9c0b0;
  --color-fg-3: #8a8174;
  --color-fg-4: #5a5246;

  --color-apricot-300: #f8c89f;
  --color-apricot-500: #f4a261;
  --color-apricot-600: #e8924a;
  --color-accent:      #f4a261;       /* alias of apricot-500 */
  --color-accent-soft: rgba(244,162,97,0.10);

  --color-pass: #9bc26b;
  --color-warn: #e9b04a;
  --color-fail: #d97a6a;
  --color-info: #8ba5d6;

  --font-display: "Instrument Serif", "Times New Roman", serif;
  --font-ui:      "Inter", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
```

For v1 we ship **dark theme only** (the handoff's default). The light variant and tweaks panel are out of scope.

### Fonts
Load via `next/font/google` in `app/layout.tsx`:
- `Inter` (weights 400/500/600/700) → CSS var `--font-ui`
- `Instrument_Serif` (weight 400, italic) → CSS var `--font-display`
- `JetBrains_Mono` (weights 400/500/600) → CSS var `--font-mono`

Wire them into `<html>`'s class list and reference via `font-display`, `font-ui`, `font-mono` Tailwind utilities (or directly via `font-family: var(--font-display)` in CSS).

### Component recreation map
For each handoff component, build a kebab-cased file under `src/components/ui/`. Match the visible API but adapt the implementation idiomatically:

| Handoff `primitives.jsx` | Our file | Notes |
|---|---|---|
| `Button` (kinds: primary, secondary, ghost, danger, soft × sm/md/lg) | `src/components/ui/button.tsx` (extend the existing shadcn one) | Add the 5 kinds + soft variant via `cva` |
| `Pill` (tones: neutral, accent, info, pass, fail, warn; with optional dot) | `src/components/ui/pill.tsx` | New |
| `Card` (hover variant) | `src/components/ui/card.tsx` | shadcn `card` + hover variant |
| `Input` (mono variant) | `src/components/ui/input.tsx` | shadcn `input` + `mono` prop |
| `AccentLine` | `src/components/ui/accent-line.tsx` | Tiny presentational |
| `Logo` (orb + "Iris" wordmark) | `src/components/brand/logo.tsx` | Reuses `apricot-*` tokens |
| `IrisAvatar` (pulsing orb) | `src/components/brand/iris-avatar.tsx` | Has `speaking` boolean |
| `Icon` (custom SVG inline set) | **skip** — use `@phosphor-icons/react` already installed | Map: `mic` → `Microphone`, `micOff` → `MicrophoneSlash`, `arrowright` → `ArrowRight`, `chevright` → `CaretRight`, `sparkle` → `Sparkle`, `waveform` → `WaveSawtooth`, `clock` → `Clock`, `check` → `Check`, `x` → `X` |

### View-by-view notes
- **`JobsView.jsx` → spec 02 (`/`)**: 2-column magazine grid with the first card "featured" (taller, larger title). Each card has company eyebrow + duration pill + title + blurb + 3 skill chips + "Begin →" link. We ship 3 jobs, not the handoff's 6 — pick the 3 closest to your spec 01 seed (FE Eng / BE Eng / PM).
- **`InterviewRoom.jsx` → spec 03 (`/interview/[id]`)**: ⚠️ The handoff layout is **centered** — pulsing apricot orb in the middle, current question rendered as large display-serif beneath, live transcript and decision panel as collapsible side rails. **This supersedes the side-panel-only layout sketched in spec 03.** Keep the FSM and contracts from spec 03, but match the handoff's visual composition.
- **`ResultsView.jsx` → spec 05 (`/sessions/[id]`)**: editorial header with eyebrow + display headline, then a 260px score card + summary card row, then strengths/concerns two-column, then per-rubric competency table, then full transcript, then collapsible raw JSON. Talk-ratio bar is a nice touch — include it, it's cheap.

### Out of scope (skip from the handoff)
- `tweaks-panel.jsx` — design-time only.
- Light theme — dark only for v1.
- Camera/video mode — stretch goal #3, deferred.
- History view (`HistoryView` in `App.jsx`) — stretch goal #4, deferred.
- 6 jobs — we ship 3 (spec 01).

### When in doubt
The handoff's HTML/CSS/JS is the source of truth for visual decisions; our specs are the source of truth for behavior, contracts, and persistence. If they conflict, **handoff wins on visuals, specs win on logic**. Flag any contradiction back to the user before implementing.

## Spec → code mapping

| Spec | What it covers |
|---|---|
| `specs/00-architecture.md` | Stack, env, contracts, file layout, deploy |
| `specs/01-data-and-question-packs.md` | Drizzle schema, Zod types, pack JSON format |
| `specs/02-jobs-catalog.md` | `/` page + `start-session` Server Action |
| `specs/03-interview-room-ui.md` | `/interview/[id]` UI, FSM, mic, decision panel |
| `specs/04-backend-routes.md` | `/api/stt`, `/api/tts`, `/api/interview/turn` (LLM engine) |
| `specs/05-session-and-evaluation.md` | `/api/interview/end`, evaluation, `/sessions/[id]` results |
