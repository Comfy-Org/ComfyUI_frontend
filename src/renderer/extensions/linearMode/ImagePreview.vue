<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

import { useExecutionStatus } from '@/renderer/extensions/linearMode/useExecutionStatus'
import { cn } from '@comfyorg/tailwind-utils'

const { executionStatusMessage } = useExecutionStatus()

defineOptions({ inheritAttrs: false })

const {
  src,
  showSize = true,
  hideInfo = false,
  fit = 'contain'
} = defineProps<{
  src: string
  mobile?: boolean
  label?: string
  showSize?: boolean
  /** Hide the bottom size+label overlay (App Mode layout renders its own). */
  hideInfo?: boolean
  /** `cover` crops to fill the container; `contain` letterboxes. */
  fit?: 'contain' | 'cover'
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
  <div
    v-if="!mobile"
    :class="
      cn(
        'w-full flex-1 place-content-center contain-size',
        $attrs.class as string
      )
    "
  >
    <img
      ref="imageRef"
      :src
      :class="[
        'size-full',
        fit === 'cover' ? 'object-cover' : 'object-contain'
      ]"
      @load="onImageLoad"
    />
  </div>
  <img
    v-else
    ref="imageRef"
    :class="[
      'grow contain-size',
      fit === 'cover' ? 'object-cover' : 'object-contain'
    ]"
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
