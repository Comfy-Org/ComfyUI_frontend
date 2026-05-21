<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useQueueSettingsStore } from '@/stores/queueStore'

const { t } = useI18n()
const settingStore = useSettingStore()
const { batchCount } = storeToRefs(useQueueSettingsStore())
</script>

<template>
  <div class="flex size-full items-center justify-evenly">
    <span class="shrink-0 text-layout-md whitespace-nowrap text-layout-text">
      {{ t('linearMode.runCount') }}
    </span>
    <ScrubableNumberInput
      v-model="batchCount"
      :aria-label="t('linearMode.runCount')"
      :min="1"
      :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
      class="w-28 shrink-0 [&_button]:aspect-square [&_input]:text-center [&_input]:text-layout-md"
    />
  </div>
</template>
