<script setup lang="ts">
import { AppWindow, Box, Workflow, FileImage, Layers } from '@lucide/vue'
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  src,
  mediaKind,
  kind = 'WORKFLOW',
  class: className
} = defineProps<{
  src?: string
  mediaKind?: 'image' | 'video'
  /** Picks the placeholder icon when there is no image. */
  kind?: 'MODEL' | 'WORKFLOW' | 'APP' | 'MEDIA' | 'TEMPLATE_SET'
  class?: string
}>()
const placeholder = {
  MODEL: Box,
  WORKFLOW: Workflow,
  APP: AppWindow,
  MEDIA: FileImage,
  TEMPLATE_SET: Layers
}
const isVideo = computed(
  () =>
    src !== undefined &&
    (mediaKind === 'video' ||
      (mediaKind === undefined && /\.(mp4|webm|mov)(\?|$)/i.test(src)))
)
</script>

<template>
  <span
    :class="
      cn(
        'grid aspect-3/2 shrink-0 place-items-center overflow-hidden rounded-md border border-admin-line bg-admin-raised text-admin-subtle',
        className
      )
    "
    aria-hidden="true"
  >
    <img
      v-if="src && !isVideo"
      :src
      alt=""
      class="size-full object-cover"
      loading="lazy"
    />
    <component :is="placeholder[kind]" v-else class="size-4" />
  </span>
</template>
