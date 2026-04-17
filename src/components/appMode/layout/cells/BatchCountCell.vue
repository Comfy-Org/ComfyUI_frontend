<script setup lang="ts">
/**
 * BatchCountCell — system-pinned cell exposing "Number of runs"
 * (the batch count used when Run is clicked).
 *
 * At 1 row tall × 3 cols wide the label and input sit side-by-side.
 * This cell is also the first label/widget pair broken into its own
 * layout cell — a template for Phase 2 when every input gets its
 * own cell.
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
  <div class="batch-count-cell">
    <span class="batch-count-cell__label">
      {{ t('linearMode.runCount') }}
    </span>
    <ScrubableNumberInput
      v-model="batchCount"
      :aria-label="t('linearMode.runCount')"
      :min="1"
      :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
      class="batch-count-cell__input"
    />
  </div>
</template>

<style scoped>
.batch-count-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
}

.batch-count-cell .batch-count-cell__label {
  flex-shrink: 0;
  font-size: var(--layout-font-md);
  /* Force the muted token — some PrimeVue themes set a brighter
     `--p-text-muted-color`, so clamp the fallback here to guarantee
     the label reads as the same gray used by widget subtitles. */
  color: #a1a1a1;
  white-space: nowrap;
}

.batch-count-cell__input {
  min-width: 0;
  flex: 1;
}

/* Center the number value inside ScrubableNumberInput so it sits
   between the − and + controls rather than biased to one side. */
.batch-count-cell :deep(input) {
  text-align: center;
  font-size: var(--layout-font-md);
}
</style>
