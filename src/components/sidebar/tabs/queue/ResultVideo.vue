<template>
  <video ref="videoRef" controls class="max-h-[90vh] max-w-[90vw]">
    <source :src="url" :type="htmlVideoType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useReleaseMediaOnUnmount } from '@/composables/useReleaseMediaOnUnmount'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ResultItemImpl } from '@/stores/queueStore'

const props = defineProps<{
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
  vhsAdvancedPreviews.value
    ? props.result.vhsAdvancedPreviewUrl
    : props.result.url
)
const htmlVideoType = computed(() =>
  vhsAdvancedPreviews.value ? 'video/webm' : props.result.htmlVideoType
)

useReleaseMediaOnUnmount(useTemplateRef('videoRef'))
</script>
