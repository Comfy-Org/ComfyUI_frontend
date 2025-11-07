<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3
      class="text-center text-[15px] font-sans text-[var(--descrip-text)] mt-2.5"
    >
      {{ t('maskEditor.brushSettings') }}
    </h3>

    <button
      class="w-45 h-7.5 border-none bg-black/20 border border-[var(--border-color)] text-[var(--input-text)] font-sans text-[15px] pointer-events-auto transition-colors duration-100 hover:bg-[var(--p-overlaybadge-outline-color)] hover:border-none"
      @click="resetToDefault"
    >
      {{ t('maskEditor.resetToDefault') }}
    </button>

    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left text-xs font-sans text-[var(--descrip-text)]">{{
        t('maskEditor.brushShape')
      }}</span>
      <div
        class="flex flex-row gap-2.5 items-center min-h-6 relative h-[50px] w-full rounded-[10px] bg-[var(--p-surface-300)] dark-theme:bg-[var(--p-surface-800)]"
      >
        <div
          class="maskEditor_sidePanelBrushShapeCircle bg-transparent hover:bg-[var(--comfy-menu-bg)] dark-theme:hover:bg-[var(--p-surface-900)]"
          :class="{ active: store.brushSettings.type === BrushShape.Arc }"
          :style="{
            background:
              store.brushSettings.type === BrushShape.Arc
                ? 'var(--p-button-text-primary-color)'
                : ''
          }"
          @click="setBrushShape(BrushShape.Arc)"
        ></div>
        <div
          class="maskEditor_sidePanelBrushShapeSquare bg-transparent hover:bg-[var(--comfy-menu-bg)] dark-theme:hover:bg-[var(--p-surface-900)]"
          :class="{ active: store.brushSettings.type === BrushShape.Rect }"
          :style="{
            background:
              store.brushSettings.type === BrushShape.Rect
                ? 'var(--p-button-text-primary-color)'
                : ''
          }"
          @click="setBrushShape(BrushShape.Rect)"
        ></div>
      </div>
    </div>

    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left text-xs font-sans text-[var(--descrip-text)]">{{
        t('maskEditor.colorSelector')
      }}</span>
      <input type="color" :value="store.rgbColor" @input="onColorChange" />
    </div>

    <SliderControl
      :label="t('maskEditor.thickness')"
      :min="1"
      :max="100"
      :step="1"
      :model-value="store.brushSettings.size"
      @update:model-value="onThicknessChange"
    />

    <SliderControl
      :label="t('maskEditor.opacity')"
      :min="0"
      :max="1"
      :step="0.01"
      :model-value="store.brushSettings.opacity"
      @update:model-value="onOpacityChange"
    />

    <SliderControl
      :label="t('maskEditor.hardness')"
      :min="0"
      :max="1"
      :step="0.01"
      :model-value="store.brushSettings.hardness"
      @update:model-value="onHardnessChange"
    />

    <SliderControl
      :label="t('maskEditor.smoothingPrecision')"
      :min="1"
      :max="100"
      :step="1"
      :model-value="store.brushSettings.smoothingPrecision"
      @update:model-value="onSmoothingPrecisionChange"
    />
  </div>
</template>

<script setup lang="ts">
import { BrushShape } from '@/extensions/core/maskeditor/types'
import { t } from '@/i18n'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import SliderControl from './controls/SliderControl.vue'

const store = useMaskEditorStore()

const setBrushShape = (shape: BrushShape) => {
  store.brushSettings.type = shape
}

const onColorChange = (event: Event) => {
  store.rgbColor = (event.target as HTMLInputElement).value
}

const onThicknessChange = (value: number) => {
  store.setBrushSize(value)
}

const onOpacityChange = (value: number) => {
  store.setBrushOpacity(value)
}

const onHardnessChange = (value: number) => {
  store.setBrushHardness(value)
}

const onSmoothingPrecisionChange = (value: number) => {
  store.setBrushSmoothingPrecision(value)
}

const resetToDefault = () => {
  store.resetBrushToDefault()
}
</script>
