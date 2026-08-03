# Table

**Path:** `src/components/ui/table/{Table,TableHeader,TableBody,TableRow,TableHead,TableCell}.vue`
**Built on:** plain semantic HTML (`<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`) — no Reka UI, no headless logic

## Purpose

Presentational tabular-data primitives. No built-in sorting/pagination/selection logic — purely the styled HTML skeleton.

## Pieces

| Component     | Renders                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| `Table`       | `<div class="overflow-auto"><table class="table-fixed ...">` — scroll wrapper included |
| `TableHeader` | `<thead>`                                                                              |
| `TableBody`   | `<tbody>`                                                                              |
| `TableRow`    | `<tr>` — supports `data-state="selected"` for a highlighted-row background             |
| `TableHead`   | `<th scope="col">`                                                                     |
| `TableCell`   | `<td>`                                                                                 |

All accept only `{ class?: HTMLAttributes['class'] }`.

## Usage

```vue
<script setup lang="ts">
import Table from '@/components/ui/table/Table.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Size</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow
        v-for="row in rows"
        :key="row.id"
        :data-state="row.selected ? 'selected' : undefined"
      >
        <TableCell>{{ row.name }}</TableCell>
        <TableCell>{{ row.size }}</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
```

## Do

- Combine with `ui/pagination/Pagination.vue` for a paginated table — `Table` itself has no paging logic.
- Set `data-state="selected"` on a `TableRow` to get the built-in selected-row background instead of a custom class.

## Don't

- Don't expect sorting, virtualization, or row-selection state management — build that in the consuming component.
