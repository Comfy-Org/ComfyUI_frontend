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
        <i class="icon-[lucide--rotate-ccw] size-4" aria-hidden="true" />
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
      >
        <button
          type="button"
          role="radio"
          :aria-checked="store.brushSettings.type === BrushShape.Arc"
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
          type="button"
          role="radio"
          :aria-checked="store.brushSettings.type === BrushShape.Rect"
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

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <label
          id="brush-thickness-label"
          for="brush-thickness-input"
          class="text-left font-sans text-xs text-muted-foreground"
        >
          {{ t('maskEditor.thickness') }}
        </label>
        <div class="flex items-center gap-1">
          <input
            id="brush-thickness-input"
            data-testid="brush-thickness-input"
            :value="brushSize"
            type="number"
            class="w-16 [appearance:textfield] rounded-md border bg-background px-2 py-1 text-center text-sm text-foreground [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            :min="1"
            :max="250"
            :step="1"
            @input="onThicknessInput"
            @change="onThicknessCommit"
          />
          <span class="text-xs text-muted-foreground" aria-hidden="true">
            px
          </span>
        </div>
      </div>
      <Slider
        :model-value="[thicknessSliderValue]"
        class="flex-1"
        :min="0"
        :max="1"
        :step="0.001"
        aria-labelledby="brush-thickness-label"
        @update:model-value="onThicknessSliderChange"
      />
    </div>

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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Slider from '@/components/ui/slider/Slider.vue'
import { BrushShape } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'
import { cn } from '@comfyorg/tailwind-utils'

import SettingsSection from './controls/SettingsSection.vue'
import SliderField from './controls/SliderField.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const rawSliderValue = ref<number | null>(null)

const brushSize = computed(() => Math.round(store.brushSettings.size))

const thicknessSliderValue = computed(() => {
  if (rawSliderValue.value !== null) {
    const cachedSize = Math.round(Math.pow(250, rawSliderValue.value))
    if (cachedSize === brushSize.value) return rawSliderValue.value
  }
  return Math.log(Math.max(brushSize.value, 1)) / Math.log(250)
})

function commitThickness(value: number) {
  if (!Number.isFinite(value)) return
  store.setBrushSize(Math.round(Math.min(250, Math.max(1, value))))
}

function onThicknessInput(event: Event) {
  commitThickness((event.target as HTMLInputElement).valueAsNumber)
}

function onThicknessCommit(event: Event) {
  const input = event.target as HTMLInputElement
  const parsed = input.valueAsNumber
  if (!Number.isFinite(parsed)) {
    input.value = String(brushSize.value)
    return
  }
  commitThickness(parsed)
}

function onThicknessSliderChange(value: number[] | undefined) {
  const next = value?.[0]
  if (next === undefined || !Number.isFinite(next)) return
  rawSliderValue.value = next
  commitThickness(Math.pow(250, next))
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
