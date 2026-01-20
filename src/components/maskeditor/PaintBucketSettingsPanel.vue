<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3
      class="mt-2.5 text-center font-sans text-[15px] text-[var(--descrip-text)]"
    >
      {{ t('maskEditor.paintBucketSettings') }}
    </h3>

    <SliderControl
      :label="t('maskEditor.tolerance')"
      :min="0"
      :max="255"
      :step="1"
      :model-value="store.paintBucketTolerance"
      @update:model-value="onToleranceChange"
    />

    <SliderControl
      :label="t('maskEditor.fillOpacity')"
      :min="0"
      :max="100"
      :step="1"
      :model-value="store.fillOpacity"
      @update:model-value="onFillOpacityChange"
    />
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import SliderControl from './controls/SliderControl.vue'

const store = useMaskEditorStore()

const onToleranceChange = (value: number) => {
  store.setPaintBucketTolerance(value)
}

const onFillOpacityChange = (value: number) => {
  store.setFillOpacity(value)
}
</script>
