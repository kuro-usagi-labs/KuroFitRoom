# RoomFit

Plan before you buy. RoomFit is a local-first room planner that checks real
furniture geometry, clearances and circulation before you commit to a purchase.

Built with React 18, TypeScript (strict), Vite, Zustand, CSS Modules, SVG and
IndexedDB. Ships as a web build and as a Windows desktop app via Electron.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173`).

```bash
npm run typecheck   # strict TypeScript check
npm run test        # 77 Vitest cases
npm run build       # typecheck + production build into dist/
npm run preview     # serve the production build
```

## Desktop app (Electron)

```bash
npm run electron:dev     # Vite dev server + Electron window with hot reload
npm run electron:start   # build, then run the production bundle in Electron
npm run electron:pack    # unpacked app in release/win-unpacked (quick check)
npm run electron:build   # Windows installer in release/
```

The packaged installer is `release/RoomFit-Setup-<version>.exe`. The app runs
fully offline: the web font is bundled, no remote requests are made, and
projects live in the Electron profile's IndexedDB.

Desktop integration:

- Secure defaults: context isolation, sandbox, no Node integration in the
  renderer, blocked permissions, external links opened in the system browser.
- A production Content-Security-Policy is injected at build time.
- Save/export dialogs use the native file picker; downloads default to the
  Downloads folder.
- Single-instance lock, native window state minimums and an application menu on
  macOS.

## Features

### Quick Fit

- Enter the inner clear room width and length.
- Choose a furniture type and real frame size.
- Search for a valid position around existing furniture or in a cleared room.
- Compare up to four distinct placements plus alternative furniture sizes.
- Open the chosen placement in Designer.

The search samples a 10 cm grid in the allowed orientations. Finding no position
is reported as an inconclusive heuristic result, never as proof that the piece
cannot fit.

### Room Designer

- Millimetre-accurate SVG floor plan with zoom and pan.
- Drag, resize, rotate (0/90/180/270), lock, duplicate and delete furniture.
- Wall, object-edge and grid snapping with visual guides.
- Doors and windows on any wall, including hinge side and swing direction.
- Door-swing and entrance-approach checks.
- Configurable clearance heuristics.
- Distance measurement tool.
- Undo/redo history; drags are recorded as a single history step.
- Layout snapshots for comparing alternatives.
- Projects, autosave and JSON import/export.
- SVG and PNG floor-plan export.

### Analysis

Statuses are derived from explicit checks:

- **Doesn't fit** — boundary overflow, physical collision or blocked door swing.
- **Fits, but tight** — physically valid, but at least one access or circulation
  warning.
- **Fits comfortably** — all evaluated clearance zones meet their targets.
- **Needs review** — nothing could be verified, for example an empty plan.

Every status is accompanied by reasons, measurements and suggestions. RoomFit
does not claim comfort when the relevant clearance zones have not been checked.

## Geometry model

- All stored geometry is integer millimetres.
- The room origin is the top-left inner corner; X runs right, Y runs down.
- Furniture positions are centre points. `width` and `depth` are the object's
  unrotated physical dimensions.
- Only the inner clear room size is analysed. Wall thickness is visual metadata.
- Collision requires positive overlap; touching edges are not a collision.
- Occupied floor area is the exact union of furniture footprints, so overlaps
  are never counted twice.
- Door swings are modelled as quarter discs, including hinge side and direction.

Clearance values are configurable heuristics, not universal standards. Defaults
live in `src/features/furniture-library/catalog.ts` and can be edited in the
Measure panel.

## Project structure

```text
electron/              Electron main process (window, security, menus, downloads)
build/                 desktop icon assets
src/
  app/                 application shell and layout
  components/          shell UI, inspector, analysis bar, design-system primitives
  engine/              pure geometry, openings, clearance, analysis and search
  export/              offscreen SVG scene and SVG/PNG/JSON exporters
  features/            floor editor, furniture library, panels, Quick Fit, projects
  hooks/               analysis cache, autosave, sizing, keyboard shortcuts
  storage/             IndexedDB layer and schema validation
  store/               Zustand project, editor and toast stores
  styles/              tokens, global styles, shared panel styles
  types/               domain types
tests/                 geometry/analysis, editor, persistence and Quick Fit suites
```

The engine is UI-independent and covered directly by tests. Analysis is cached
per immutable project object, so callers should replace project objects rather
than mutate them.

## Persistence

- Projects are stored in IndexedDB (`roomfit` database, `projects` store).
- Autosave is debounced by 900 ms and gated until startup hydration completes.
- JSON import is validated and normalised; malformed payloads and undersized
  dimensions are rejected instead of silently resized.
- The latest project is restored on the next launch. In Electron this store
  lives in the RoomFit profile rather than a website origin.
- Clearing site data (web) or the app profile (desktop) removes local projects,
  so export a JSON backup.

## Accessibility

- Keyboard shortcuts: `V` select, `H`/Space pan, `M` measure, `Ctrl/Cmd+Z` undo,
  `Ctrl/Cmd+Shift+Z` redo, `Ctrl/Cmd+S` save, `Escape` closes panels.
- Icon-only controls have accessible names.
- Muted text meets WCAG AA contrast.
- The workspace exposes a main landmark and a zoomable viewport.
- Lighthouse (desktop) reports 100 for Accessibility, Best Practices and SEO.

## Known limitations

- Two-dimensional planning only; ceiling height and wall thickness are metadata
  reserved for a future 3D view.
- Placement search is deterministic and heuristic. It can miss unusual valid
  layouts, especially with non-rectangular arrangements.
- Clearance guidance uses editable heuristics rather than building codes or
  manufacturer requirements.
- Furniture is rectangular in plan; L-shaped or curved pieces need a custom
  approximation.
- Layout comparison is snapshot-based; it does not animate transitions between
  saved layouts.
- The Windows installer is not code-signed. SmartScreen may warn on first launch
  until a certificate is configured.
