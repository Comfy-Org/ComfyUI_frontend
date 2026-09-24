<template>
  <video controls class="max-h-[90vh] max-w-[90vw]">
    <source :src="src" :type="sourceType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { LightboxVideoItem } from '@/types/lightboxItem'

const { url, mimeType, advancedPreviewUrl } =
  defineProps<Omit<LightboxVideoItem, 'kind'>>()

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
