<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import ZoomPane from '@comfyorg/design-system/media/ZoomPane'
import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'
import { cn } from '@comfyorg/tailwind-utils'

const { executionStatusMessage } = useExecutionStatus()

defineOptions({ inheritAttrs: false })

const { src, showSize = true } = defineProps<{
  src: string
  mobile?: boolean
  label?: string
  showSize?: boolean
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
    v-slot="slotProps"
    :class="
      cn('w-full flex-1', mobile && 'overflow-hidden', $attrs.class as string)
    "
  >
    <img
      ref="imageRef"
      :src
      v-bind="slotProps"
      class="size-full object-contain"
      data-testid="linear-image-preview"
      @load="onImageLoad"
    />
  </ZoomPane>
  <span
    v-if="executionStatusMessage"
    class="animate-pulse self-center text-muted-foreground md:z-10"
  >
    {{ executionStatusMessage }}
  </span>
  <span v-else-if="width && height" class="self-center md:z-10">
    {{ `${width} x ${height}` }}
    <template v-if="label"> | {{ label }}</template>
  </span>
</template>
