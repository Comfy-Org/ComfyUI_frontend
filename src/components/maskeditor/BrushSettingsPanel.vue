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
          class="maskEditor_sidePanelBrushShapeCircle hover:bg-comfy-menu-bg"
          :class="
            cn(
              store.brushSettings.type === BrushShape.Arc
                ? 'bg-[var(--p-button-text-primary-color)] active'
                : 'bg-transparent'
            )
          "
          @click="setBrushShape(BrushShape.Arc)"
        ></div>

        <div
          class="maskEditor_sidePanelBrushShapeSquare hover:bg-comfy-menu-bg"
          :class="
            cn(
              store.brushSettings.type === BrushShape.Rect
                ? 'bg-[var(--p-button-text-primary-color)] active'
                : 'bg-transparent'
            )
          "
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
          :max="250"
          :step="1"
          :value="store.brushSettings.size"
          @input="thickness.onInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="1"
        :max="250"
        :step="1"
        :model-value="store.brushSettings.size"
        @update:model-value="thickness.onSliderChange"
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
          :min="0"
          :max="1"
          :step="0.01"
          :value="store.brushSettings.opacity"
          @input="opacity.onInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="store.brushSettings.opacity"
        @update:model-value="opacity.onSliderChange"
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
          :min="0"
          :max="1"
          :step="0.01"
          :value="store.brushSettings.hardness"
          @input="hardness.onInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.01"
        :model-value="store.brushSettings.hardness"
        @update:model-value="hardness.onSliderChange"
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
          :min="1"
          :max="100"
          :step="1"
          :value="store.brushSettings.stepSize"
          @input="stepSize.onInputChange"
        />
      </div>
      <SliderControl
        class="flex-1"
        label=""
        :min="1"
        :max="100"
        :step="1"
        :model-value="store.brushSettings.stepSize"
        @update:model-value="stepSize.onSliderChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { clamp } from 'es-toolkit'

import { BrushShape } from '@/extensions/core/maskeditor/types'
import { t } from '@/i18n'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { cn } from '@/utils/tailwindUtil'

import SliderControl from './controls/SliderControl.vue'

const store = useMaskEditorStore()

const textButtonClass =
  'h-7.5 w-32 rounded-[10px] border border-[var(--p-form-field-border-color)] text-[var(--input-text)] font-sans transition-colors duration-100 bg-[var(--comfy-menu-bg)] hover:bg-secondary-background-hover'

/* Brush shape */
const setBrushShape = (shape: BrushShape) => {
  store.brushSettings.type = shape
}

/* Color */
const onColorChange = (e: Event) => {
  store.rgbColor = (e.target as HTMLInputElement).value
}

/* Handler factory */
const createHandlers = (
  setter: (value: number) => void,
  min: number,
  max: number
) => ({
  onSliderChange: (value: number) => setter(value),
  onInputChange: (e: Event) => {
    const value = clamp(Number((e.target as HTMLInputElement).value), min, max)
    setter(value)
  }
})

const thickness = createHandlers((v) => store.setBrushSize(v), 1, 250)
const opacity = createHandlers((v) => store.setBrushOpacity(v), 0, 1)
const hardness = createHandlers((v) => store.setBrushHardness(v), 0, 1)
const stepSize = createHandlers((v) => store.setBrushStepSize(v), 1, 100)

/* Reset */
const resetToDefault = () => {
  store.resetBrushToDefault()
}
</script>
