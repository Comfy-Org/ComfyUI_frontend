<template>
  <div class="batch-count relative">
    <InputNumber
      class="max-w-16"
      v-model="batchCount"
      :min="minQueueCount"
      :max="maxQueueCount"
      fluid
      showButtons
      :pt="{
        incrementButton: {
          class: 'w-6',
          onmousedown: () => {
            handleClick(true)
          }
        },
        decrementButton: {
          class: 'w-6',
          onmousedown: () => {
            handleClick(false)
          }
        }
      }"
    />
  </div>
</template>

<script lang="ts" setup>
import { useQueueSettingsStore } from '@/stores/queueStore'
import { storeToRefs } from 'pinia'
import InputNumber from 'primevue/inputnumber'

const queueSettingsStore = useQueueSettingsStore()
const { batchCount } = storeToRefs(queueSettingsStore)
const minQueueCount = 1
const maxQueueCount = 100

const handleClick = (increment: boolean) => {
  let newCount: number
  if (increment) {
    const originalCount = batchCount.value - 1
    newCount = originalCount * 2
  } else {
    const originalCount = batchCount.value + 1
    newCount = Math.floor(originalCount / 2)
  }

  batchCount.value = newCount
}
</script>
