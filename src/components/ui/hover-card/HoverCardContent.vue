<script setup lang="ts">
import { HoverCardContent, HoverCardPortal, useForwardProps } from 'reka-ui'
import type { HoverCardContentProps } from 'reka-ui'
import { computed, inject } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { zIndexManager } from '@/utils/zIndexManager'

import { hoverCardOpenKey } from './hoverCardContext'

const MODAL_BASE_Z_INDEX = 1700

const {
  class: className,
  side = 'bottom',
  sideOffset = 8,
  ...rest
} = defineProps<HoverCardContentProps & { class?: HTMLAttributes['class'] }>()

const forwarded = useForwardProps(computed(() => rest))

const open = inject(hoverCardOpenKey, undefined)
const contentStyle = computed(() => {
  if (!open?.value) return undefined
  const topZIndex = zIndexManager.getCurrent('modal')
  return topZIndex >= MODAL_BASE_Z_INDEX ? { zIndex: topZIndex + 1 } : undefined
})
</script>

<template>
  <HoverCardPortal>
    <HoverCardContent
      v-bind="forwarded"
      :side
      :side-offset
      :style="contentStyle"
      :class="
        cn(
          'z-1700 rounded-lg border border-border-subtle bg-secondary-background p-2.5 shadow-md outline-none',
          className
        )
      "
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>
