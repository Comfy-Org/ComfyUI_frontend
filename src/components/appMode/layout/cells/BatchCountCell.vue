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
  <!-- `justify-evenly` distributes equal space on the left, between
       label-and-pill, and on the right — so all three margins match
       no matter how wide the label or pill end up rendering. -->
  <div class="flex size-full items-center justify-evenly">
    <span class="shrink-0 text-layout-md whitespace-nowrap text-layout-text">
      {{ t('linearMode.runCount') }}
    </span>
    <!-- w-28 (7rem) with square stepper buttons frees ~40px for the
         numeric input — enough for the typical 1–8 batch count plus
         hover-state breathing room around the ± buttons (at w-24 the
         hover fill reached the pill edge and read as the button
         being pushed against it). The square button aspect matches
         the height we forced via shared CSS (`height: 2.25rem` on
         `.bg-component-node-widget-background`) so the ± buttons
         stay proportional to the pill.
         [&_input]:* centers the numeric value between the ± controls
         and forces the layout type scale over the widget's default
         text-xs. -->
    <ScrubableNumberInput
      v-model="batchCount"
      :aria-label="t('linearMode.runCount')"
      :min="1"
      :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
      class="w-28 shrink-0 [&_button]:aspect-square [&_input]:text-center [&_input]:text-layout-md"
    />
  </div>
</template>
