<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{
      widget.name
    }}</label>
    <div class="p-4 border border-gray-300 dark-theme:border-gray-600 rounded">
      <!-- Simple chart placeholder - can be enhanced with Chart.js when available -->
      <div
        v-if="!value || !Array.isArray(value.data)"
        class="text-center text-gray-500 dark-theme:text-gray-400"
      >
        No chart data available
      </div>
      <div v-else class="space-y-2">
        <div v-if="value.title" class="text-center font-semibold">
          {{ value.title }}
        </div>
        <div class="space-y-1">
          <div
            v-for="(item, index) in value.data"
            :key="index"
            class="flex justify-between items-center"
          >
            <span class="text-sm">{{ item.label || `Item ${index + 1}` }}</span>
            <div class="flex items-center gap-2">
              <div
                class="h-3 bg-blue-500 rounded"
                :style="{
                  width: `${Math.max((item.value / maxValue) * 100, 5)}px`
                }"
              ></div>
              <span class="text-sm font-mono">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

interface ChartData {
  title?: string
  data: Array<{
    label: string
    value: number
  }>
}

const value = defineModel<ChartData>({ required: true })

defineProps<{
  widget: SimplifiedWidget<ChartData>
  readonly?: boolean
}>()

const maxValue = computed(() => {
  if (!value.value?.data?.length) return 1
  return Math.max(...value.value.data.map((item) => item.value))
})
</script>
