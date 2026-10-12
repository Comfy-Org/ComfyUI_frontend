<script setup lang="ts">
import { ZIndex } from '@primeuix/utils/zindex'
import { HoverCardContent, HoverCardPortal, useForwardProps } from 'reka-ui'
import type { HoverCardContentProps } from 'reka-ui'
import { computed, inject } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { hoverCardOpenKey } from './hoverCardContext'

// Shared base for @primeuix's auto-incrementing 'modal' z-index counter.
const MODAL_BASE_Z_INDEX = 1700

const {
  class: className,
  side = 'bottom',
  sideOffset = 8,
  ...rest
} = defineProps<HoverCardContentProps & { class?: HTMLAttributes['class'] }>()

const forwarded = useForwardProps(computed(() => rest))

// Body-portaled content sits at a static z-1700 unless a dialog that joined
// @primeuix's 'modal' counter is open above it; then lift past that dialog.
const open = inject(hoverCardOpenKey, undefined)
const contentStyle = computed(() => {
  if (!open?.value) return undefined
  const topZIndex = ZIndex.getCurrent('modal')
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
