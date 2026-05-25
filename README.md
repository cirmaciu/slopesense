# Slopesense

Slopesense is a browser-based GPX analyzer for trail and ultra runners doing race
recon. Drop a `.gpx` file and it finds the climbs and descents, draws a
color-coded elevation profile, and rates each section's runability — so you know
where you'll run, where you'll hike, and where the descents will wreck your quads.

**Privacy:** all parsing and analysis run entirely in your browser. No file is
ever uploaded.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # Vitest unit tests for the lib/ analysis engine
pnpm typecheck  # tsc --noEmit
pnpm build      # production build
```

Built with Next.js (App Router), TypeScript (strict), Tailwind CSS and Chart.js.
The analysis core lives in `lib/` as pure, framework-free, unit-tested functions.
