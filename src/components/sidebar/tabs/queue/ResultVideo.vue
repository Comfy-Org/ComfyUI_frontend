<template>
  <video
    ref="video"
    controls
    :autoplay="autoplay"
    class="max-h-[90vh] max-w-[90vw]"
  >
    <source
      data-testid="result-video-source"
      :src="url"
      :type="htmlVideoType"
    />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed, onActivated, useTemplateRef } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import {
  resultItemUrl,
  resultItemVhsAdvancedPreviewUrl
} from '@/utils/resultItemUrl'
import { resultItemHtmlVideoType } from '@/utils/resultItem'

/* MediaLightbox retains this component via KeepAlive include, which matches on
   the registered component name. */
defineOptions({ name: 'ResultVideo' })

const props = defineProps<{
  result: AugmentedResultItem
  autoplay?: boolean
}>()

const videoElement = useTemplateRef<HTMLVideoElement>('video')

onActivated(() => {
  if (props.autoplay) void videoElement.value?.play().catch(() => {})
})

const settingStore = useSettingStore()
const { isExtensionInstalled, isExtensionEnabled } = useExtensionStore()

const playsCloudAssetUrl = computed(() => isCloud && !!props.result.url)

const vhsAdvancedPreviews = computed(() => {
  return (
    !playsCloudAssetUrl.value &&
    isExtensionInstalled('VideoHelperSuite.Core') &&
    isExtensionEnabled('VideoHelperSuite.Core') &&
    settingStore.get('VHS.AdvancedPreviews') &&
    settingStore.get('VHS.AdvancedPreviews') !== 'Never'
  )
})

const url = computed(() =>
  vhsAdvancedPreviews.value
    ? resultItemVhsAdvancedPreviewUrl(props.result)
    : resultItemUrl(props.result)
)
const htmlVideoType = computed(() =>
  vhsAdvancedPreviews.value
    ? 'video/webm'
    : resultItemHtmlVideoType(props.result)
)
</script>
