<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { NavColumn } from '@/data/mainNavigation'

defineProps<{ column: NavColumn; layout?: 'column' | 'row' }>()
</script>

<template>
  <div v-if="column.kind" class="pl-2" :data-kind="column.kind">
    <p class="text-lg/tight font-medium text-primary-warm-white">
      {{ column.header }}
    </p>
    <p
      v-if="column.description"
      class="mt-1 text-xs/snug text-primary-warm-gray"
    >
      {{ column.description }}
    </p>
  </div>
  <p
    v-else-if="column.header"
    :class="
      cn(
        'font-formula text-xs font-medium text-primary-warm-gray uppercase',
        layout !== 'row' && 'pl-2'
      )
    "
  >
    {{ column.header }}
  </p>
</template>
