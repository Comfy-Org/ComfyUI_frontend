<script setup lang="ts">
import { ImageOff } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { MediaKind } from '@/lib/cms/editor'

/** Shows a cover or example the way the Hub will, or says there is none. */
const {
  url,
  kind,
  class: className
} = defineProps<{ url: string; kind: MediaKind; class?: string }>()
</script>

<template>
  <div
    :class="
      cn(
        'grid place-items-center overflow-hidden rounded-lg border border-admin-line bg-admin-page',
        className
      )
    "
  >
    <video
      v-if="url && kind === 'video'"
      :src="url"
      muted
      loop
      autoplay
      playsinline
      class="size-full object-cover"
    />
    <img
      v-else-if="url && kind === 'image'"
      :src="url"
      alt=""
      class="size-full object-cover"
    />
    <ImageOff v-else class="size-5 text-admin-subtle" aria-hidden="true" />
  </div>
</template>
