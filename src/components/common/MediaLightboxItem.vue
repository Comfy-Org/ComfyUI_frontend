<template>
  <KeepAlive :max="RETAINED_VIDEO_COUNT">
    <ResultVideo
      v-if="isVideoResult(item)"
      :key="resultItemUrl(item)"
      :result="item"
    />
  </KeepAlive>
  <ComfyImage
    v-if="isImageResult(item)"
    :key="resultItemUrl(item)"
    :src="resultItemUrl(item)"
    :contain="false"
    :alt="item.filename"
    class="size-auto max-h-[90vh] max-w-[90vw] object-contain"
  />
  <ResultAudio v-if="isAudioResult(item)" :result="item" />
  <ResultText v-if="isTextResult(item)" :result="item" />
</template>

<script setup lang="ts">
import ComfyImage from '@/components/common/ComfyImage.vue'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  isAudioResult,
  isImageResult,
  isTextResult,
  isVideoResult
} from '@/utils/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'

import ResultAudio from './ResultAudio.vue'
import ResultText from './ResultText.vue'
import ResultVideo from './ResultVideo.vue'

const { item } = defineProps<{
  readonly item: AugmentedResultItem
}>()

const RETAINED_VIDEO_COUNT = 3
</script>
