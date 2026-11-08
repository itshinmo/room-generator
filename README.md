# Room Generator

A tiny seeded procedural floor generator inspired by [The Binding of Isaac](<https://en.wikipedia.org/wiki/The_Binding_of_Isaac_(video_game)>).

**[Live demo](https://itshinmo.github.io/room-generator/)**

The demo renders an 11×11 grid, places a start room in the center, grows a
connected cluster of up to 15 rooms around it, and puts the end room at the
farthest reachable position.

## Features

- Deterministic generation: every map has a seed, and the seed is kept in the
  URL (`?seed=...`) so a layout can be shared or reproduced.
- Rooms are 1×1, 1×2, 2×1 or 2×2 and never overlap.
- The floor is always connected, and the end room is always at least as deep
  as every other room.
- A small gap chance keeps layouts from looking like a solid rectangle.
- Responsive board, keyboard-friendly controls, and accessible cell labels.

## Getting started

```bash
yarn install
yarn dev
```

Open the URL printed by Vite. Change the URL's `?seed=` value to revisit a map.

## Scripts

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `yarn dev`        | Start the Vite development server with HMR.        |
| `yarn build`      | Type-check with `tsc -b` and build for production. |
| `yarn preview`    | Preview the production build locally.              |
| `yarn lint`       | Run ESLint.                                        |
| `yarn test`       | Run the Vitest suite once.                         |
| `yarn test:watch` | Run Vitest in watch mode.                          |
| `yarn typecheck`  | Type-check without emitting files.                 |

## How generation works

The core lives in [`src/generator/generateBoard.ts`](src/generator/generateBoard.ts).
It is a pure function: `generateBoard(options, seed)` returns the cell grid and
room metadata without touching React or the DOM.

1. Place the start room in the center.
2. Maintain the frontier of free cells orthogonally adjacent to existing rooms.
3. Pick a random frontier cell and try to place a 1×1, 1×2, 2×1 or 2×2 room
   that contains it. Rooms that would overlap are discarded.
4. Occasionally leave a frontier cell empty to create gaps. Skipping is never
   allowed when it would strand the generator with only the start room.
5. Reserve the last room slot for the end room. It goes on the farthest free
   frontier cell; if the deepest room is completely boxed in, that room is
   promoted to the end room instead.

The random source is a seeded Mulberry32 PRNG. Tests cover determinism,
connectivity, room shapes, non-overlap, depth ordering, small boards and
invalid input.

## Project structure

```text
src/
  components/Board/       Board and cell rendering
  generator/              Pure seeded generation logic + tests
  config.ts               Grid, room and gap constants
  enums.ts / types.ts     Shared domain types
```

## Deployment

Every push to `main` (including merged pull requests) runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Install dependencies with Yarn.
2. Lint, test and build.
3. Upload `dist` and deploy it to GitHub Pages.

The repository's Pages source must be set to **GitHub Actions**. Vite uses a
relative `base`, so the build also works when the site is served from a
sub-path such as `/room-generator/`.
