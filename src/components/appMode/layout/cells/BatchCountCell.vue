<script setup lang="ts">
/**
 * BatchCountCell — system-pinned cell exposing "Number of runs"
 * (the batch count used when Run is clicked).
 *
 * At 1 row tall × 3 cols wide the label and input sit side-by-side.
 */
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
  <div class="flex size-full items-center justify-center gap-2 px-2">
    <span class="shrink-0 text-layout-md whitespace-nowrap text-layout-text">
      {{ t('linearMode.runCount') }}
    </span>
    <!-- w-28 (7rem) fits 32px × 2 stepper buttons + the input's 4ch
         min-width at text-layout-md. w-20 (the previous cap) left ~16px
         for the input, so the + button overflowed past the widget's
         dark bg onto the panel-chrome behind — reading as "broken".
         [&_input]:* centers the numeric value between the ± controls
         and forces the layout type scale over the widget's default
         text-xs. -->
    <ScrubableNumberInput
      v-model="batchCount"
      :aria-label="t('linearMode.runCount')"
      :min="1"
      :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
      class="w-28 shrink-0 [&_input]:text-center [&_input]:text-layout-md"
    />
  </div>
</template>
