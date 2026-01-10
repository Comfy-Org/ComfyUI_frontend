<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3
      class="text-center text-[15px] font-sans text-[var(--descrip-text)] mt-2.5"
    >
      {{ t('imageCanvas.paintBucketSettings') }}
    </h3>

    <SliderControl
      :label="t('imageCanvas.tolerance')"
      :min="0"
      :max="255"
      :step="1"
      :model-value="store.paintBucketTolerance"
      @update:model-value="onToleranceChange"
    />

    <SliderControl
      :label="t('imageCanvas.fillOpacity')"
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
import { useimageCanvasStore } from '@/stores/imageCanvasStore'

import SliderControl from './controls/SliderControl.vue'

const store = useimageCanvasStore()

const onToleranceChange = (value: number) => {
  store.setPaintBucketTolerance(value)
}

const onFillOpacityChange = (value: number) => {
  store.setFillOpacity(value)
}
</script>
