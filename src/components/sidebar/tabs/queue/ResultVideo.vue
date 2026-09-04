<template>
  <video ref="videoRef" controls class="max-h-[90vh] max-w-[90vw]">
    <source :src="url" :type="htmlVideoType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { computed, onDeactivated, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ResultItemImpl } from '@/stores/queueStore'

/* MediaLightbox retains this component via KeepAlive include, which matches on
   the registered component name. */
defineOptions({ name: 'ResultVideo' })

const videoRef = ref<HTMLVideoElement>()

/* A KeepAlive-retained video keeps its element alive off-screen; without this
   it keeps playing audibly behind the next item. */
onDeactivated(() => {
  videoRef.value?.pause()
})

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
</script>
