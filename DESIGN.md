# DESIGN.md

Entry point for humans and agents touching the UI. This file is the **map** — where things live, how they relate, common recipes. It is not the rules themselves.

For binding rules on visual decisions, read `docs/guidance/design-standards.md` (auto-loads via glob when you edit files under `src/components/**` or `src/views/**`).

For repo-wide agent guidance, see `AGENTS.md` at root.

## Where things live

| Concept                     | File                                                                        | Use when                                        |
| --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Global color + font tokens  | `packages/design-system/src/css/_palette.css`                               | Adding a palette color or font scale entry      |
| Base styles                 | `packages/design-system/src/css/style.css`                                  | Shared resets / baseline rules                  |
| Font stacks                 | `packages/design-system/src/css/fonts.css`                                  | Font family changes                             |
| Button primitive            | `src/components/ui/button/Button.vue`                                       | Any button                                      |
| Button variants             | `src/components/ui/button/button.variants.ts`                               | Adding a button style                           |
| Select primitive + variants | `src/components/ui/select/` (primitive + `select.variants.ts`)              | Any select                                      |
| Class merging               | `src/utils/tailwindUtil.ts` (`cn()`)                                        | Combining Tailwind classes                      |
| Design rules                | `docs/guidance/design-standards.md`                                         | Figma mapping, color tier system, anti-patterns |
| Figma (source of truth)     | Fetch live via MCP: `get_figma_data({ fileKey: 'QreIv5htUaSICNuO2VBHw0' })` | Any new visual decision                         |
| Vue conventions             | `docs/guidance/vue-components.md`                                           | SFC structure, props, reactivity                |

## The layered model

```
Figma                           (design source of truth, fetched live via MCP)
   ↓
Tailwind v4 @theme tokens       (packages/design-system/src/css/_palette.css)
   ↓
CVA variants                    (e.g. button.variants.ts, select.variants.ts)
   ↓
Reka UI primitives              (unstyled; composed into styled wrappers)
   ↓
Feature components              (src/components/**, src/views/**)
```

Read bottom-up for _what_; read top-down for _why_.

## Recipes

### Add a new color

1. Add to `_palette.css` under `@theme`: `--color-your-name: #rrggbb;`
2. Tailwind auto-generates `bg-your-name`, `text-your-name`, `border-your-name`.
3. Never reference the hex in components — use the utility class.

### Add a button variant

1. Edit `src/components/ui/button/button.variants.ts`, add an entry under `variants.variant`.
2. Use: `<Button variant="your-name">`.

### Style a new component

1. Check `src/components/ui/` for an existing primitive that fits. Wrap it.
2. Use Tailwind classes; no `<style>` blocks.
3. If the component has multiple shapes/sizes, add a sibling `xyz.variants.ts` (CVA) — don't branch classes inline.

### Reference a brand or palette color

1. Tailwind utilities generated from `_palette.css` handle this automatically (e.g. `bg-brand-yellow`, `text-charcoal-800`).
2. If the class doesn't exist, the token isn't there yet — add it (see "Add a new color").

## Anti-patterns

Each of these has a single reason; if the reason doesn't apply to your case, ask in review before proceeding.

- **Hex values in components.** Breaks theme adaptivity (dark/light, future palettes).
- **`<style scoped>` blocks in new components.** Repo convention: Tailwind utilities only. Utilities compose with the token system; scoped CSS does not.
- **`withDefaults(defineProps(), {...})`.** Use reactive destructuring per `docs/guidance/vue-components.md`: `const { foo = default } = defineProps<{...}>()`.
- **Hand-rolled focus rings on buttons.** The `Button` primitive already applies `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`. Re-implementing usually produces a worse a11y result.
- **`dark:` modifiers in new code.** Semantic tokens handle both themes; `dark:` duplicates concerns. See `AGENTS.md`.
- **New PrimeVue usage.** Legacy surface; direction is away from it. Prefer `components/ui/` + CVA + Reka primitives.
- **Figma `-hover` / `-selected` tokens mapped verbatim.** Those tokens exist only for Figma prototypes; derive states programmatically (`color-mix()`, `hover:` modifiers). See `design-standards.md`.

## Keep this file live

If you catch DESIGN.md saying something that doesn't match the codebase, fix it in the same PR. This is a live map, not a monument.
