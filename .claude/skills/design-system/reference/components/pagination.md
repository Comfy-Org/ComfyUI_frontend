# Pagination

**Path:** `src/components/ui/pagination/Pagination.vue`
**Built on:** Reka UI `PaginationRoot` family — a single pre-assembled composite, not separate exported sub-parts.

## Purpose

Page-number pagination control: prev/next buttons + numbered page buttons + ellipsis for skipped ranges.

## Props

| Prop           | Type     | Default  | Notes |
| -------------- | -------- | -------- | ----- |
| `page`         | `number` | `1`      |       |
| `total`        | `number` | required |       |
| `itemsPerPage` | `number` | `10`     |       |

`sibling-count` is hardcoded to `1` and `show-edges` is hardcoded `true` internally — not currently exposed as props.

## Events / v-model

`defineEmits<{ 'update:page': [page: number] }>()` — `v-model:page`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Pagination from '@/components/ui/pagination/Pagination.vue'

const page = ref(1)
</script>

<template>
  <Pagination v-model:page="page" :total="120" :items-per-page="10" />
</template>
```

## Do

- Pair with `Table` for standard paginated data views.

## Don't

- Don't expect to customize `sibling-count`/`show-edges` without editing the component — they're currently fixed values.
