<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="text-descrip-text mt-2.5 text-center font-sans text-[15px]">
      {{ t('maskEditor.brushSettings') }}
    </h3>

    <button
      :class="textButtonClass"
      @click="resetToDefault"
    >
      {{ t('maskEditor.resetToDefault') }}
    </button>

    <!-- Brush Shape -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-descrip-text text-left font-sans text-xs">
        {{ t('maskEditor.brushShape') }}
      </span>

      <div
        class="flex h-[50px] w-full flex-row items-center gap-2.5 rounded-[10px] bg-secondary-background-hover"
      >
        <div
          class="maskEditor_sidePanelBrushShapeCircle hover:bg-comfy-menu-bg"
          :class="
            cn(
              store.brushSettings.type === BrushShape.Arc
                ? 'active bg-[var(--p-button-text-primary-color)]'
                : 'bg-transparent'
            )
          "
          @click="setBrushShape(BrushShape.Arc)"
        />

        <div
          class="maskEditor_sidePanelBrushShapeSquare hover:bg-comfy-menu-bg"
          :class="
            cn(
              store.brushSettings.type === BrushShape.Rect
                ? 'active bg-[var(--p-button-text-primary-color)]'
                : 'bg-transparent'
            )
          "
          @click="setBrushShape(BrushShape.Rect)"
        />
      </div>
    </div>

    <!-- Color -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-descrip-text text-left font-sans text-xs">
        {{ t('maskEditor.colorSelector') }}
      </span>
      <input
        ref="colorInputRef"
        v-model="store.rgbColor"
        type="color"
        class="h-10 cursor-pointer rounded-md"
      >
    </div>

    <!-- Thickness -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-descrip-text text-left font-sans text-xs">
          {{ t('maskEditor.thickness') }}
        </span>
        <input
          v-model.number="brushSize"
          type="number"
          class="border-p-form-field-border-color text-input-text w-16 rounded-md border bg-comfy-menu-bg px-2 py-1 text-center text-sm"
          :min="1"
          :max="250"
          :step="1"
        >
      </div>
      <SliderControl
        v-model="brushSize"
        class="flex-1"
        label=""
        :min="1"
        :max="250"
        :step="1"
      />
    </div>

    <!-- Opacity -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-descrip-text text-left font-sans text-xs">
          {{ t('maskEditor.opacity') }}
        </span>
        <input
          v-model.number="brushOpacity"
          type="number"
          class="border-p-form-field-border-color text-input-text w-16 rounded-md border bg-comfy-menu-bg px-2 py-1 text-center text-sm"
          :min="0"
          :max="1"
          :step="0.01"
        >
      </div>
      <SliderControl
        v-model="brushOpacity"
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.01"
      />
    </div>

    <!-- Hardness -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-descrip-text text-left font-sans text-xs">
          {{ t('maskEditor.hardness') }}
        </span>
        <input
          v-model.number="brushHardness"
          type="number"
          class="border-p-form-field-border-color text-input-text w-16 rounded-md border bg-comfy-menu-bg px-2 py-1 text-center text-sm"
          :min="0"
          :max="1"
          :step="0.01"
        >
      </div>
      <SliderControl
        v-model="brushHardness"
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.01"
      />
    </div>

    <!-- Step Size -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-descrip-text text-left font-sans text-xs">
          {{ t('maskEditor.stepSize') }}
        </span>
        <input
          v-model.number="brushStepSize"
          type="number"
          class="border-p-form-field-border-color text-input-text w-16 rounded-md border bg-comfy-menu-bg px-2 py-1 text-center text-sm"
          :min="1"
          :max="100"
          :step="1"
        >
      </div>
      <SliderControl
        v-model="brushStepSize"
        class="flex-1"
        label=""
        :min="1"
        :max="100"
        :step="1"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { BrushShape } from '@/extensions/core/maskeditor/types'
import { t } from '@/i18n'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { cn } from '@/utils/tailwindUtil'

import SliderControl from './controls/SliderControl.vue'

const store = useMaskEditorStore()

const colorInputRef = ref<HTMLInputElement>()

const textButtonClass =
  'h-7.5 w-32 rounded-[10px] border border-p-form-field-border-color text-input-text font-sans transition-colors duration-100 bg-comfy-menu-bg hover:bg-secondary-background-hover'

/* Computed properties that use store setters for validation */
const brushSize = computed({
  get: () => store.brushSettings.size,
  set: (value: number) => store.setBrushSize(value)
})

const brushOpacity = computed({
  get: () => store.brushSettings.opacity,
  set: (value: number) => store.setBrushOpacity(value)
})

const brushHardness = computed({
  get: () => store.brushSettings.hardness,
  set: (value: number) => store.setBrushHardness(value)
})

const brushStepSize = computed({
  get: () => store.brushSettings.stepSize,
  set: (value: number) => store.setBrushStepSize(value)
})

/* Brush shape */
const setBrushShape = (shape: BrushShape) => {
  store.brushSettings.type = shape
}

/* Reset */
const resetToDefault = () => {
  store.resetBrushToDefault()
}

onMounted(() => {
  if (colorInputRef.value) {
    store.colorInput = colorInputRef.value
  }
})

onBeforeUnmount(() => {
  store.colorInput = null
})
</script>
