<script setup lang="ts">
import { computed, defineAsyncComponent, useAttrs } from 'vue'

import ImageComparePreview from '@/renderer/extensions/linearMode/ImageComparePreview.vue'
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
const mediaType = computed(() => getMediaType(output))
const outputLabel = computed(
  () => output.display_name?.trim() || output.filename
)
</script>
<template>
  <ImageComparePreview
    v-if="mediaType === 'image_compare' && output.compareImages"
    :class="cn('flex-1', attrs.class as string)"
    :compare-images="output.compareImages"
  />
  <template v-else-if="mediaType === 'images' || mediaType === 'video'">
    <ImagePreview
      v-if="mediaType === 'images'"
      :class="attrs.class as string"
      :mobile
      :src="output.url"
      :label="outputLabel"
    />
    <VideoPreview
      v-else
      :src="output.url"
      :label="outputLabel"
      :class="
        cn(
          'flex-1 object-contain md:p-3 md:contain-size',
          attrs.class as string
        )
      "
    />
  </template>
  <template v-else>
    <audio
      v-if="mediaType === 'audio'"
      :class="cn('m-auto w-full', attrs.class as string)"
      controls
      :src="output.url"
    />
    <article
      v-else-if="mediaType === 'text'"
      :class="
        cn(
          'm-auto my-12 size-full max-w-2xl scroll-shadows-secondary-background overflow-y-auto rounded-lg bg-secondary-background p-4 whitespace-pre-wrap',
          attrs.class as string
        )
      "
      v-text="output.content"
    />
    <Preview3d
      v-else-if="mediaType === '3d'"
      :class="attrs.class as string"
      :model-url="output.url"
    />
    <span v-if="outputLabel" class="self-center text-sm">
      {{ outputLabel }}
    </span>
  </template>
</template>
