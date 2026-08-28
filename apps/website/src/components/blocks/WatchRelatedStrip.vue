<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { HTMLAttributes } from 'vue'

import WatchRelatedCard from './WatchRelatedCard.vue'
import type { WatchRelatedItem } from './WatchRelatedCard.vue'

const {
  heading,
  items,
  class: className
} = defineProps<{
  heading: string
  items: readonly WatchRelatedItem[]
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div v-if="items.length" :class="cn(className)">
    <h2
      class="text-sm font-extrabold tracking-wider text-primary-warm-white uppercase"
    >
      {{ heading }}
    </h2>
    <ul class="mt-6 flex gap-4 overflow-x-auto pb-2">
      <li v-for="item in items" :key="item.id" class="shrink-0">
        <WatchRelatedCard :item="item" />
      </li>
    </ul>
  </div>
</template>
