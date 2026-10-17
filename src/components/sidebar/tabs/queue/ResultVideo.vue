<template>
  <video
    ref="video"
    controls
    :autoplay="autoplay"
    class="max-h-[90vh] max-w-[90vw]"
  >
    <source :src="url" :type="htmlVideoType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed, onActivated, useTemplateRef } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
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
  /** See `MediaLightbox`'s `autoplayVideo`. Off by default. */
  autoplay?: boolean
}>()

const videoElement = useTemplateRef<HTMLVideoElement>('video')

/* The `autoplay` attribute only fires on a fresh load, and `KeepAlive` above
   reactivates a revisited video instead of remounting it — so autoplay has to
   be re-applied here. Sticky activation from the click that opened the lightbox
   is what lets this play unmuted. */
onActivated(() => {
  if (props.autoplay) void videoElement.value?.play().catch(() => {})
})

const settingStore = useSettingStore()
const { isExtensionInstalled, isExtensionEnabled } = useExtensionStore()

const vhsAdvancedPreviews = computed(() => {
  return (
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
