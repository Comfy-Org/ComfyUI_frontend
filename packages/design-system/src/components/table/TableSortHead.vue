<template>
  <TableHead :class="className" :aria-sort="direction ?? 'none'">
    <Button variant="link" size="link" @click="toggle">
      <slot />
      <i
        v-if="direction"
        :class="
          direction === 'ascending'
            ? 'icon-[lucide--arrow-up]'
            : 'icon-[lucide--arrow-down]'
        "
        aria-hidden="true"
      />
    </Button>
  </TableHead>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import TableHead from './TableHead.vue'
import type { TableSortDirection } from './tableUtils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()

const direction = defineModel<TableSortDirection | null>('direction', {
  default: null
})

function toggle() {
  direction.value = direction.value === 'ascending' ? 'descending' : 'ascending'
}
</script>
