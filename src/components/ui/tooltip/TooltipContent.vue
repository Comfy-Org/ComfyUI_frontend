<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { CSSProperties, HTMLAttributes } from 'vue'
import { inject, ref, watch } from 'vue'

import { TOOLTIP_KEY } from './tooltipContext'

const { class: className, side = 'bottom' } = defineProps<{
  class?: HTMLAttributes['class']
  side?: 'top' | 'bottom' | 'left' | 'right'
}>()

const ctx = inject(TOOLTIP_KEY)
const style = ref<CSSProperties>({})

function computeStyle() {
  if (!ctx?.triggerEl.value) return {}
  const rect = ctx.triggerEl.value.getBoundingClientRect()
  const gap = 6

  if (side === 'top') {
    return {
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top - gap}px`,
      transform: 'translate(-50%, -100%)'
    }
  }
  if (side === 'left') {
    return {
      left: `${rect.left - gap}px`,
      top: `${rect.top + rect.height / 2}px`,
      transform: 'translate(-100%, -50%)'
    }
  }
  if (side === 'right') {
    return {
      left: `${rect.right + gap}px`,
      top: `${rect.top + rect.height / 2}px`,
      transform: 'translateY(-50%)'
    }
  }
  return {
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.bottom + gap}px`,
    transform: 'translateX(-50%)'
  }
}

watch(
  () => ctx?.open.value,
  (open) => {
    if (open) style.value = computeStyle()
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-75"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ctx?.open.value"
        :style="style"
        :class="
          cn(
            'pointer-events-none fixed z-9999 max-w-xs rounded-md border border-node-component-tooltip-border bg-node-component-tooltip-surface px-2 py-1 text-xs leading-none text-node-component-tooltip',
            className
          )
        "
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
