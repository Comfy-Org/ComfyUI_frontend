<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-(--descrip-text)">
      {{ t('maskEditor.colorSelectSettings') }}
    </h3>

    <SliderControl
      :label="t('maskEditor.tolerance')"
      :min="0"
      :max="255"
      :step="1"
      :model-value="store.colorSelectTolerance"
      @update:model-value="onToleranceChange"
    />

    <SliderControl
      :label="t('maskEditor.selectionOpacity')"
      :min="0"
      :max="100"
      :step="1"
      :model-value="store.selectionOpacity"
      @update:model-value="onSelectionOpacityChange"
    />

    <ToggleControl
      :label="t('maskEditor.livePreview')"
      :model-value="store.colorSelectLivePreview"
      @update:model-value="onLivePreviewChange"
    />

    <ToggleControl
      :label="t('maskEditor.applyToWholeImage')"
      :model-value="store.applyWholeImage"
      @update:model-value="onWholeImageChange"
    />

    <DropdownControl
      :label="t('maskEditor.method')"
      :options="methodOptions"
      :model-value="store.colorComparisonMethod"
      @update:model-value="onMethodChange"
    />

    <ToggleControl
      :label="t('maskEditor.stopAtMask')"
      :model-value="store.maskBoundary"
      @update:model-value="onMaskBoundaryChange"
    />

    <SliderControl
      :label="t('maskEditor.maskTolerance')"
      :min="0"
      :max="255"
      :step="1"
      :model-value="store.maskTolerance"
      @update:model-value="onMaskToleranceChange"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { ColorComparisonMethod } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import DropdownControl from './controls/DropdownControl.vue'
import SliderControl from './controls/SliderControl.vue'
import ToggleControl from './controls/ToggleControl.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const methodOptions = Object.values(ColorComparisonMethod)

function onToleranceChange(value: number) {
  store.setColorSelectTolerance(value)
}

function onSelectionOpacityChange(value: number) {
  store.setSelectionOpacity(value)
}

function onLivePreviewChange(value: boolean) {
  store.colorSelectLivePreview = value
}

function onWholeImageChange(value: boolean) {
  store.applyWholeImage = value
}

function onMethodChange(value: string | number) {
  store.colorComparisonMethod = value as ColorComparisonMethod
}

function onMaskBoundaryChange(value: boolean) {
  store.maskBoundary = value
}

function onMaskToleranceChange(value: number) {
  store.setMaskTolerance(value)
}
</script>
