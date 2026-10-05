<script setup lang="ts">
import { CircleDashed } from '@lucide/vue'

import type { DirectionOption } from '@/lib/workshop/cinematic-studio/catalog'

const { option } = defineProps<{
  option: Pick<DirectionOption, 'preview' | 'palette'>
}>()
</script>

<template>
  <span class="flex shrink-0 overflow-hidden rounded-md" aria-hidden="true">
    <template v-if="option.palette">
      <span
        v-for="(color, stripe) in option.palette"
        :key="stripe"
        class="h-full flex-1"
        data-testid="direction-thumb-stripe"
        :style="{ backgroundColor: color }"
      />
    </template>
    <img
      v-else-if="option.preview"
      :src="option.preview"
      alt=""
      loading="lazy"
      class="size-full object-cover"
      data-testid="direction-thumb-frame"
    />
    <span
      v-else
      class="grid size-full place-items-center bg-transparency-white-t4 text-primary-warm-gray"
      data-testid="direction-thumb-auto"
    >
      <CircleDashed class="size-4" />
    </span>
  </span>
</template>
