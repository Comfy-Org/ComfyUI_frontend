<template>
  <div
    class="flex items-center gap-2 bg-comfy-menu-secondary"
    :class="[{ 'flex-row-reverse': reverseOrder }, noPadding ? '' : 'px-3']"
  >
    <div
      v-if="badge.label"
      class="rounded-full bg-white px-1.5 py-0.5 text-xxxs font-semibold text-black"
      :class="labelClass"
    >
      {{ badge.label }}
    </div>
    <div
      class="font-inter text-sm font-extrabold text-slate-100"
      :class="textClass"
    >
      {{ badge.text }}
    </div>
  </div>
</template>
<script setup lang="ts">
import type { TopbarBadge } from '@/types/comfy'

withDefaults(
  defineProps<{
    badge: TopbarBadge
    reverseOrder?: boolean
    noPadding?: boolean
    labelClass?: string
    textClass?: string
  }>(),
  {
    reverseOrder: false,
    noPadding: false,
    labelClass: '',
    textClass: ''
  }
)
</script>
