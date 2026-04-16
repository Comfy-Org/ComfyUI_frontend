<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import ZoomPane from '@/components/ui/ZoomPane.vue'
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'
import { cn } from '@/utils/tailwindUtil'

const { executionStatusMessage } = useExecutionStatus()

defineOptions({ inheritAttrs: false })

const {
  src,
  showSize = true,
  hideInfo = false
} = defineProps<{
  src: string
  mobile?: boolean
  label?: string
  showSize?: boolean
  /** Hide the bottom size+label overlay (bento App Mode renders its own). */
  hideInfo?: boolean
}>()

const imageRef = useTemplateRef('imageRef')
const width = ref<number | null>(null)
const height = ref<number | null>(null)

function onImageLoad() {
  if (!imageRef.value || !showSize) return
  width.value = imageRef.value.naturalWidth
  height.value = imageRef.value.naturalHeight
}
</script>
<template>
  <ZoomPane
    v-if="!mobile"
    v-slot="slotProps"
    :class="cn('w-full flex-1', $attrs.class as string)"
  >
    <img
      ref="imageRef"
      :src
      v-bind="slotProps"
      class="size-full object-contain"
      @load="onImageLoad"
    />
  </ZoomPane>
  <img
    v-else
    ref="imageRef"
    class="grow object-contain contain-size"
    :src
    @load="onImageLoad"
  />
  <span
    v-if="!hideInfo && executionStatusMessage"
    class="animate-pulse self-center text-muted md:z-10"
  >
    {{ executionStatusMessage }}
  </span>
  <span v-else-if="!hideInfo && width && height" class="self-center md:z-10">
    {{ `${width} x ${height}` }}
    <template v-if="label"> | {{ label }}</template>
  </span>
</template>
