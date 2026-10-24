<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-muted-foreground">
      {{ t('maskEditor.brushSettings') }}
    </h3>

    <Button
      variant="outline"
      size="unset"
      class="h-7.5 w-32 rounded-[10px] bg-background"
      @click="resetToDefault"
    >
      {{ t('maskEditor.resetToDefault') }}
    </Button>

    <!-- Brush Shape -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.brushShape') }}
      </span>

      <div
        class="flex h-[50px] w-full items-center gap-2.5 rounded-[10px] bg-accent"
      >
        <button
          type="button"
          :aria-label="t('maskEditor.brushShapeCircle')"
          :aria-pressed="store.brushSettings.type === BrushShape.Arc"
          :class="
            cn(
              'ml-2 size-[35px] cursor-pointer appearance-none rounded-full border border-solid p-0 transition-colors',
              store.brushSettings.type === BrushShape.Arc
                ? 'bg-background'
                : 'bg-transparent hover:bg-background/60'
            )
          "
          @click="setBrushShape(BrushShape.Arc)"
        />

        <button
          type="button"
          :aria-label="t('maskEditor.brushShapeSquare')"
          :aria-pressed="store.brushSettings.type === BrushShape.Rect"
          :class="
            cn(
              'size-[35px] cursor-pointer appearance-none border border-solid p-0 transition-colors',
              store.brushSettings.type === BrushShape.Rect
                ? 'bg-background'
                : 'bg-transparent hover:bg-background/60'
            )
          "
          @click="setBrushShape(BrushShape.Rect)"
        />
      </div>
    </div>

    <!-- Color -->
    <div class="flex flex-col gap-3 pb-3">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.colorSelector') }}
      </span>
      <input
        ref="colorInputRef"
        v-model="store.rgbColor"
        type="color"
        class="h-10 cursor-pointer rounded-md"
      />
    </div>

    <!-- Thickness -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-muted-foreground">
          {{ t('maskEditor.thickness') }}
        </span>
        <input
          v-model.number="brushSize"
          data-testid="brush-thickness-input"
          type="number"
          class="w-16 rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground"
          :min="1"
          :max="250"
          :step="1"
        />
      </div>
      <SliderControl
        v-model="brushSizeSliderValue"
        class="flex-1"
        label=""
        :min="0"
        :max="1"
        :step="0.001"
      />
    </div>

    <!-- Opacity -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-muted-foreground">
          {{ t('maskEditor.opacity') }}
        </span>
        <input
          v-model.number="brushOpacity"
          type="number"
          class="w-16 rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground"
          :min="0"
          :max="1"
          :step="0.01"
        />
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
        <span class="text-left font-sans text-xs text-muted-foreground">
          {{ t('maskEditor.hardness') }}
        </span>
        <input
          v-model.number="brushHardness"
          type="number"
          class="w-16 rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground"
          :min="0"
          :max="1"
          :step="0.01"
        />
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
        <span class="text-left font-sans text-xs text-muted-foreground">
          {{ t('maskEditor.stepSize') }}
        </span>
        <input
          v-model.number="brushStepSize"
          type="number"
          class="w-16 rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground"
          :min="1"
          :max="100"
          :step="1"
        />
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
import Button from '@/components/ui/button/Button.vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { BrushShape } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { cn } from '@comfyorg/tailwind-utils'

import SliderControl from './controls/SliderControl.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const colorInputRef = ref<HTMLInputElement>()

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
