<template>
  <SettingsSection>
    <template #title>{{ t('maskEditor.paintBucketSettings') }}</template>

    <SliderField
      :label="t('maskEditor.tolerance')"
      :model-value="tolerancePercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :help-text="t('maskEditor.paintBucketToleranceHelp')"
      @update:model-value="onToleranceChange"
    />

    <SliderField
      :label="t('maskEditor.fillOpacity')"
      :model-value="store.fillOpacity"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :help-text="t('maskEditor.fillOpacityHelp')"
      @update:model-value="onFillOpacityChange"
    />
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

import SettingsSection from './controls/SettingsSection.vue'
import SliderField from './controls/SliderField.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const tolerancePercent = computed(() =>
  Math.round((store.paintBucketTolerance / 255) * 100)
)

function onToleranceChange(percent: number) {
  const clamped = Math.min(100, Math.max(0, percent))
  store.setPaintBucketTolerance(Math.round((clamped / 100) * 255))
}

function onFillOpacityChange(value: number) {
  store.setFillOpacity(value)
}
</script>
