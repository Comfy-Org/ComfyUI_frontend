# Bento App Mode

Components for the full-viewport bento grid App Mode redesign. Related context and design docs live in [`comfyui-app-mode`](https://github.com/eliheuer/comfyui-app-mode) (private).

## Before editing anything in this folder

**Read [`design-tokens.css`](./design-tokens.css) first.** It's the single source of truth for visual constants — type scale, colors, grid dimensions, motion timing. Reference tokens via `var(--bento-*)` in scoped styles. **Don't hardcode values**; if you need one that doesn't exist, add it to `design-tokens.css` with a comment on intent.

The type scale is deliberately tight: **4 sizes only** (`md` / `lg` / `xl` / `hero`). Resist adding a fifth.

## Structure

- `BentoGrid.vue` — layout primitive. Measures its container and computes explicit track counts at `cellSize` with `minGap` floor; slack is absorbed into `column-gap` / `row-gap` so the outer margin stays uniform on every edge.
- `BentoView.vue` — runtime view. Composes system-pinned cells (utility icon stack, mode toggle, feedback, run, batch count) plus per-input cells. Mounts in `LinearView.vue` when App Mode is active and the workflow has outputs.
- `cells/` — individual cell components. Each cell fills its assigned grid area and renders one coherent piece of UI.
- `design-tokens.css` — visual constants. Import it once (in `BentoView.vue`); tokens cascade to every cell via CSS custom properties on `.bento-view`.

## Cell conventions

- Cell roots fill their grid area: `width: 100%; height: 100%` (or absolute fill if the cell is a positioning context).
- Visible cell background is applied by `BentoGrid` via the `.bento-cell:has(> *)` selector — individual cells don't set their own outer background.
- Text at `var(--bento-font-md)` unless there's a concrete reason otherwise.
- Padding uses the token-implied rhythm (multiples of `--bento-gutter-min`).
- No decorative chrome: no shadows, no gradients, no rounded corners larger than `--bento-cell-radius`. Accent color only for primary action / active states.

## Phase map

Tracked in detail in the context repo's `todo.md`. Brief:

- **Phase 1 (done):** full-viewport bento canvas replacing the `Splitter`; system-pinned cells; real Run / inputs / outputs wiring
- **Phase 2a (done):** per-input cells with heuristic auto-layout
- **Phase 2b (next):** per-output cells + `OutputCardConfig` schema extension
- **Phase 3:** drag/resize editor in builder mode
- **Phase 4:** mobile + touch
- **Phase 5:** groups / collapsible sections
- **Phase 6:** polish + docs
