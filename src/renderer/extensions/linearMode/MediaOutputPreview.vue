<script setup lang="ts">
import { defineAsyncComponent, useAttrs } from 'vue'

import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import VideoPreview from '@/renderer/extensions/linearMode/VideoPreview.vue'
import { getMediaType } from '@/renderer/extensions/linearMode/mediaTypes'
import type { ResultItemImpl } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

const Preview3d = defineAsyncComponent(
  () => import('@/renderer/extensions/linearMode/Preview3d.vue')
)

defineOptions({ inheritAttrs: false })

const { output } = defineProps<{
  output: ResultItemImpl
  mobile?: boolean
}>()

const attrs = useAttrs()
</script>
<template>
  <ImagePreview
    v-if="getMediaType(output) === 'images'"
    :class="attrs.class as string"
    :mobile
    :src="output.url"
  />
  <VideoPreview
    v-else-if="getMediaType(output) === 'video'"
    :src="output.url"
    :class="
      cn('object-contain flex-1 md:contain-size md:p-3', attrs.class as string)
    "
  />
  <audio
    v-else-if="getMediaType(output) === 'audio'"
    :class="cn('w-full m-auto', attrs.class as string)"
    controls
    :src="output.url"
  />
  <article
    v-else-if="getMediaType(output) === 'text'"
    :class="
      cn('w-full max-w-128 m-auto my-12 overflow-y-auto', attrs.class as string)
    "
    v-text="output.url"
  />
  <Preview3d
    v-else-if="getMediaType(output) === '3d'"
    :class="attrs.class as string"
    :model-url="output.url"
  />
</template>
