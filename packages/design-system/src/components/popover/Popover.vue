<script setup lang="ts">
import { unrefElement } from '@vueuse/core'
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, useTemplateRef } from 'vue'

import PopoverContent from './PopoverContent.vue'
import { usePopoverViewportDismiss } from './usePopoverViewportDismiss'

defineOptions({
  inheritAttrs: false
})

const { showArrow = true } = defineProps<{
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
    <PopoverContent
      side="bottom"
      :side-offset="5"
      :collision-padding="10"
      v-bind="$attrs"
    >
      <slot :close />
      <PopoverArrow v-if="showArrow" class="fill-background stroke-border" />
    </PopoverContent>
  </PopoverRoot>
</template>
