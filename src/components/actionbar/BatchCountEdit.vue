<template>
  <div
    v-tooltip.bottom="{
      value: $t('menu.batchCount'),
      showDelay: 600
    }"
    class="batch-count"
    :aria-label="$t('menu.batchCount')"
  >
    <InputNumber
      v-model="batchCount"
      class="w-14"
      :min="minQueueCount"
      :max="maxQueueCount"
      fluid
      show-buttons
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
import { storeToRefs } from 'pinia'
import InputNumber from 'primevue/inputnumber'
import { computed } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useQueueSettingsStore } from '@/stores/queueStore'

interface Props {
  batchCount?: number
  minQueueCount?: number
  maxQueueCount?: number
}

interface Emits {
  (e: 'update:batch-count', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  batchCount: undefined,
  minQueueCount: 1,
  maxQueueCount: undefined
})

const emit = defineEmits<Emits>()

const queueSettingsStore = useQueueSettingsStore()
const { batchCount: storeBatchCount } = storeToRefs(queueSettingsStore)

const settingStore = useSettingStore()
const defaultMaxQueueCount = computed(() =>
  settingStore.get('Comfy.QueueButton.BatchCountLimit')
)

// Use props if provided, otherwise fallback to store values
const batchCount = computed({
  get() {
    return props.batchCount ?? storeBatchCount.value
  },
  set(value: number) {
    if (props.batchCount !== undefined) {
      emit('update:batch-count', value)
    } else {
      storeBatchCount.value = value
    }
  }
})

const minQueueCount = computed(() => props.minQueueCount)
const maxQueueCount = computed(
  () => props.maxQueueCount ?? defaultMaxQueueCount.value
)

const handleClick = (increment: boolean) => {
  let newCount: number
  if (increment) {
    const originalCount = batchCount.value - 1
    newCount = Math.min(originalCount * 2, maxQueueCount.value)
  } else {
    const originalCount = batchCount.value + 1
    newCount = Math.floor(originalCount / 2)
  }

  batchCount.value = newCount
}
</script>

<style scoped>
:deep(.p-inputtext) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
</style>
