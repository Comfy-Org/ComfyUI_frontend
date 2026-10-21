<script setup lang="ts">
import { unrefElement } from '@vueuse/core'
import {
  PopoverArrow,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal
} from 'reka-ui'

import { ref, useTemplateRef } from 'vue'

import { usePopoverViewportDismiss } from './popover/usePopoverViewportDismiss'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const { to, showArrow = true } = defineProps<{
  to?: string | HTMLElement
  showArrow?: boolean
}>()

const open = ref(false)
const trigger = useTemplateRef('trigger')
usePopoverViewportDismiss(open, () => unrefElement(trigger))
</script>

<template>
  <PopoverRoot v-slot="{ close }" v-model:open="open">
    <PopoverTrigger ref="trigger" as-child>
      <slot name="button" />
    </PopoverTrigger>
    <PopoverPortal :key="Number(open)" :to>
      <PopoverContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        v-bind="$attrs"
        :class="
          cn(
            'z-overlay rounded-lg border border-border/50 bg-background p-2 shadow-sm will-change-[transform,opacity] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            $attrs.class
          )
        "
      >
        <slot :close />
        <PopoverArrow
          v-if="showArrow"
          class="fill-background stroke-border/50"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
