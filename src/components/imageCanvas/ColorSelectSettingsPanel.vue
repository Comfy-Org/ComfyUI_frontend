<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3
      class="text-center text-[15px] font-sans text-[var(--descrip-text)] mt-2.5"
    >
      {{ t('imageCanvas.colorSelectSettings') }}
    </h3>

    <SliderControl
      :label="t('imageCanvas.tolerance')"
      :min="0"
      :max="255"
      :step="1"
      :model-value="store.colorSelectTolerance"
      @update:model-value="onToleranceChange"
    />

    <SliderControl
      :label="t('imageCanvas.selectionOpacity')"
      :min="0"
      :max="100"
      :step="1"
      :model-value="store.selectionOpacity"
      @update:model-value="onSelectionOpacityChange"
    />

    <ToggleControl
      :label="t('imageCanvas.livePreview')"
      :model-value="store.colorSelectLivePreview"
      @update:model-value="onLivePreviewChange"
    />

    <ToggleControl
      :label="t('imageCanvas.applyToWholeImage')"
      :model-value="store.applyWholeImage"
      @update:model-value="onWholeImageChange"
    />

    <DropdownControl
      :label="t('imageCanvas.method')"
      :options="methodOptions"
      :model-value="store.colorComparisonMethod"
      @update:model-value="onMethodChange"
    />

    <ToggleControl
      :label="t('imageCanvas.stopAtMask')"
      :model-value="store.maskBoundary"
      @update:model-value="onMaskBoundaryChange"
    />

    <SliderControl
      :label="t('imageCanvas.maskTolerance')"
      :min="0"
      :max="255"
      :step="1"
      :model-value="store.maskTolerance"
      @update:model-value="onMaskToleranceChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ColorComparisonMethod } from '@/extensions/core/imageCanvas/types'
import { t } from '@/i18n'
import { useimageCanvasStore } from '@/stores/imageCanvasStore'

import DropdownControl from './controls/DropdownControl.vue'
import SliderControl from './controls/SliderControl.vue'
import ToggleControl from './controls/ToggleControl.vue'

const store = useimageCanvasStore()

const methodOptions = Object.values(ColorComparisonMethod)

const onToleranceChange = (value: number) => {
  store.setColorSelectTolerance(value)
}

const onSelectionOpacityChange = (value: number) => {
  store.setSelectionOpacity(value)
}

const onLivePreviewChange = (value: boolean) => {
  store.colorSelectLivePreview = value
}

const onWholeImageChange = (value: boolean) => {
  store.applyWholeImage = value
}

const onMethodChange = (value: string | number) => {
  store.colorComparisonMethod = value as ColorComparisonMethod
}

const onMaskBoundaryChange = (value: boolean) => {
  store.maskBoundary = value
}

const onMaskToleranceChange = (value: number) => {
  store.setMaskTolerance(value)
}
</script>
