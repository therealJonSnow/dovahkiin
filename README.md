# Dovahkiin

An RPG-style skill tree for a baby's first two years, built so dads can see what's been unlocked, what might be ready now, and what to prepare before the next big moment. It's inspired by Skyrim's constellation perk trees: a nebula sky, star nodes and lit-up connector lines.

> Not a medical tool, and not a checklist to stress about. Age ranges are broad and every baby takes their own route.

- **Astro** (static output) with **Svelte 5** islands, TypeScript strict
- Content lives in `src/content` as Markdown/YAML, edited through **Sveltia CMS** at `/admin`
- Deployed on **Vercel**. Every commit to `main` rebuilds the site.
- No accounts, no server, no trackers. The baby's details and progress stay in the browser (`localStorage`).

## Quick start

```sh
pnpm install
pnpm dev            # http://localhost:4321
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Dev server. Drafts are visible here. |
| `pnpm validate` | Checks content: references, cycles, ages, ids, banned words |
| `pnpm build` | `validate`, then `astro build` into `dist/`. Drafts are excluded. |
| `pnpm check` | `astro check` + `svelte-check` |
| `pnpm test` | Vitest unit tests (state rules, age maths, layout, storage, validation) |
| `pnpm test:e2e` | Build, then the Playwright smoke and accessibility tests (desktop and 375px mobile) |

## Editing content (Sveltia CMS)

Open **`/admin`** on the live site.

1. **Sign in with a token**: create a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new) for `therealjonsnow/dovahkiin` with **Contents: read and write** and **Pull requests: read and write**. Then choose *Sign In Using Access Token*.
2. Edit milestones, branches, age bands or site settings, then save. Sveltia commits to `main`, and Vercel rebuilds.
3. If the content is invalid (a cycle, a missing prerequisite, bad ages), the Vercel build fails with a readable list of problems and the live site stays as it was. Fix it in the CMS and save again.

Locally, `pnpm dev` and then `/admin` → **Work with Local Repository** (Chromium browsers) edits the files on disk with no token needed.

Later, for proper GitHub OAuth, deploy the [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) and set `backend.base_url` in `public/admin/config.yml`. To review edits before they publish, enable `publish_mode: editorial_workflow` there.

### Content rules

- **Ages are in weeks** (0–104). 4w ≈ 1m · 13w ≈ 3m · 26w ≈ 6m · 39w ≈ 9m · 52w ≈ 12m · 78w ≈ 18m · 104w = 24m.
- **Ids are forever.** A milestone's `id` is its file name, its `/skills/<id>` URL, and the key saved progress uses. Quests have their own `id` too, so you can reorder them without losing anyone's ticks.
- **Tiers**: `minor` = small star, `major` = large star, `keystone` = diamond. Keystones need `gameText`.
- **Prerequisites** draw the constellation lines. Links across branches are allowed and drawn dashed.
- **Quests**: `prepare` surfaces `leadWeeks` before the window opens (default 4). `safety` is highlighted and surfaces `leadWeeks` before (default 2). `play` shows while the skill is ready.
- **Tone**: `gameText` is one or two lines in an RPG/system-log voice. Descriptions are plain English in 1–3 short paragraphs with UK spelling. Don't use *should, late, behind, delayed, normal range*: the validator warns about them.
- `draft: true` keeps a milestone off the live site. A published milestone can't depend on a draft.

## How the tree decides a skill's state

Implemented in `src/lib/state.ts` and covered by unit tests. Rules are evaluated in order:

| State | Rule |
| --- | --- |
| **unlocked** | Marked by the parent (or marked as *skipped*, which counts as satisfied) |
| **ready** | All prerequisites satisfied **and** age ≥ window start − `readyLeadWeeks` (2). It **stays ready** past the window end. Nothing ever shows as overdue. |
| **waiting** | Old enough, but a prerequisite isn't satisfied yet ("unlocks after…") |
| **upcoming** | The window opens within `horizonWeeks` (8) |
| **locked** | Everything else |

Choices I made to close gaps in the spec:

- **`waiting` state.** In the spec, the `upcoming` rule had no lower bound, so a skill whose window was long past but whose prerequisites weren't done would show as "upcoming". It now gets its own state, with an hourglass icon and "Unlocks after a prerequisite".
- **Unlocking out of order** offers to tick **every pending ancestor at once** (for example, Walks → Pulls to stand → Crawls → Sits…). The choices are *Yes, unlock them too* or *No, they skipped them*. Skipped skills render as hollow stars and count toward the level.
- **Undo** removes just that skill. Anything that depends on it stays unlocked, because babies skip things.
- **Stale quests**: prepare and safety quests stay listed until they're done, unless the skill is already unlocked *and* its window has passed. This keeps the catch-up for an older baby from flooding "Up next".
- **Corrected age** is used when the due date is more than 2 weeks after the date of birth, until the baby's *actual* age reaches 24 months. Before the due date, age is clamped to 0.
- **Past 24 months** the today line sits at the top with "Tree complete".
- **Explore mode** pretends everything whose window has opened is unlocked, so the wave lights up as you scrub. It never touches saved progress.

## How the app is laid out

- **Overview first.** The app opens on a zoomed-out view of all six skill families side by side, with no sidebar. Each family is a card showing its progress, how many skills are ready, and a mini constellation. Every card shares one age scale, so the today line runs straight across them all.
- **One family at a time.** Clicking a card zooms into that family's carousel slide: a full-size constellation of just its skills. Arrows, the family dots, or a horizontal swipe move to the neighbouring family (it wraps round). *All families*, Escape or the browser's Back button zooms out again. The focused family is kept in the URL (`/?family=body`), so it survives a reload and can be shared.
- **Sidebar only when zoomed in** (desktop, 1024px and up). It describes the focused family and lists what's ready, what to prepare and what's on the horizon in it. Opening a skill shows its details there instead. On phones and tablets, details open in a bottom sheet.
- **Up next** (everything across families) opens from the HUD.
- **The tree grows upwards.** Birth is at the bottom and 24 months at the top, so progress climbs. Each band's label sits at its lower edge, where its ages start.
- **Windows, not dates.** Every star has a soft glow rising from it to `ageWeeksMax`, in the overview and in each family, so the tree shows ranges rather than points (hover or select a skill to brighten its glow and see the range). Skill details open with a 0–24 month range meter (`WindowMeter.svelte`) with today marked on it and a gentle note about where today sits in the window.

## Project structure

```
src/
  content.config.ts        # collections → shared Zod schemas
  content/                 # branches/*.yml, milestones/*.md, bands/bands.yml, settings/site.yml
  lib/
    schemas.ts             # Zod schemas (used by Astro and the validator)
    validate.ts            # pure content checks (cycles, refs, ages, ids, banned words)
    layout.ts              # build-time layout model: bands, columns, zig-zag, edges (y grows upwards)
    state.ts               # pure state rules, Up next, levels, XP
    age.ts                 # DOB / corrected-age maths (UTC calendar dates)
    storage.ts             # localStorage `levelup:v1`, migrations, import/export
    app.svelte.ts          # reactive store (Svelte 5 runes)
    nebula.ts              # WebGL sky (lazy, reduced-motion and low-power aware)
    particles.ts           # unlock burst (lazy, skipped with reduced motion)
  components/              # App, Hud, Overview, FocusView (carousel), FamilyPanel (sidebar),
                           # tree/*, NodeDrawer, NodeDetail, UpNext, UpNextDialog, Onboarding, …
  pages/                   # index, skills/[id] (static, no JS needed), about, 404
  i18n/en.json             # every UI string
public/admin/              # Sveltia CMS
scripts/validate-content.ts
tests/unit, tests/e2e
```

The layout is computed at build time (`layouts.all` for the overview, plus one single-column layout per family for the carousel) and passed to the island as JSON, so positions are deterministic and the client does very little work.

## Deploying on Vercel

Import the repository in Vercel. `vercel.json` sets `pnpm build` and `dist/`. No environment variables are needed. Set `SITE_URL` if you want absolute URLs (for example, in Open Graph tags) before Vercel's own production URL is available.

## Quality bar (as built)

- Lighthouse (mobile, local production build): Performance 91–99, Accessibility 100, Best Practices 100, SEO 100
- axe-core WCAG 2.2 A/AA scan has no violations in the dark and light themes (Playwright `axe.spec.ts`)
- Island JS is about 46 KB gzipped. The nebula (about 2 KB) and particles (under 1 KB) are lazy-loaded.
- Keyboard: overview cards are buttons; in a family, arrow keys move between nodes, Enter opens a node, Esc closes it (focus returns to the node), and a second Esc zooms back out to the overview
- `prefers-reduced-motion`: no pulsing, no particles, a still sky, and fades only

## Open items for Jonny

- **Check every age window and source link.** The 20 seed milestones are drafts based on the CDC, WHO, NHS and Lullaby Trust pages they cite. Those sites couldn't be reached from the build environment, so none of the URLs or windows have been checked live.
- **Socket covers**: the seed quest says *not* to use plug-in covers on UK sockets (they have built-in shutters, and covers can defeat them). Adjust it if you're targeting other markets.
- **Finger foods** uses *Sits without support* and *First tastes* as prerequisites rather than *Pincer grasp*, because NHS guidance has finger foods from around 6 months, well before a pincer grip.
- Final name and domain, and replacing the placeholder Lucide icons with your own artwork (swap them in `src/lib/icons.ts` by key).
