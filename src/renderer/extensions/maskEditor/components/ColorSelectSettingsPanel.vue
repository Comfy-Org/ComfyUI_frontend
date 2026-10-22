<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-muted-foreground">
      {{ t('maskEditor.colorSelectSettings') }}
    </h3>

    <SliderField
      :label="t('maskEditor.tolerance')"
      :model-value="colorTolerancePercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      @update:model-value="onToleranceChange"
    />

    <SliderField
      :label="t('maskEditor.selectionOpacity')"
      :model-value="store.selectionOpacity"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      @update:model-value="onSelectionOpacityChange"
    />

    <div class="flex items-center justify-between gap-2">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.livePreview') }}
      </span>
      <Switch
        :model-value="store.colorSelectLivePreview"
        :aria-label="t('maskEditor.livePreview')"
        @update:model-value="onLivePreviewChange"
      />
    </div>

    <div class="flex items-center justify-between gap-2">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.applyToWholeImage') }}
      </span>
      <Switch
        :model-value="store.applyWholeImage"
        :aria-label="t('maskEditor.applyToWholeImage')"
        @update:model-value="onWholeImageChange"
      />
    </div>

    <div class="flex items-center justify-between gap-2">
      <span
        id="color-comparison-method-label"
        class="text-left font-sans text-xs text-muted-foreground"
      >
        {{ t('maskEditor.method') }}
      </span>
      <Menu
        v-model:open="methodMenuOpen"
        :modal="false"
        :items="methodMenuItems"
        align="end"
      >
        <template #trigger>
          <Button
            variant="secondary"
            size="sm"
            class="gap-1"
            aria-labelledby="color-comparison-method-label color-comparison-method-value"
          >
            <span id="color-comparison-method-value">
              {{ methodLabels[store.colorComparisonMethod] }}
            </span>
            <i
              class="icon-[lucide--chevron-down] size-3.5"
              aria-hidden="true"
            />
          </Button>
        </template>
      </Menu>
    </div>

    <div class="flex items-center justify-between gap-2">
      <span class="text-left font-sans text-xs text-muted-foreground">
        {{ t('maskEditor.stopAtMask') }}
      </span>
      <Switch
        :model-value="store.maskBoundary"
        :aria-label="t('maskEditor.stopAtMask')"
        @update:model-value="onMaskBoundaryChange"
      />
    </div>

    <SliderField
      :label="t('maskEditor.maskTolerance')"
      :model-value="maskTolerancePercent"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      @update:model-value="onMaskToleranceChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Switch from '@/components/ui/switch/Switch.vue'
import { ColorComparisonMethod } from '@comfyorg/mask-editor/types'
import { useMaskEditorStore } from '@comfyorg/mask-editor/maskEditorStore'

import SliderField from './controls/SliderField.vue'

const { t } = useI18n()
const store = useMaskEditorStore()
const methodMenuOpen = ref(false)

const methodLabels = computed(
  (): Record<ColorComparisonMethod, string> => ({
    [ColorComparisonMethod.Simple]: t('maskEditor.methodSimple'),
    [ColorComparisonMethod.HSL]: t('maskEditor.methodHsl'),
    [ColorComparisonMethod.LAB]: t('maskEditor.methodLab')
  })
)

const methodMenuItems = computed<MenuItem[]>(() =>
  Object.values(ColorComparisonMethod).map((method) => ({
    key: method,
    label: methodLabels.value[method],
    checked: store.colorComparisonMethod === method,
    command: () => {
      store.colorComparisonMethod = method
    }
  }))
)

const colorTolerancePercent = computed(() =>
  Math.round((store.colorSelectTolerance / 255) * 100)
)
const maskTolerancePercent = computed(() =>
  Math.round((store.maskTolerance / 255) * 100)
)

function percentToChannel(percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent))
  return Math.round((clamped / 100) * 255)
}

function onToleranceChange(value: number) {
  store.setColorSelectTolerance(percentToChannel(value))
}

function onMaskToleranceChange(value: number) {
  store.setMaskTolerance(percentToChannel(value))
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

function onMaskBoundaryChange(value: boolean) {
  store.maskBoundary = value
}
</script>
