<template>
  <div
    v-tooltip.bottom="{
      value: t('menu.batchCount'),
      showDelay: 600
    }"
    class="batch-count h-full"
    :aria-label="t('menu.batchCount')"
  >
    <div
      class="flex h-full w-14 overflow-hidden rounded-l-lg bg-secondary-background"
    >
      <input
        ref="batchCountInputRef"
        v-model="batchCountInput"
        type="text"
        inputmode="numeric"
        :aria-label="t('menu.batchCount')"
        :class="inputClass"
        @focus="onInputFocus"
        @input="onInput"
        @blur="onInputBlur"
        @keydown.enter.prevent="onInputEnter"
      />
      <div class="flex h-full w-6 flex-col">
        <Button
          variant="secondary"
          size="unset"
          :aria-label="t('g.increment')"
          :class="cn(stepButtonClass, incrementButtonClass)"
          :disabled="isIncrementDisabled"
          @click="incrementBatchCount"
        >
          <TinyChevronIcon rotate-up />
        </Button>
        <Button
          variant="secondary"
          size="unset"
          :aria-label="t('g.decrement')"
          :class="cn(stepButtonClass, decrementButtonClass)"
          :disabled="isDecrementDisabled"
          @click="decrementBatchCount"
        >
          <TinyChevronIcon />
        </Button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useQueueSettingsStore } from '@/stores/queueStore'
import { cn } from '@/utils/tailwindUtil'

import TinyChevronIcon from './TinyChevronIcon.vue'

const { t } = useI18n()

const queueSettingsStore = useQueueSettingsStore()
const { batchCount } = storeToRefs(queueSettingsStore)

const settingStore = useSettingStore()
const minQueueCount = 1
const maxQueueCount = computed(() =>
  settingStore.get('Comfy.QueueButton.BatchCountLimit')
)

const batchCountInputRef = ref<HTMLInputElement | null>(null)
const batchCountInput = ref(String(batchCount.value))
const isEditing = ref(false)

const isIncrementDisabled = computed(
  () => batchCount.value >= maxQueueCount.value
)
const isDecrementDisabled = computed(() => batchCount.value <= minQueueCount)
const inputClass =
  'h-full min-w-0 flex-1 border-none bg-secondary-background pl-1 pr-0 text-center text-sm font-normal tabular-nums text-base-foreground outline-none'
const stepButtonClass =
  'h-1/2 w-full rounded-none border-none p-0 text-muted-foreground hover:bg-secondary-background-hover disabled:cursor-not-allowed disabled:opacity-50'
const incrementButtonClass = 'rounded-tr-none border-b border-border-subtle'
const decrementButtonClass = 'rounded-br-none'

watch(batchCount, (nextBatchCount) => {
  if (!isEditing.value) {
    batchCountInput.value = String(nextBatchCount)
  }
})

const clampBatchCount = (nextBatchCount: number): number =>
  Math.min(Math.max(nextBatchCount, minQueueCount), maxQueueCount.value)

const setBatchCount = (nextBatchCount: number) => {
  batchCount.value = clampBatchCount(nextBatchCount)
  batchCountInput.value = String(batchCount.value)
}

const incrementBatchCount = () => {
  setBatchCount(batchCount.value * 2)
}

const decrementBatchCount = () => {
  setBatchCount(Math.floor(batchCount.value / 2))
}

const onInputFocus = () => {
  isEditing.value = true
}

const onInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  batchCountInput.value = input.value.replace(/[^0-9]/g, '')
}

const onInputBlur = () => {
  isEditing.value = false
  const parsedInput = Number.parseInt(batchCountInput.value, 10)
  setBatchCount(Number.isNaN(parsedInput) ? minQueueCount : parsedInput)
}

const onInputEnter = () => {
  batchCountInputRef.value?.blur()
}
</script>
