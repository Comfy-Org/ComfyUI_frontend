<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-(--descrip-text)">
      {{ t('maskEditor.colorSelectSettings') }}
    </h3>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.tolerance') }}
        </span>
        <div class="relative">
          <input
            :value="store.colorSelectTolerance"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            min="0"
            max="255"
            step="1"
            @input="onToleranceChangeInput"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >px</span
          >
        </div>
      </div>
      <Slider
        :model-value="store.colorSelectTolerance"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="255"
        :step="1"
        @update:model-value="onToleranceChange"
      />
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.selectionOpacity') }}
        </span>
        <div class="relative">
          <input
            :value="store.selectionOpacity"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            min="0"
            max="100"
            step="1"
            @input="onSelectionOpacityChangeInput"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >%</span
          >
        </div>
      </div>
      <Slider
        :model-value="store.selectionOpacity"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="onSelectionOpacityChange"
      />
    </div>

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

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.maskTolerance') }}
        </span>
        <div class="relative">
          <input
            :value="store.maskTolerance"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            min="0"
            max="255"
            step="1"
            @input="onMaskToleranceChangeInput"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >px</span
          >
        </div>
      </div>
      <Slider
        :model-value="store.maskTolerance"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="255"
        :step="1"
        @update:model-value="onMaskToleranceChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Slider from 'primevue/slider'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import { ColorComparisonMethod } from '@/extensions/core/maskeditor/types'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

import ToggleControl from './controls/ToggleControl.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const methodDropdownOpen = ref(false)

const methodOptions = Object.values(ColorComparisonMethod)

const methodMenuItems = methodOptions.map((method) => ({
  id: method,
  label: method,
  icon:
    store.colorComparisonMethod === method ? 'icon-[lucide--check]' : undefined,
  command: () => onMethodChange(method)
}))

const onToleranceChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  store.setColorSelectTolerance(numValue)
}

const onToleranceChangeInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  store.setColorSelectTolerance(value)
}

const onSelectionOpacityChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  store.setSelectionOpacity(numValue)
}

const onMethodChange = (method: ColorComparisonMethod) => {
  store.colorComparisonMethod = method
  methodDropdownOpen.value = false
}

const onSelectionOpacityChangeInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  store.setSelectionOpacity(value)
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

const onMaskToleranceChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  store.setMaskTolerance(numValue)
}

const onMaskToleranceChangeInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  store.setMaskTolerance(value)
}
</script>
