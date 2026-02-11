<template>
  <video controls width="100%" height="100%">
    <source :src="url" :type="htmlVideoType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ResultItemImpl } from '@/stores/queueStore'

const { result } = defineProps<{
  result: ResultItemImpl
}>()

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
  vhsAdvancedPreviews.value ? result.vhsAdvancedPreviewUrl : result.url
)
const htmlVideoType = computed(() =>
  vhsAdvancedPreviews.value ? 'video/webm' : result.htmlVideoType
)
</script>
