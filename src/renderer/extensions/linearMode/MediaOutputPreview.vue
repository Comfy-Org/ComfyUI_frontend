<script setup lang="ts">
import { computed, defineAsyncComponent, useAttrs } from 'vue'

import { useTextFileContent } from '@/composables/useTextFileContent'
import ImagePreview from '@/renderer/extensions/linearMode/ImagePreview.vue'
import VideoPreview from '@/renderer/extensions/linearMode/VideoPreview.vue'
import { getMediaType } from '@/renderer/extensions/linearMode/mediaTypes'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'
import { cn } from '@comfyorg/tailwind-utils'

const Preview3d = defineAsyncComponent(
  () => import('@/renderer/extensions/linearMode/Preview3d.vue')
)

defineOptions({ inheritAttrs: false })

const { output } = defineProps<{
  output: AugmentedResultItem
  mobile?: boolean
}>()

const attrs = useAttrs()
const mediaType = computed(() => getMediaType(output))
const outputLabel = computed(
  () => output.display_name?.trim() || output.filename
)
const { textContent } = useTextFileContent(() =>
  mediaType.value === 'text'
    ? { content: output.content, url: resultItemUrl(output) }
    : undefined
)
const url = computed(() => resultItemUrl(output))
</script>
<template>
  <template v-if="mediaType === 'images' || mediaType === 'video'">
    <ImagePreview
      v-if="mediaType === 'images'"
      :class="attrs.class as string"
      :mobile
      :src="url"
      :label="outputLabel"
    />
    <VideoPreview
      v-else
      :src="url"
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
      :src="url"
    />
    <article
      v-else-if="mediaType === 'text'"
      :class="
        cn(
          'm-auto my-12 size-full max-w-2xl scroll-shadows-secondary-background overflow-y-auto rounded-lg bg-secondary-background p-4 whitespace-pre-wrap',
          attrs.class as string
        )
      "
      v-text="textContent"
    />
    <Preview3d
      v-else-if="mediaType === '3d'"
      :class="attrs.class as string"
      :model-url="url"
    />
    <span v-if="outputLabel" class="self-center text-sm">
      {{ outputLabel }}
    </span>
  </template>
</template>
