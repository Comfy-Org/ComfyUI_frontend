<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-(--descrip-text)">
      {{ t('maskEditor.paintBucketSettings') }}
    </h3>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-left font-sans text-xs text-(--descrip-text)">
          {{ t('maskEditor.tolerance') }}
        </span>
        <div class="relative">
          <input
            :value="store.paintBucketTolerance"
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
        :model-value="store.paintBucketTolerance"
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
          {{ t('maskEditor.fillOpacity') }}
        </span>
        <div class="relative">
          <input
            :value="store.fillOpacity"
            type="number"
            class="border-p-form-field-border-color text-input-text w-20 [appearance:textfield] rounded-md border bg-comfy-menu-bg px-2 py-1 pr-8 text-center text-sm"
            min="0"
            max="100"
            step="1"
            @input="onFillOpacityChangeInput"
          />
          <span
            class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground"
            >%</span
          >
        </div>
      </div>
      <Slider
        :model-value="store.fillOpacity"
        class="my-1 h-8 flex-1 rounded-lg bg-component-node-widget-background py-0.5"
        :min="0"
        :max="100"
        :step="1"
        @update:model-value="onFillOpacityChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Slider from 'primevue/slider'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

const { t } = useI18n()
const store = useMaskEditorStore()

const onToleranceChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  store.setPaintBucketTolerance(numValue)
}

const onToleranceChangeInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  store.setPaintBucketTolerance(value)
}

const onFillOpacityChange = (value: number | number[] | undefined) => {
  const numValue = Array.isArray(value) ? value[0] : (value ?? 0)
  store.setFillOpacity(numValue)
}

const onFillOpacityChangeInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  store.setFillOpacity(value)
}
</script>
