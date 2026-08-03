# Select (low-level primitives)

**Path:** `src/components/ui/select/{Select,SelectTrigger,SelectContent,SelectItem,SelectValue,SelectScrollUpButton,SelectScrollDownButton}.vue`, `select.variants.ts`, `types.ts`
**Built on:** Reka UI `Select*` family

## Purpose

The unstyled-logic building blocks that `SingleSelect` is composed from. **Prefer `SingleSelect` / `MultiSelect` for application code.** Only reach for these primitives when building a genuinely new select variant that neither existing component covers.

## Pieces

| Component                                                 | Role                                                                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Select.vue`                                              | wraps `SelectRoot`, forwards all root props/emits                                                                                                    |
| `SelectTrigger.vue`                                       | wraps `SelectTrigger` + chevron icon; props `size: 'lg'\|'md'` (default `lg`), `invalid?: boolean`                                                   |
| `SelectContent.vue`                                       | wraps `SelectPortal` + `SelectContent` + `SelectViewport` + scroll buttons; `disablePortal?: boolean` (Safari-in-Dialog workaround); slot `#prepend` |
| `SelectItem.vue`                                          | wraps `SelectItem` + `SelectItemText` + `SelectItemIndicator`                                                                                        |
| `SelectValue.vue`                                         | thin wrapper around `SelectValue`                                                                                                                    |
| `SelectScrollUpButton.vue` / `SelectScrollDownButton.vue` | scroll affordances inside `SelectContent`                                                                                                            |

## Shared variants (`select.variants.ts`)

- `selectTriggerVariants` (cva): `size: md | lg` (default `lg`); `border: none | active | invalid` (default `none`).
- `selectItemVariants` (cva): `layout: multi | single` (default `multi`).
- Also exports `selectContentClass`, `selectDropdownClass`, `selectEmptyMessageClass`, `selectCountBadgeClass`, and `stopEscapeToDocument(event)` (prevents Escape from closing an ancestor dialog when it should only close the select popover).
- `types.ts` exports `SelectOption = { name: string; value: string }` — the shared option shape used across `select`, `single-select`, `multi-select`.

## Usage

```vue
<script setup lang="ts">
import Select from '@/components/ui/select/Select.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
</script>

<template>
  <Select>
    <SelectTrigger>
      <SelectValue placeholder="Pick one" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="a">Option A</SelectItem>
      <SelectItem value="b">Option B</SelectItem>
    </SelectContent>
  </Select>
</template>
```

## Don't

- Don't assemble these for a routine dropdown — use `SingleSelect`.
- Don't forget `disablePortal` on `SelectContent` when nesting inside a `Dialog` if targeting Safari.
