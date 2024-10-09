<template>
  <video controls width="100%" height="100%">
    <source :src="url" :type="result.htmlVideoType" />
    {{ $t('videoFailedToLoad') }}
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
const url = computed(() => {
  if (settingStore.get('VHS.AdvancedPreviews')) {
    return props.result.vhsAdvancedPreviewUrl
  }
  return props.result.url
})
</script>
