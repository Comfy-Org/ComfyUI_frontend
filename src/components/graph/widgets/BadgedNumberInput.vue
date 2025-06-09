<template>
  <div class="badged-number-input relative w-full">
    <InputGroup class="w-full rounded-lg border-none px-0.5">
      <!-- State badge prefix -->
      <InputGroupAddon
        v-if="badgeState !== 'normal'"
        class="rounded-l-lg bg-[#222222] border-[#222222] shadow-none border-r-[#A0A1A2] rounded-r-none"
      >
        <i
          :class="badgeIcon + ' text-xs'"
          :title="badgeTooltip"
          :style="{ color: badgeColor }"
        ></i>
      </InputGroupAddon>

      <!-- Number input for non-slider mode -->
      <InputNumber
        v-if="!isSliderMode"
        v-model="numericValue"
        :min="min"
        :max="max"
        :step="step"
        :placeholder="placeholder"
        :disabled="disabled"
        size="small"
        :pt="{
          pcInputText: {
            root: {
              class: 'bg-[#222222] text-xs shadow-none rounded-none !border-0'
            }
          },
          incrementButton: {
            class: 'text-xs shadow-none bg-[#222222] rounded-l-none !border-0'
          },
          decrementButton: {
            class: {
              'text-xs shadow-none bg-[#222222] rounded-r-none !border-0':
                badgeState === 'normal',
              'text-xs shadow-none bg-[#222222] rounded-none !border-0':
                badgeState !== 'normal'
            }
          }
        }"
        class="flex-1 rounded-none"
        show-buttons
        button-layout="horizontal"
        :increment-button-icon="'pi pi-plus'"
        :decrement-button-icon="'pi pi-minus'"
      />

      <!-- Slider mode -->
      <div
        v-else
        :class="{
          'rounded-r-lg': badgeState !== 'normal',
          'rounded-lg': badgeState === 'normal'
        }"
        class="flex-1 flex items-center gap-2 px-1 bg-surface-0 border border-surface-300"
      >
        <Slider
          v-model="numericValue"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          class="flex-1"
        />
        <InputNumber
          v-model="numericValue"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          class="w-16 rounded-md"
          :pt="{
            pcInputText: {
              root: {
                class: 'bg-[#222222] text-xs shadow-none border-[#222222]'
              }
            }
          }"
          :show-buttons="false"
          size="small"
        />
      </div>
    </InputGroup>
  </div>
</template>

<script setup lang="ts">
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import { computed } from 'vue'

import type { ComponentWidget } from '@/scripts/domWidget'

type BadgeState = 'normal' | 'random' | 'lock' | 'increment' | 'decrement'

const modelValue = defineModel<string>({ required: true })

const {
  widget,
  badgeState = 'normal',
  disabled = false
} = defineProps<{
  widget: ComponentWidget<string>
  badgeState?: BadgeState
  disabled?: boolean
}>()

// Convert string model value to/from number for the InputNumber component
const numericValue = computed({
  get: () => parseFloat(modelValue.value) || 0,
  set: (value: number) => {
    modelValue.value = value.toString()
  }
})

// Extract options from input spec
const inputSpec = widget.inputSpec
const min = (inputSpec as any).min ?? 0
const max = (inputSpec as any).max ?? 100
const step = (inputSpec as any).step ?? 1
const placeholder = (inputSpec as any).placeholder ?? 'Enter number'

// Check if slider mode should be enabled
const isSliderMode = computed(() => {
  console.log('inputSpec', inputSpec)
  return (inputSpec as any).slider === true
})

// Badge configuration
const badgeIcon = computed(() => {
  switch (badgeState) {
    case 'random':
      return 'pi pi-refresh'
    case 'lock':
      return 'pi pi-lock'
    case 'increment':
      return 'pi pi-arrow-up'
    case 'decrement':
      return 'pi pi-arrow-down'
    default:
      return ''
  }
})

const badgeColor = computed(() => {
  switch (badgeState) {
    case 'random':
      return 'var(--p-primary-color)'
    case 'lock':
      return 'var(--p-orange-500)'
    case 'increment':
      return 'var(--p-green-500)'
    case 'decrement':
      return 'var(--p-red-500)'
    default:
      return 'var(--p-text-color)'
  }
})

const badgeTooltip = computed(() => {
  switch (badgeState) {
    case 'random':
      return 'Random mode: Value randomizes after each run'
    case 'lock':
      return 'Locked: Value never changes'
    case 'increment':
      return 'Auto-increment: Value increases after each run'
    case 'decrement':
      return 'Auto-decrement: Value decreases after each run'
    default:
      return ''
  }
})
</script>

<style scoped>
.badged-number-input {
  padding: 4px;
}

/* Ensure proper styling for the input group */
:deep(.p-inputgroup) {
  border-radius: 0.5rem;
}

:deep(.p-inputnumber) {
  flex: 1;
}

:deep(.p-inputnumber-input) {
  border-radius: inherit;
}

/* Badge styling */
:deep(.p-badge) {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}
</style>
