<template>
  <video
    ref="video"
    controls
    :autoplay="autoplay"
    class="max-h-[90vh] max-w-[90vw]"
  >
    <source data-testid="lightbox-video-source" :src :type="sourceType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed, onActivated, useTemplateRef } from 'vue'

import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { LightboxVideoItem } from '@/types/lightboxItem'

defineOptions({ name: 'LightboxVideo' })

const { url, mimeType, advancedPreviewUrl, autoplay } = defineProps<
  Omit<LightboxVideoItem, 'kind'> & { autoplay?: boolean }
>()

const videoElement = useTemplateRef<HTMLVideoElement>('video')

onActivated(() => {
  if (autoplay) void videoElement.value?.play().catch(() => {})
})

const settingStore = useSettingStore()
const { isExtensionInstalled, isExtensionEnabled } = useExtensionStore()

const vhsAdvancedPreviews = computed(
  () =>
    isExtensionInstalled('VideoHelperSuite.Core') &&
    isExtensionEnabled('VideoHelperSuite.Core') &&
    settingStore.get('VHS.AdvancedPreviews') &&
    settingStore.get('VHS.AdvancedPreviews') !== 'Never'
)

const useAdvancedPreview = computed(
  () => vhsAdvancedPreviews.value && advancedPreviewUrl !== undefined
)

const src = computed(() =>
  useAdvancedPreview.value ? advancedPreviewUrl : url
)
const sourceType = computed(() =>
  useAdvancedPreview.value ? 'video/webm' : mimeType
)
</script>
