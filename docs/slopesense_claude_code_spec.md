# Slopesense — Claude Code Spec (MVP)

## Project overview

**Slopesense** is a public web app for trail runners to analyze GPX route files. The user uploads a `.gpx` file, the app parses it client-side, identifies climb and descent sections by gradient, and renders an interactive elevation profile plus a sortable table of significant sections with runability classification.

**Target user:** ultra-trail runner doing race recon. They want to understand "where will I run, where will I hike, where will quads get destroyed" *before* the race, not during it.

**MVP scope:**
- Single-page app, no auth, no DB, no backend persistence
- Upload GPX → analyze → visualize
- All processing client-side (privacy + zero server cost)
- Mobile-responsive (runners check this on the phone)

**Deferred (not MVP):**
- User accounts, race library, saved analyses
- MCP server for AI queries
- Multi-route comparison
- Pace prediction based on user profile

## Tech stack

- **Framework:** Next.js 15 (App Router), TypeScript strict mode
- **Styling:** Tailwind CSS 4
- **Charting:** Chart.js 4 with `react-chartjs-2`
- **GPX parsing:** vanilla `DOMParser` (no library needed — keeps bundle small)
- **Deployment:** Vercel
- **Package manager:** pnpm
- **Node:** 22 LTS

No state library, no form library — useState is enough. No server actions in MVP.

## Project structure

```
slopesense/
├── app/
│   ├── layout.tsx           # Root layout, Tailwind import, metadata
│   ├── page.tsx             # Main analyzer page (client component)
│   ├── globals.css          # Tailwind directives
│   └── api/
│       └── (none in MVP)
├── components/
│   ├── GpxUpload.tsx        # Drag-drop + file input
│   ├── ElevationChart.tsx   # Chart.js wrapper with descent overlay
│   ├── SectionTable.tsx     # Sortable table of climbs/descents
│   ├── RouteStats.tsx       # Summary card: total dist, D+, D-, max ele
│   └── SectionDetail.tsx    # Clicked-section detail panel
├── lib/
│   ├── gpx.ts               # Parse GPX → trackpoints
│   ├── geo.ts               # Haversine, distance calc
│   ├── analyzer.ts          # Smooth, bucket, classify sections
│   ├── types.ts             # Shared TS types
│   └── classify.ts          # Runability classification rules
├── public/
│   └── sample.gpx           # Optional: bundled sample for "try it" button
├── tests/
│   └── analyzer.test.ts     # Vitest unit tests for core logic
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── vitest.config.ts
├── .gitignore
├── .nvmrc                   # 22
└── README.md
```

## Core algorithm (lib/analyzer.ts)

The analysis logic is the heart of the product. It must be **pure functions, fully unit-tested, no DOM or framework dependencies**. UI calls `analyze(trackpoints)` and gets back a typed result.

### Steps

1. **Parse GPX → `Trackpoint[]`**
   - `{ lat: number; lon: number; ele: number }`
   - Reject if fewer than 10 points or no elevation data, with clear error message

2. **Compute cumulative distance** using haversine. Returns `number[]` parallel to trackpoints (meters).

3. **Smooth elevation** with 5-point moving average to reduce GPS noise. Returns `number[]` parallel to trackpoints. Edge points use the original value.

4. **Bucket into 500m segments.** For each bucket: start km, end km, elevation start, elevation end, gradient %.
   - Configurable bucket size (default 500m, allow 250/500/1000 in code constants)

5. **Aggregate continuous sections.** Walk through buckets; group contiguous buckets with the same direction (climb if grade > +2%, descent if grade < -2%, otherwise flat/transition). A section is "continuous" if consecutive buckets share direction.

6. **Classify each section** by avg gradient using `classify.ts` rules.

### Classification rules (lib/classify.ts)

Asymmetric thresholds — descents and climbs feel different:

```typescript
export type Runability = 'runnable_easy' | 'runnable_mod' | 'tough_run' | 'mixed' | 'hike_only' | 'very_steep';

export function classifyDescent(absGrade: number): Runability {
  if (absGrade < 5) return 'runnable_easy';
  if (absGrade < 8) return 'runnable_mod';
  if (absGrade < 12) return 'tough_run';
  if (absGrade < 15) return 'mixed';
  if (absGrade < 20) return 'hike_only';
  return 'very_steep';
}

export function classifyClimb(absGrade: number): Runability {
  if (absGrade < 4) return 'runnable_easy';
  if (absGrade < 7) return 'runnable_mod';
  if (absGrade < 10) return 'tough_run';
  if (absGrade < 14) return 'mixed';
  if (absGrade < 20) return 'hike_only';
  return 'very_steep';
}
```

These constants live in one place so they're easy to tune later.

### Output type (lib/types.ts)

```typescript
export interface Trackpoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface Section {
  type: 'climb' | 'descent' | 'flat';
  kmStart: number;       // 0-indexed, km from start
  kmEnd: number;
  distanceKm: number;    // end - start
  elevationStart: number;
  elevationEnd: number;
  drop: number;          // always positive, m
  avgGrade: number;      // signed, %
  maxGrade: number;      // signed, %
  classification: Runability;
}

export interface RouteAnalysis {
  totalDistanceKm: number;
  totalAscent: number;          // D+, m
  totalDescent: number;         // D-, m
  highestPoint: { km: number; ele: number };
  lowestPoint: { km: number; ele: number };
  sections: Section[];          // all, including flats
  profile: ProfilePoint[];      // sampled for chart
}

export interface ProfilePoint {
  km: number;
  ele: number;
  grade: number;       // signed %, computed over preceding 500m
}
```

## UI requirements

### Layout

Single page, no routing. Three states based on whether a GPX is loaded:

1. **Empty state:** centered upload zone, brief explainer, "Try sample" button
2. **Analyzing:** spinner with text "Parsing GPX..." (will be instant in practice for <50k points but show it for UX)
3. **Result:** sticky header with route name + stats, chart, section table

### Components

**`GpxUpload`**
- Drag-and-drop zone (full window catches drops)
- Fallback file input button
- Accepts `.gpx` only; reject + show toast on other types
- File size warning at >5 MB (but don't block — let user proceed)

**`RouteStats`** (summary card above chart)
- Total distance, D+, D-, highest point, lowest point
- Number of climbs / descents identified (sections with drop ≥ 100m)

**`ElevationChart`**
- Chart.js line chart, elevation Y-axis (auto-scale to ±100m), distance X-axis (linear)
- Descent segments overlaid with color coded by `classification` (use the same green/orange/red palette I've used: `#4A8862` runnable, `#BA7517` mixed, `#993556` hike-only)
- Climb segments optionally overlaid in lighter shade of same colors (or skip in MVP — descents are the primary value)
- Hover tooltip: km, elevation, grade %
- Mobile: chart height 280px, desktop 360px
- Use a fixed-height container so layout doesn't jump while data loads

**`SectionTable`**
- Two tabs: "Descents" (default) and "Climbs"
- Columns: km range, distance, drop (or gain), avg grade, max grade, classification badge
- Default sort: by km (race order). Allow click on column header to sort by drop or grade.
- Filter: minimum drop threshold slider (default 150m, prevents 100km tables of micro-bumps)
- Click row → highlight in chart + show detail panel below

**`SectionDetail`**
- Shows when a section is selected
- Repeats stats, plus a generated strategy hint based on classification (one sentence, e.g. "Power-hike with poles, > 20% sustained" for very_steep descents)
- Strategy text is hardcoded in `classify.ts` as a function of classification — don't try to be too clever in MVP

### Color and typography

Tailwind defaults are fine. Use a neutral background (`bg-stone-50` light / `bg-stone-950` dark). Support system dark mode via `media` strategy.

Single accent color: `#185FA5` (the chart line). Keep it boring — the data should pop, not the chrome.

## Edge cases the analyzer must handle

- **No elevation data:** some GPX exports have `<trkpt>` without `<ele>`. Reject with clear error: "This GPX has no elevation data."
- **Very short routes (<1 km):** return result but show a warning banner that the analysis is unreliable.
- **Massive routes (>100k trackpoints, e.g. multi-day):** still process, but performance may suffer in the browser. Run analyzer in a Web Worker if total points >20k (defer in MVP if running out of time, just add a TODO comment).
- **GPS noise spikes:** the 5-point smoothing handles most. If a single point shows +50m elevation jump in 10m distance, treat as noise (smoothing absorbs it).
- **Multiple `<trkseg>` in one `<trk>`:** concatenate, but reset distance at segment boundaries (handle this in `gpx.ts`).
- **Negative elevations:** valid (Death Valley, etc.). Don't reject.

## Testing

Use Vitest. Minimum coverage for `lib/analyzer.ts`:

- Haversine distance: golden case (Prague → Vienna ≈ 252 km)
- Cumulative distance on a simple straight line
- Smoothing reduces a synthetic 1-point spike
- Classification thresholds (one test per boundary)
- End-to-end: parse a small sample GPX, assert section count and total D+ within 1% of expected

Place `tests/samples/lavaredo_short.gpx` (50-line manual GPX) as fixture.

## Performance targets

- First Contentful Paint: <1s on Vercel
- Time to analyze a 50 km / 5000-point GPX: <500ms on a mid-range laptop
- Total JS bundle: <200 KB gzip (Chart.js is the heavy bit, that's OK)

## Build & deployment

- `pnpm dev` for local
- `pnpm test` runs Vitest
- `pnpm build` produces production build
- Push to GitHub, connect Vercel, auto-deploy on main
- No env vars needed in MVP

## Out of scope reminders (do not add)

These are explicitly **not** part of the MVP. Don't implement them, but the architecture should not foreclose them either — see "Future ideas" below for context on what's coming.

- Authentication, sessions, cookies
- Database, persistence, sharing
- Server-side rendering of the analyzer (would be nice but is a v2)
- Multi-language UI (English only for MVP)
- Custom domain setup (use default Vercel URL)
- Analytics, telemetry
- AI integration or MCP

## Future ideas (post-MVP roadmap)

Reference only — **do not implement in MVP**. Documented here so design decisions don't foreclose them.

### v1.1 — Persistence and accounts

Goal: let users save analyzed routes and revisit them, share a public link.

- **Stack additions:** Postgres (Neon or Supabase), Drizzle ORM, NextAuth with email magic links or GitHub OAuth
- **Data model:** `users`, `routes` (with `analysis_json` blob, `gpx_url`, `is_public`), `shares` (slug → route_id)
- **UI:** "Save this route" button after analysis, "My routes" page, public share page at `/r/[slug]`
- **Storage:** GPX files in Vercel Blob or S3, max 10 MB each
- **Architecture impact on MVP:** keep analyzer pure and JSON-serializable so the same result object can be persisted later without refactoring

### v1.2 — Multi-route comparison

Goal: side-by-side comparison of 2–3 routes (e.g. "how does Lavaredo descent compare to Wildstrubel Kandersteg?").

- **UI:** comparison page with stacked or overlaid charts, side-by-side stats table
- **Selection:** pick from saved routes or upload ad-hoc for comparison
- **Analysis:** statistical comparison — total D-, longest descent section, descent intensity index (drop × avg grade / distance)
- **Architecture impact:** analyzer already returns a structured `RouteAnalysis` — comparison is a pure function over two of those

### v1.3 — Pace and time prediction

Goal: given a route and a user profile, estimate finish time and section-by-section pacing.

- **User profile inputs:** weight, climb pace at flat (min/km), eccentric fitness self-rating, max sustainable HR
- **Model:** per-segment pace formula using grade-adjusted pace (GAP) — well-studied in running science, start with Strava's published formula and tune
- **UI:** "Predict my time" button → table with cumulative time at each aid station / km marker
- **Stretch:** input target HR zones → suggested pacing per section (e.g. "power-hike here to stay under 145 bpm")
- **Architecture impact:** prediction is a separate `lib/predict.ts` module taking `RouteAnalysis + UserProfile` → `PacingPlan`

### v1.4 — MCP server for AI queries

Goal: expose route analysis as MCP tools so AI assistants (Claude, etc.) can answer natural-language questions about a route.

- **Stack:** separate Node service or Next.js API routes, depending on hosting
- **Tools to expose:**
  - `analyze_route(gpx_url | gpx_content)` → `RouteAnalysis`
  - `get_descent_strategy(route_id, km_start, km_end)` → strategy text + section metadata
  - `compare_routes(route_id_a, route_id_b)` → comparison summary
  - `find_similar_section(route_id, section_id, threshold_km)` → other sections in known routes with similar profile
- **Use case example:** "Hey Claude, here's my GPX for next month's race. What are the three hardest descents?"
- **Architecture impact:** the existing pure `lib/` functions already work — MCP server is just a transport layer over them

### v1.5 — Saved race library + recommendations

Goal: a public catalog of analyzed routes from major races (UTMB events, Western States, Lavaredo, etc.).

- **Curation:** admin uploads canonical GPX files for known races, tagged with date, location, race series
- **Discovery:** search by location, distance, D+, "similar to X"
- **User benefit:** "I'm running Lavaredo, what's similar that I could train on?" → returns Krkonoše-equivalent suggestions for users near specific regions
- **Architecture impact:** requires DB (v1.1 prerequisite), search index (Postgres FTS is enough), and a curation workflow

### v1.6 — Region-specific training suggestions

Goal: connect race analysis to nearby training routes that match the profile.

- **Inputs:** user's home location + target race route
- **Output:** "Your race has 20%+ descent sections. Within 100 km of Prague, here are 5 routes with similar gradient" — likely Krkonoše-style suggestions
- **Data source:** Strava segments API or community-contributed routes
- **Architecture impact:** needs DB (v1.1), location data, and likely a 3rd-party segments integration

### v2 — Heat and altitude modifiers

Goal: factor environmental conditions into pace prediction and strategy.

- **Heat:** predicted slowdown based on forecast at race location/date, hydration recommendations
- **Altitude:** O2 reduction curve above 2000m, pacing implications
- **Architecture impact:** weather API integration, altitude-adjusted pace model layered onto v1.3 prediction

### Design principles for evolving past MVP

- **Keep `lib/` pure and framework-free.** Every feature above can be built on top of the same analyzer without rewriting it.
- **JSON-first.** All analysis results should serialize cleanly so they can be stored, shared, or sent over MCP.
- **Public-first defaults.** Even when accounts arrive, default to public share-by-link. Trail runners share routes constantly.
- **Mobile is primary.** Every new feature must work on a phone first. Runners pull this up at the trailhead, not at a desk.

## Implementation order (suggested for Claude Code)

1. Initialize Next.js project, Tailwind, TS strict, Vitest, `.nvmrc`
2. Write `lib/types.ts`, `lib/geo.ts`, `lib/classify.ts` with full test coverage
3. Write `lib/gpx.ts` (parsing) + test with bundled fixture
4. Write `lib/analyzer.ts` (smoothing, bucketing, sectioning) + tests
5. Build `app/page.tsx` minimal flow: upload → analyze → JSON dump (no UI yet)
6. Build `ElevationChart` component
7. Build `SectionTable` + `SectionDetail`
8. Build `RouteStats` + `GpxUpload`
9. Polish: empty state, error states, mobile responsive, dark mode
10. Add sample GPX + "Try sample" button
11. Deploy to Vercel
12. Write a 5-line README with usage + one-line privacy note ("all processing is in your browser; no data is uploaded")

## Acceptance criteria

The MVP is done when:

- I can drag a `.gpx` file onto the page and within 1 second see:
  - Total distance, D+, D- displayed correctly (within 1% of Strava/Garmin)
  - An interactive elevation chart with color-coded descents
  - A table of descent sections sorted by km, filterable by minimum drop
  - Clicking a section highlights it in the chart + shows strategy hint
- It works on iPhone Safari (responsive layout, file picker)
- All Vitest tests pass
- Deployed and live on a Vercel URL

## Notes for Claude Code

- Use TypeScript strict mode. No `any`. If unsure of a type, write it explicitly.
- Use `const` everywhere reasonable. Prefer pure functions.
- Don't over-engineer state. `useState` is fine for everything in MVP.
- Don't add ESLint/Prettier configs beyond what `create-next-app` provides — keep noise low.
- Don't use a UI component library (shadcn etc.). Plain Tailwind + semantic HTML. Faster, lighter, easier to maintain.
- When in doubt about a design choice, pick the simpler option and add a `// TODO:` comment.
- Commit incrementally. Each numbered step in "Implementation order" should be at least one commit.
