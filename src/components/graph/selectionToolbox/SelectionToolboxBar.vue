<template>
  <PopoverPortal :key="Number(open)">
    <PopoverContent
      side="bottom"
      :side-offset="BAR_SIDE_OFFSET"
      :collision-padding="10"
      update-position-strategy="always"
      class="z-overlay floating-panel will-change-[transform,opacity] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      @interact-outside="keepOpenForPressesInside"
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>

<script setup lang="ts">
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import { PopoverContent, PopoverPortal } from 'reka-ui'

import { BAR_SIDE_OFFSET } from './selectionToolboxBar'

const { open, keepOpenFor } = defineProps<{
  open: boolean
  keepOpenFor: string
}>()

const keepOpenForPressesInside = (
  event: FocusOutsideEvent | PointerDownOutsideEvent
) => {
  const { target } = event.detail.originalEvent
  if (target instanceof Element && target.closest(keepOpenFor)) {
    event.preventDefault()
  }
}
</script>
