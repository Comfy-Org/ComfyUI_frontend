<template>
  <div class="flex flex-col gap-3 pb-3">
    <h3 class="mt-2.5 text-center font-sans text-[15px] text-(--descrip-text)">
      {{ t('maskEditor.paintBucketSettings') }}
    </h3>

    <SliderField
      :label="t('maskEditor.tolerance')"
      :model-value="store.paintBucketTolerance"
      :min="0"
      :max="255"
      :step="1"
      @update:model-value="onToleranceChange"
    />

    <SliderField
      :label="t('maskEditor.fillOpacity')"
      :model-value="fillOpacity"
      :min="0"
      :max="100"
      :step="1"
      suffix="%"
      input-id="fill-opacity-input"
      @update:model-value="onFillOpacityChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMaskEditorStore } from '@/stores/maskEditorStore'

import SliderField from './controls/SliderField.vue'

const { t } = useI18n()
const store = useMaskEditorStore()

const fillOpacity = computed({
  get: () => Math.round(store.fillOpacity * 100),
  set: (value: number) => {
    if (Number.isNaN(value)) return
    store.setFillOpacity(value / 100)
  }
})

const onToleranceChange = (value: number) => {
  if (Number.isNaN(value)) return
  store.setPaintBucketTolerance(value)
}

const onFillOpacityChange = (value: number) => {
  fillOpacity.value = value
}
</script>
