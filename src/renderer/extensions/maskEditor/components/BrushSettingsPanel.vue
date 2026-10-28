<template>
  <SettingsSection>
    <template #title>{{ t('maskEditor.brushSettings') }}</template>
    <template #actions>
      <Button
        variant="base"
        size="icon"
        :title="t('maskEditor.resetToDefault')"
        :aria-label="t('maskEditor.resetToDefault')"
        @click="resetToDefault"
      >
        <i class="icon-[lucide--rotate-ccw]" aria-hidden="true" />
      </Button>
    </template>

    <div class="flex flex-col gap-2">
      <span
        id="brush-shape-label"
        class="text-left font-sans text-xs text-muted-foreground"
      >
        {{ t('maskEditor.brushShape') }}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="brush-shape-label"
        class="flex h-12 w-full items-center gap-2 rounded-lg bg-secondary px-2"
        @keydown="onShapeKeydown"
      >
        <button
          ref="arcButton"
          type="button"
          role="radio"
          :aria-checked="store.brushSettings.type === BrushShape.Arc"
          :tabindex="store.brushSettings.type === BrushShape.Arc ? 0 : -1"
          :aria-label="t('maskEditor.brushShapeCircle')"
          :class="
            cn(
              'size-8 cursor-pointer appearance-none rounded-full border border-solid p-0 transition-colors',
              store.brushSettings.type === BrushShape.Arc
                ? 'border-primary bg-background'
                : 'border-border bg-transparent hover:bg-background/60'
            )
          "
          @click="setBrushShape(BrushShape.Arc)"
        />
        <button
          ref="rectButton"
          type="button"
          role="radio"
          :aria-checked="store.brushSettings.type === BrushShape.Rect"
          :tabindex="store.brushSettings.type === BrushShape.Rect ? 0 : -1"
          :aria-label="t('maskEditor.brushShapeSquare')"
          :class="
            cn(
              'size-8 cursor-pointer appearance-none border border-solid p-0 transition-colors',
              store.brushSettings.type === BrushShape.Rect
                ? 'border-primary bg-background'
                : 'border-border bg-transparent hover:bg-background/60'
            )
          "
          @click="setBrushShape(BrushShape.Rect)"
        />
      </div>
    </div>

    <SliderField
      :label="t('maskEditor.thickness')"
      :model-value="brushSize"
      :min="1"
      :max="250"
      :step="1"
      suffix="px"
      :slider="thicknessSlider"
      test-id="brush-thickness-input"
      @update:model-value="commitThickness"
      @slider-update="onThicknessSliderPosition"
    />

    <SliderField
      :label="t('maskEditor.opacity')"
      :model-value="brushOpacity"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      @update:model-value="onBrushOpacityChange"
    />
    <SliderField
      :label="t('maskEditor.hardness')"
      :model-value="brushHardness"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      :help-text="t('maskEditor.hardnessHelp')"
      @update:model-value="onBrushHardnessChange"
    />
    <SliderField
      :label="t('maskEditor.stepSize')"
      :model-value="store.brushSettings.stepSize"
      :min="1"
      :max="100"
      :step="1"
      suffix="px"
      :help-text="t('maskEditor.stepSizeHelp')"
      @update:model-value="onBrushStepSizeChange"
    />
  </SettingsSection>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { BrushShape } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { cn } from '@comfyorg/tailwind-utils'

import SettingsSection from './controls/SettingsSection.vue'
import SliderField from './controls/SliderField.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const SHAPE_ORDER: BrushShape[] = [BrushShape.Arc, BrushShape.Rect]

const arcButton = useTemplateRef<HTMLButtonElement>('arcButton')
const rectButton = useTemplateRef<HTMLButtonElement>('rectButton')

function onShapeKeydown(event: KeyboardEvent) {
  const deltas: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1
  }
  const delta = deltas[event.key]
  if (delta === undefined) return
  event.preventDefault()

  const nextIndex =
    (SHAPE_ORDER.indexOf(store.brushSettings.type) +
      delta +
      SHAPE_ORDER.length) %
    SHAPE_ORDER.length
  setBrushShape(SHAPE_ORDER[nextIndex])
  ;(SHAPE_ORDER[nextIndex] === BrushShape.Arc
    ? arcButton
    : rectButton
  ).value?.focus()
}

const rawSliderValue = ref<number | null>(null)

const brushSize = computed(() => Math.round(store.brushSettings.size))

const thicknessSliderValue = computed(() => {
  if (rawSliderValue.value !== null) {
    const cachedSize = Math.round(Math.pow(250, rawSliderValue.value))
    if (cachedSize === brushSize.value) return rawSliderValue.value
  }
  return Math.log(Math.max(brushSize.value, 1)) / Math.log(250)
})

const thicknessSlider = computed(() => ({
  value: thicknessSliderValue.value,
  min: 0,
  max: 1,
  step: 0.001
}))

function commitThickness(value: number) {
  if (!Number.isFinite(value)) return
  store.setBrushSize(Math.round(Math.min(250, Math.max(1, value))))
}

function onThicknessSliderPosition(position: number) {
  rawSliderValue.value = position
  commitThickness(Math.pow(250, position))
}

const brushOpacity = computed(() =>
  Math.round(store.brushSettings.opacity * 100)
)
const brushHardness = computed(() =>
  Math.round(store.brushSettings.hardness * 100)
)

function onBrushOpacityChange(value: number) {
  store.setBrushOpacity(value / 100)
}

function onBrushHardnessChange(value: number) {
  store.setBrushHardness(value / 100)
}

function onBrushStepSizeChange(value: number) {
  store.setBrushStepSize(value)
}

function setBrushShape(shape: BrushShape) {
  store.brushSettings.type = shape
}

function resetToDefault() {
  rawSliderValue.value = null
  store.resetBrushToDefault()
}
</script>
