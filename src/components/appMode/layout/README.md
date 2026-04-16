# App Mode layout

Components for App Mode's layout system — a full-viewport output canvas with floating panels snapped to a grid. Related context and design docs live in [`comfyui-app-mode`](https://github.com/eliheuer/comfyui-app-mode) (private).

## Before editing anything in this folder

**Read [`design-tokens.css`](./design-tokens.css) first.** It's the single source of truth for visual constants — type scale, colors, grid dimensions, motion timing. Reference tokens via `var(--layout-*)` in scoped styles. **Don't hardcode values**; if you need one that doesn't exist, add it to `design-tokens.css` with a comment on intent.

The type scale is deliberately tight: **4 sizes only** (`md` / `lg` / `xl` / `hero`). Resist adding a fifth.

## Structure

- `LayoutGrid.vue` — grid primitive. Measures its container and computes explicit track counts at `cellSize` with `minGap` floor; slack is absorbed into `column-gap` / `row-gap` so the outer margin stays uniform on every edge. Serves as the **snap target** for floating panels.
- `LayoutView.vue` — runtime view. Mounts `LinearPreview` as the full-viewport background layer, the grid above it, and one or more floating panels on top.
- `cells/` — individual cell components. Each cell fills its assigned grid area and renders one coherent piece of UI.
- `panels/` — floating-panel shell + snap-drag + Notion-style block list.
- `design-tokens.css` — visual constants. Import it once (in `LayoutView.vue`); tokens cascade to every cell + panel via CSS custom properties on `.layout-view`.

## Cell conventions

- Cell roots fill their grid area: `width: 100%; height: 100%` (or absolute fill if the cell is a positioning context).
- Visible cell background is applied by `LayoutGrid` via the `.layout-cell:has(> *)` selector — individual cells don't set their own outer background.
- Text at `var(--layout-font-md)` unless there's a concrete reason otherwise.
- Padding uses the token-implied rhythm (multiples of `--layout-gutter-min`).
- No decorative chrome: no shadows, no gradients, no rounded corners larger than `--layout-cell-radius`. Accent color only for primary action / active states.

## Phase map

Tracked in detail in the context repo's `todo.md` (Solution 04 — Semi-Customizable Floating Panels). Brief:

- **Phase 1–2 (done):** grid substrate + per-input / per-output cells + design tokens.
- **Phase 4-A / 4-C / 4-E / 4-F (done):** floating-panel shell, drag-to-snap between presets, Notion-style block reorder, multi-column blocks within a panel.
- **Phase 4-I (in progress):** UI/UX polish for draft PR.
- **Phase 4-B / 4-G / 4-H (next):** schema + persistence, edit-mode lock, builder integration.
- **Phase 5+ (backlog):** multi-panel, output-as-panel, mobile, additional block types.
