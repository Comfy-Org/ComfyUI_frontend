<script setup lang="ts">
import type { NavColumn } from '@/data/mainNavigation'

defineProps<{ column: NavColumn }>()
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
    v-else
    class="shrink-0 pl-2 text-2xs font-bold tracking-widest text-primary-warm-gray uppercase"
  >
    {{ column.header }}
  </p>
</template>
