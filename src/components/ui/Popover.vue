<script setup lang="ts">
import {
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import { ref } from 'vue'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'

defineOptions({
  inheritAttrs: false
})

const { to, showArrow = true } = defineProps<{
  to?: string | HTMLElement
  showArrow?: boolean
}>()

const open = ref(false)
const contentStyle = useModalLiftedZIndex(open)
</script>

<template>
  <PopoverRoot v-slot="{ close }" v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="button" />
    </PopoverTrigger>
    <PopoverPortal :to>
      <PopoverContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        v-bind="$attrs"
        :style="contentStyle"
        :class="
          cn(
            'z-1700 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm',
            $attrs.class,
            'will-change-[transform,opacity] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
          )
        "
      >
        <slot :close />
        <PopoverArrow
          v-if="showArrow"
          class="fill-base-background stroke-border-subtle"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
