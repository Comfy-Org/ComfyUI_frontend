<template>
  <div class="flex flex-col gap-3 pb-3">
    <div class="mt-2.5 flex items-center justify-between gap-2">
      <h3 class="text-descrip-text text-center font-sans text-[15px]">
        {{ t('maskEditor.brushSettings') }}
      </h3>
      <Button
        variant="base"
        size="icon"
        :title="t('maskEditor.resetToDefault')"
        @click="resetToDefault"
      >
        <i class="icon-[lucide--rotate-ccw] size-4" />
      </Button>
    </div>

    <!-- Brush Shape -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left font-sans text-xs text-(--descrip-text)">
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
                ? 'active bg-(--p-button-text-primary-color)'
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
                ? 'active bg-(--p-button-text-primary-color)'
                : 'bg-transparent'
            )
          "
          @click="setBrushShape(BrushShape.Rect)"
        ></div>
      </div>
    </div>

    <!-- Thickness -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.thickness') }}
        </span>
        <div class="relative">
          <input
            v-model.number="brushSize"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            :min="1"
            :max="250"
            :step="1"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >px</span
          >
        </div>
      </div>
      <Slider
        :model-value="brushSizeSliderValue"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="1"
        :step="0.001"
        @update:model-value="onBrushSizeSliderChange"
      />
    </div>

    <!-- Opacity -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.opacity') }}
        </span>
        <div class="relative">
          <input
            v-model.number="brushOpacity"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            :min="0"
            :max="100"
            :step="1"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >%</span
          >
        </div>
      </div>
      <Slider
        :model-value="brushOpacity * 100"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="onBrushOpacityChange"
      />
    </div>

    <!-- Hardness -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.hardness') }}
        </span>
        <div class="relative">
          <input
            v-model.number="brushHardness"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            :min="0"
            :max="100"
            :step="1"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >%</span
          >
        </div>
      </div>
      <Slider
        :model-value="brushHardness"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="onBrushHardnessChange"
      />
    </div>

    <!-- Step Size -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.stepSize') }}
        </span>
        <div class="relative">
          <input
            v-model.number="brushStepSize"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            :min="1"
            :max="100"
            :step="1"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >px</span
          >
        </div>
      </div>
      <Slider
        :model-value="brushStepSize"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="1"
        :max="100"
        :step="1"
        @update:model-value="onBrushStepSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Slider from 'primevue/slider'
import { BrushShape } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { cn } from '@/utils/tailwindUtil'

const { t } = useI18n()
const store = useMaskEditorStore()

/* Computed properties that use store setters for validation */
const brushSize = computed({
  get: () => store.brushSettings.size,
  set: (value: number) => store.setBrushSize(value)
})

const rawSliderValue = ref<number | null>(null)

const brushSizeSliderValue = computed({
  get: () => {
    if (rawSliderValue.value !== null) {
      const cachedSize = Math.round(Math.pow(250, rawSliderValue.value))
      if (cachedSize === brushSize.value) {
        return rawSliderValue.value
      }
    }

    return Math.log(brushSize.value) / Math.log(250)
  },
  set: (value: number) => {
    rawSliderValue.value = value
    const size = Math.round(Math.pow(250, value))
    store.setBrushSize(size)
  }
})

const brushOpacity = computed({
  get: () => Math.round(store.brushSettings.opacity * 100),
  set: (value: number) => store.setBrushOpacity(value / 100)
})

const brushHardness = computed({
  get: () => Math.round(store.brushSettings.hardness * 100),
  set: (value: number) => store.setBrushHardness(value / 100)
})

const brushStepSize = computed({
  get: () => store.brushSettings.stepSize,
  set: (value: number) => store.setBrushStepSize(value)
})

/* Brush shape */
const setBrushShape = (shape: BrushShape) => {
  store.brushSettings.type = shape
}

const onBrushSizeSliderChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  brushSizeSliderValue.value = numValue
}

const onBrushOpacityChange = (value: number | number[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : (value ?? 0)
  brushOpacity.value = rawValue
}

const onBrushHardnessChange = (value: number | number[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : (value ?? 0)
  brushHardness.value = rawValue
}

const onBrushStepSizeChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  brushStepSize.value = numValue
}

/* Reset */
const resetToDefault = () => {
  store.resetBrushToDefault()
}
</script>
