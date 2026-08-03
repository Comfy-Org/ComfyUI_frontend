# MultiSelect

**Path:** `src/components/ui/multi-select/MultiSelect.vue`
**Built on:** Reka UI `ComboboxRoot` family (with `@vueuse/integrations/useFuse` client-side fuzzy filtering)

## Purpose

Styled multi-value select/combobox for choosing zero or more options, with an optional search box, a selected-count label, and a "clear all" action.

## Props

| Prop                | Type                   | Default         | Notes                                                                                                            |
| ------------------- | ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `label`             | `string`               | —               | trigger label / `aria-label` fallback                                                                            |
| `options`           | `SelectOption[]`       | `[]`            | `{ name: string; value: string }`                                                                                |
| `size`              | `'lg' \| 'md'`         | `'lg'`          | `lg` = 40px (Interface), `md` = 32px (Node)                                                                      |
| `disabled`          | `boolean`              | `false`         |                                                                                                                  |
| `showSearchBox`     | `boolean`              | `false`         | shows an in-panel fuzzy search input                                                                             |
| `showSelectedCount` | `boolean`              | `false`         | shows an **"N items selected"** text label in the panel header/footer — see Notes, this is not the trigger badge |
| `showClearButton`   | `boolean`              | `false`         | shows a "Clear all" button alongside the selected-count label                                                    |
| `actionsPlacement`  | `'header' \| 'footer'` | `'header'`      | places the selected-count/clear-all row above the option list (bordered, `header`) or below it (`footer`)        |
| `searchPlaceholder` | `string`               | i18n `g.search` |                                                                                                                  |
| `listMaxHeight`     | `string`               | `'28rem'`       |                                                                                                                  |
| `popoverMinWidth`   | `string`               | —               |                                                                                                                  |
| `popoverMaxWidth`   | `string`               | —               |                                                                                                                  |
| `contentStyle`      | `StyleValue`           | —               |                                                                                                                  |

## Events / v-model

- `defineModel<SelectOption[]>({ required: true })` — array of selected options.
- `defineModel<string>('searchQuery', { default: '' })` — `v-model:search-query`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import MultiSelect from '@/components/ui/multi-select/MultiSelect.vue'
import type { SelectOption } from '@/components/ui/select/types'

const selected = ref<SelectOption[]>([])
const options: SelectOption[] = [
  { name: 'Vue', value: 'vue' },
  { name: 'React', value: 'react' }
]
</script>

<template>
  <MultiSelect
    v-model="selected"
    :options="options"
    label="Category"
    show-search-box
    show-selected-count
    show-clear-button
  />
</template>
```

## Do

- Turn on `show-search-box` once the option list is long enough that scanning is slower than typing (roughly 10+ options).
- Pair `show-selected-count` with `show-clear-button` so users can see and undo a multi-selection at a glance.
- Use `actionsPlacement="footer"` when the option list itself is the primary focus and the selected-count/clear-all row should read as a summary rather than a header.

## Don't

- **Don't pass an `#icon` slot** — `MultiSelect` has no `#icon` slot at all (confirmed against source), unlike `SingleSelect`.
- Don't assume `showSelectedCount` controls the small count badge on the trigger — it doesn't (see Notes).

## Notes

- **Trigger badge vs. panel label are two different things.** The small numeric badge that appears on the trigger button (top-right corner) shows unconditionally whenever `selectedCount > 0` — it is _not_ gated by any prop. `showSelectedCount` instead controls a separate `"{count} items selected"` text label inside the dropdown panel's header/footer row (i18n key `g.itemsSelected`). Verified directly against `MultiSelect.vue` and the live Storybook "All Header Features" story.
- Each option renders as a small checkbox indicator (a `size-4 rounded-sm` box that fills `bg-primary-background` with a check icon when selected, `bg-secondary-background` when not) followed by the option name — not a bare checkmark glyph.
- Filtering is manual (`useFuse`, `threshold: 0.3`) rather than Reka's built-in filter (`ignore-filter` is set). Already-selected items stay pinned at the top of the list even when they don't match the current search text.
