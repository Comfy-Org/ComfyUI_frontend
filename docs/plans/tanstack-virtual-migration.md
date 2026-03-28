# TanStack Virtual Migration Plan

## Dependency Status

- Is @tanstack/vue-virtual a transitive dep? **Yes**
- Current version (if any): **3.13.12** — pulled in via `reka-ui@2.5.0`
- `pnpm why @tanstack/vue-virtual` shows no direct dependency; it enters the graph solely through `reka-ui → @tanstack/vue-virtual`.

## Reka UI Virtualizer

- Does it expose a generic virtualizer? **No**
- API surface:
  - Reka UI exposes **component-scoped** virtualizers only: `ComboboxVirtualizer`, `ListboxVirtualizer`, and `TreeVirtualizer`.
  - Each wraps `@tanstack/vue-virtual` internally but is tightly coupled to its parent component's context (selection state, keyboard nav, type-ahead, ARIA roles).
  - There is no standalone `<Virtualizer />` or `useVirtualizer` re-export from `reka-ui`.
  - The [Reka UI virtualization guide](https://reka-ui.com/docs/guides/virtualization) confirms virtualizer usage is scoped to Combobox, Listbox, and Tree components.

## Grid Support

- Does TanStack Virtual support 2D grids? **Yes — via dual-axis composition**
- How it works:
  - TanStack Virtual provides `useVirtualizer` (vertical or horizontal). A 2D grid is achieved by combining a **row virtualizer** (vertical) with a **column virtualizer** (horizontal), each managing one axis independently.
  - The Vue adapter (`@tanstack/vue-virtual`) exposes `useVirtualizer` and `useWindowVirtualizer`.
  - React examples demonstrate this pattern with two virtualizer instances rendered as nested loops.
- Workarounds if not:
  - Not needed — dual-axis composition is the official approach.
  - For a CSS Grid with uniform columns (like our `VirtualGrid.vue`), a **single vertical virtualizer** virtualizing rows is sufficient. Each "virtual row" renders N columns via CSS `grid-template-columns`. This is simpler and matches our current spacer-based approach.

## Affected Components

Files importing `VirtualGrid`:

| File | Usage |
|------|-------|
| `src/components/sidebar/tabs/AssetsSidebarGridView.vue` | Grid display for sidebar assets |
| `src/components/sidebar/tabs/AssetsSidebarListView.vue` | List display for sidebar assets |
| `src/components/sidebar/tabs/AssetsSidebarListView.test.ts` | Tests for list view |
| `src/platform/assets/components/AssetGrid.vue` | Asset grid on platform layer |
| `src/workbench/extensions/manager/components/manager/ManagerDialog.vue` | Manager dialog grid |
| `src/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenu.vue` | Dropdown menu virtualisation |
| `src/renderer/extensions/vueNodes/widgets/components/form/dropdown/FormDropdownMenu.test.ts` | Tests for dropdown |
| `src/components/common/VirtualGrid.test.ts` | Unit tests for VirtualGrid itself |

**6 consuming components** + **2 test files**.

## Migration Plan

### Approach

**Add `@tanstack/vue-virtual` as a direct dependency** (it's already installed as a transitive dep, so bundle size is zero-cost).

Do **not** use Reka UI's wrapper — it is component-specific and not suitable for a generic grid.

Replace the custom `VirtualGrid.vue` implementation with a thin composable or component that wraps `useVirtualizer` from `@tanstack/vue-virtual`:

1. **Create `useVirtualGrid` composable** — wraps `useVirtualizer` with row-based virtualization. Computes column count from container width (mirroring current `cols` logic). Exposes `virtualRows`, `totalSize`, and `scrollTo`.
2. **Update `VirtualGrid.vue`** — replace manual spacer/slice logic with `useVirtualizer` output. Keep the same public props/slots/events API to minimize consumer changes.
3. **Update consumers** — ideally zero changes if the VirtualGrid API is preserved. If the slot contract changes (e.g., exposing `VirtualItem` metadata), consumers need minor template updates.
4. **Preserve `approach-end` emit** — implement via `useVirtualizer`'s `scrollMargin` or by watching the last visible row index.

### Effort Estimate

| Task | Estimate |
|------|----------|
| Add direct dep, create `useVirtualGrid` composable | 2–3 hours |
| Rewrite `VirtualGrid.vue` internals | 2–3 hours |
| Update 6 consumers (mostly slot adjustments) | 3–4 hours |
| Update/add tests | 2–3 hours |
| Manual QA across all affected views | 1–2 hours |
| **Total** | **~10–15 hours (2–3 days)** |

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking the slot API forces changes in all 6 consumers | Medium | Design the new VirtualGrid to preserve the existing `#item="{ item, index }"` slot signature |
| Dynamic row height measurement differs from current DOM-query approach | Low | TanStack Virtual has built-in `measureElement` support for dynamic sizing |
| `approach-end` infinite-scroll behavior may need reimplementation | Low | Use `useVirtualizer`'s `onChange` callback to detect when the last virtual item is near the viewport |
| Transitive dep version may drift if reka-ui upgrades | Low | Adding as direct dep pins the version; use `pnpm` catalog for alignment |
| Performance regression for very large grids | Low | TanStack Virtual is battle-tested; benchmark before/after with ≥10k items |

### Recommendation

This migration is **low-risk and low-effort** given `@tanstack/vue-virtual` is already in the dependency tree. The primary benefit is replacing ~140 lines of hand-rolled virtualization logic with a well-maintained, framework-supported solution that handles edge cases (dynamic sizing, scroll restoration, horizontal virtualization) out of the box. Priority should remain low as the current implementation works correctly.
