<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3
      class="text-center text-[15px] font-sans text-[var(--descrip-text)] mt-2.5"
    >
      {{ t('maskEditor.brushSettings') }}
    </h3>

    <button :class="textButtonClass" @click="resetToDefault">
      {{ t('maskEditor.resetToDefault') }}
    </button>

    <!-- Brush Shape -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left text-xs font-sans text-[var(--descrip-text)]">
        {{ t('maskEditor.brushShape') }}
      </span>

      <div
        class="flex flex-row gap-2.5 items-center h-[50px] w-full rounded-[10px] bg-secondary-background-hover"
      >
        <div
          class="maskEditor_sidePanelBrushShapeCircle bg-transparent hover:bg-comfy-menu-bg"
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
          class="maskEditor_sidePanelBrushShapeSquare bg-transparent hover:bg-comfy-menu-bg"
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

    <!-- Color -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left text-xs font-sans text-[var(--descrip-text)]">
        {{ t('maskEditor.colorSelector') }}
      </span>
      <input
        type="color"
        class="h-10 rounded-md cursor-pointer"
        :value="store.rgbColor"
        @input="onColorChange"
      />
    </div>

    <!-- Thickness -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-left text-xs font-sans text-[var(--descrip-text)]">
          {{ t('maskEditor.thickness') }}
        </span>
        <input
          type="number"
          class="w-16 px-2 py-1 text-sm text-center border rounded-md bg-[var(--comfy-menu-bg)] border-[var(--p-form-field-border-color)] text-[var(--input-text)]"
          :min="1"
          :max="500"
          :step="1"
          :value="store.brushSettings.size"
          @input="onThicknessInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="1"
        :max="500"
        :step="1"
        :model-value="store.brushSettings.size"
        @update:model-value="onThicknessChange"
      />
    </div>

    <!-- Opacity -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-left text-xs font-sans text-[var(--descrip-text)]">
          {{ t('maskEditor.opacity') }}
        </span>
        <input
          type="number"
          class="w-16 px-2 py-1 text-sm text-center border rounded-md bg-[var(--comfy-menu-bg)] border-[var(--p-form-field-border-color)] text-[var(--input-text)]"
          min="0"
          max="1"
          step="0.01"
          :value="store.brushSettings.opacity"
          @input="onOpacityInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="store.brushSettings.opacity"
        @update:model-value="onOpacityChange"
      />
    </div>

    <!-- Hardness -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-left text-xs font-sans text-[var(--descrip-text)]">
          {{ t('maskEditor.hardness') }}
        </span>
        <input
          type="number"
          class="w-16 px-2 py-1 text-sm text-center border rounded-md bg-[var(--comfy-menu-bg)] border-[var(--p-form-field-border-color)] text-[var(--input-text)]"
          min="0"
          max="1"
          step="0.01"
          :value="store.brushSettings.hardness"
          @input="onHardnessInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="store.brushSettings.hardness"
        @update:model-value="onHardnessChange"
      />
    </div>

    <!-- Step Size -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-left text-xs font-sans text-[var(--descrip-text)]">
          {{ t('maskEditor.stepSize') }}
        </span>
        <input
          type="number"
          class="w-16 px-2 py-1 text-sm text-center border rounded-md bg-[var(--comfy-menu-bg)] border-[var(--p-form-field-border-color)] text-[var(--input-text)]"
          min="1"
          max="100"
          step="1"
          :value="store.brushSettings.stepSize"
          @input="onStepSizeInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="1"
        :max="100"
        :step="1"
        :model-value="store.brushSettings.stepSize"
        @update:model-value="onStepSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { BrushShape } from '@/extensions/core/maskeditor/types'
import { t } from '@/i18n'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import SliderControl from './controls/SliderControl.vue'

const store = useMaskEditorStore()

const textButtonClass =
  'h-7.5 w-32 rounded-[10px] border border-[var(--p-form-field-border-color)] text-[var(--input-text)] font-sans transition-colors duration-100 bg-[var(--comfy-menu-bg)] hover:bg-secondary-background-hover'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/* Brush shape */
const setBrushShape = (shape: BrushShape) => {
  store.brushSettings.type = shape
}

/* Color */
const onColorChange = (event: Event) => {
  store.rgbColor = (event.target as HTMLInputElement).value
}

/* Thickness */
const onThicknessChange = (value: number) => {
  store.setBrushSize(value)
}

const onThicknessInputChange = (e: Event) => {
  const value = clamp(Number((e.target as HTMLInputElement).value), 1, 500)
  store.setBrushSize(value)
}

/* Opacity */
const onOpacityChange = (value: number) => {
  store.setBrushOpacity(value)
}

const onOpacityInputChange = (e: Event) => {
  const value = clamp(Number((e.target as HTMLInputElement).value), 0, 1)
  store.setBrushOpacity(value)
}

/* Hardness */
const onHardnessChange = (value: number) => {
  store.setBrushHardness(value)
}

const onHardnessInputChange = (e: Event) => {
  const value = clamp(Number((e.target as HTMLInputElement).value), 0, 1)
  store.setBrushHardness(value)
}

/* Step size */
const onStepSizeChange = (value: number) => {
  store.setBrushStepSize(value)
}

const onStepSizeInputChange = (e: Event) => {
  const value = clamp(Number((e.target as HTMLInputElement).value), 1, 100)
  store.setBrushStepSize(value)
}

/* Reset */
const resetToDefault = () => {
  store.resetBrushToDefault()
}
</script>
