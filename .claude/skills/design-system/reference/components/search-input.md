# SearchInput / AsyncSearchInput / SearchAutocomplete

**Path:** `src/components/ui/search-input/{SearchInput,AsyncSearchInput,SearchAutocomplete}.vue`, `searchInput.variants.ts`

## SearchInput (canonical, client-side debounce)

**Purpose:** Debounced text search field with a leading search/loading icon and a clear button that appears once there's a value.

| Prop           | Type                      | Default                    |
| -------------- | ------------------------- | -------------------------- |
| `placeholder`  | `string`                  | i18n `g.searchPlaceholder` |
| `ariaLabel`    | `string`                  | —                          |
| `icon`         | `string`                  | `'icon-[lucide--search]'`  |
| `debounceTime` | `number`                  | `300` (ms)                 |
| `autofocus`    | `boolean`                 | `false`                    |
| `loading`      | `boolean`                 | `false`                    |
| `disabled`     | `boolean`                 | `false`                    |
| `size`         | `sm \| md \| lg \| xl`    | `'md'`                     |
| `class`        | `HTMLAttributes['class']` | —                          |

`defineModel<string>({ required: true })`. Emits `search: [value: string]` after `debounceTime` ms of inactivity.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'

const searchText = ref('')
</script>

<template>
  <SearchInput v-model="searchText" size="md" @search="onSearch" />
</template>
```

## AsyncSearchInput

**Purpose:** Server-driven search input — calls a `searcher(query, onCleanup)` callback (race-condition safe) instead of emitting an event.

| Prop                | Type                                                        | Default |
| ------------------- | ----------------------------------------------------------- | ------- |
| `searcher`          | `(query: string, onCleanup: (fn) => void) => Promise<void>` | no-op   |
| `updateKey`         | `MaybeRefOrGetter<unknown>`                                 | —       |
| `autofocus`         | `boolean`                                                   | `false` |
| `debounceMs`        | `number`                                                    | `250`   |
| `debounceMaxWaitMs` | `number`                                                    | `1000`  |

`defineModel<string>({ default: '' })`. Emits `enter: [event: KeyboardEvent]`. Not built on Reka UI — plain input with `focus-within` ring styling.

## SearchAutocomplete\<T\>

**Purpose:** Combobox-style search input with a suggestion dropdown (generic over item type `T`).

| Prop                                                                                                                    | Type                          | Default |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------- |
| `suggestions`                                                                                                           | `T[]`                         | `[]`    |
| `optionLabel`                                                                                                           | `keyof T & string`            | —       |
| `optionKey`                                                                                                             | `keyof T & string`            | —       |
| `size`                                                                                                                  | `SearchInputVariants['size']` | `'md'`  |
| (plus `placeholder`, `icon`, `autofocus`, `loading`, `disabled`, `class`, `contentStyle` — same shape as `SearchInput`) |

`defineModel<string>({ required: true })`. Emits `select: [item: T]`. Slot `#suggestion` (scoped: `{ suggestion }`).

## Do

- Use `SearchInput` for the common case (client-side filtering you drive yourself off the `search` event or the `v-model` value directly).
- Use `AsyncSearchInput` when results come from an API call per keystroke.
- Use `SearchAutocomplete` when you need a suggestion dropdown, not just a filter.

## Don't

- Don't reinvent debouncing — all three variants already debounce internally.
