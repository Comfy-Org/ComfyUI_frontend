<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-(--descrip-text)">
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
      input-id="selection-opacity-input"
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

    <div class="flex items-center justify-between gap-3">
      <span class="text-left font-sans text-xs text-(--descrip-text)">
        {{ t('maskEditor.method') }}
      </span>
      <DropdownMenuRoot v-model:open="methodDropdownOpen" :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex h-8 w-20 items-center justify-between gap-2 rounded-lg border border-border-default bg-secondary-background px-2 text-sm transition-colors duration-100 hover:bg-secondary-background-hover"
          >
            <span>{{ store.colorComparisonMethod }}</span>
            <i
              class="icon-[lucide--chevron-down] size-3 text-muted-foreground"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal to="body">
          <DropdownMenuContent
            align="start"
            :side-offset="5"
            :collision-padding="10"
            class="z-2102 min-w-40 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
          >
            <WorkflowActionsList :items="methodMenuItems" />
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <ToggleControl
      :label="t('maskEditor.stopAtMask')"
      :model-value="store.maskBoundary"
      @update:model-value="onMaskBoundaryChange"
    />

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

import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import { ColorComparisonMethod } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import SliderField from './controls/SliderField.vue'
import ToggleControl from './controls/ToggleControl.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const methodDropdownOpen = ref(false)

const methodOptions = Object.values(ColorComparisonMethod)

const methodMenuItems = computed(() =>
  methodOptions.map((method) => ({
    id: method,
    label: method,
    command: () => onMethodChange(method)
  }))
)

const colorTolerancePercent = computed(() =>
  Math.round((store.colorSelectTolerance / 255) * 100)
)

const maskTolerancePercent = computed(() =>
  Math.round((store.maskTolerance / 255) * 100)
)

const onToleranceChange = (percent: number) => {
  if (Number.isNaN(percent)) return
  const clamped = Math.min(100, Math.max(0, percent))
  const raw = Math.round((clamped / 100) * 255)
  store.setColorSelectTolerance(raw)
}

const onSelectionOpacityChange = (value: number) => {
  if (Number.isNaN(value)) return
  store.setSelectionOpacity(value)
}

const onMethodChange = (method: ColorComparisonMethod) => {
  store.colorComparisonMethod = method
  methodDropdownOpen.value = false
}

const onLivePreviewChange = (value: boolean) => {
  store.colorSelectLivePreview = value
}

const onWholeImageChange = (value: boolean) => {
  store.applyWholeImage = value
}

const onMaskBoundaryChange = (value: boolean) => {
  store.maskBoundary = value
}

const onMaskToleranceChange = (percent: number) => {
  if (Number.isNaN(percent)) return
  const clamped = Math.min(100, Math.max(0, percent))
  const raw = Math.round((clamped / 100) * 255)
  store.setMaskTolerance(raw)
}
</script>
