<script setup lang="ts">
import { Workflow } from '@lucide/vue'
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

const { src, class: className } = defineProps<{
  src?: string
  class?: string
}>()
const isVideo = computed(
  () => src !== undefined && /\.(mp4|webm|mov)(\?|$)/i.test(src)
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
    <video
      v-if="src && isVideo"
      :src
      muted
      playsinline
      preload="metadata"
      class="size-full object-cover"
    />
    <img
      v-else-if="src"
      :src
      alt=""
      class="size-full object-cover"
      loading="lazy"
    />
    <Workflow v-else class="size-4" />
  </span>
</template>
