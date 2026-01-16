<template>
  <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
    <label class="content-center text-xs text-node-component-slot-text">
      {{ $t('boundingBox.x') }}
    </label>
    <input
      v-model.number="x"
      type="number"
      :min="0"
      class="h-7 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
    />
    <label class="content-center text-xs text-node-component-slot-text">
      {{ $t('boundingBox.y') }}
    </label>
    <input
      v-model.number="y"
      type="number"
      :min="0"
      class="h-7 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
    />
    <label class="content-center text-xs text-node-component-slot-text">
      {{ $t('boundingBox.width') }}
    </label>
    <input
      v-model.number="width"
      type="number"
      :min="1"
      class="h-7 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
    />
    <label class="content-center text-xs text-node-component-slot-text">
      {{ $t('boundingBox.height') }}
    </label>
    <input
      v-model.number="height"
      type="number"
      :min="1"
      class="h-7 rounded-lg border-none bg-component-node-widget-background px-2 text-xs text-component-node-foreground focus:outline-0"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { BoundingBoxValue } from '@/lib/litegraph/src/types/widgets'

const modelValue = defineModel<BoundingBoxValue>({
  default: () => ({ x: 0, y: 0, width: 512, height: 512 })
})

const x = computed({
  get: () => modelValue.value.x,
  set: (val) => {
    modelValue.value = { ...modelValue.value, x: val }
  }
})

const y = computed({
  get: () => modelValue.value.y,
  set: (val) => {
    modelValue.value = { ...modelValue.value, y: val }
  }
})

const width = computed({
  get: () => modelValue.value.width,
  set: (val) => {
    modelValue.value = { ...modelValue.value, width: val }
  }
})

const height = computed({
  get: () => modelValue.value.height,
  set: (val) => {
    modelValue.value = { ...modelValue.value, height: val }
  }
})
</script>
