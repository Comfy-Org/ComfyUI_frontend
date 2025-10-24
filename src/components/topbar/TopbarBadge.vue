<template>
  <div
    v-tooltip="badge.tooltip"
    class="flex h-full shrink-0 items-center gap-2 whitespace-nowrap"
    :class="[{ 'flex-row-reverse': reverseOrder }, noPadding ? '' : 'px-3']"
    :style="{ backgroundColor: 'var(--comfy-menu-bg)' }"
  >
    <i
      v-if="iconClass"
      :class="['shrink-0 text-base', iconClass, iconColorClass]"
    />
    <div
      v-if="badge.label"
      class="shrink-0 rounded-full px-1.5 py-0.5 text-xxxs font-semibold"
      :class="labelClasses"
    >
      {{ badge.label }}
    </div>
    <div class="font-inter text-sm font-extrabold" :class="textClasses">
      {{ badge.text }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

import type { TopbarBadge } from '@/types/comfy'

const props = withDefaults(
  defineProps<{
    badge: TopbarBadge
    reverseOrder?: boolean
    noPadding?: boolean
  }>(),
  {
    reverseOrder: false,
    noPadding: false
  }
)

const variant = computed(() => props.badge.variant ?? 'info')

const labelClasses = computed(() => {
  switch (variant.value) {
    case 'error':
      return 'bg-danger-100 text-white'
    case 'warning':
      return 'bg-warning-100 text-black'
    case 'info':
    default:
      return 'bg-white text-black'
  }
})

const textClasses = computed(() => {
  switch (variant.value) {
    case 'error':
      return 'text-danger-100'
    case 'warning':
      return 'text-warning-100'
    case 'info':
    default:
      return 'text-slate-100'
  }
})

const iconColorClass = computed(() => textClasses.value)

const iconClass = computed(() => {
  if (props.badge.icon) {
    return props.badge.icon
  }
  switch (variant.value) {
    case 'error':
      return 'pi pi-exclamation-circle'
    case 'warning':
      return 'pi pi-exclamation-triangle'
    case 'info':
    default:
      return undefined
  }
})
</script>
