<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-muted-foreground">
      {{ t('maskEditor.paintBucketSettings') }}
    </h3>

    <SliderField
      :label="t('maskEditor.tolerance')"
      :model-value="tolerancePercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      @update:model-value="onToleranceChange"
    />

    <SliderField
      :label="t('maskEditor.fillOpacity')"
      :model-value="store.fillOpacity"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      @update:model-value="onFillOpacityChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

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
