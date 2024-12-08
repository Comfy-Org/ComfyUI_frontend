<template>
  <video controls width="100%" height="100%">
    <source :src="url" :type="htmlVideoType" />
    {{ $t('g.videoFailedToLoad') }}
  </video>
</template>

<script setup lang="ts">
import { ResultItemImpl } from '@/stores/queueStore'
import { useSettingStore } from '@/stores/settingStore'
import { computed } from 'vue'

const props = defineProps<{
  result: ResultItemImpl
}>()

const settingStore = useSettingStore()
const vhsAdvancedPreviews = computed(() =>
  settingStore.get('VHS.AdvancedPreviews')
)

const url = computed(() =>
  vhsAdvancedPreviews.value
    ? props.result.vhsAdvancedPreviewUrl
    : props.result.url
)
const htmlVideoType = computed(() =>
  vhsAdvancedPreviews.value ? 'video/webm' : props.result.htmlVideoType
)
</script>
