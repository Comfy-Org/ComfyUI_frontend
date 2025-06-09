<template>
  <div class="badged-number-input relative w-full">
    <InputGroup class="w-full rounded-lg">
      <!-- State badge prefix -->
      <InputGroupAddon v-if="badgeState !== 'normal'" class="!p-1 rounded-l-lg">
        <Badge
          :value="badgeIcon"
          :severity="badgeSeverity"
          class="text-xs font-medium"
          :title="badgeTooltip"
        />
      </InputGroupAddon>

      <!-- Number input -->
      <InputNumber
        v-model="numericValue"
        :min="min"
        :max="max"
        :step="step"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="{
          'rounded-r-lg': badgeState !== 'normal',
          'rounded-lg': badgeState === 'normal'
        }"
        class="flex-1"
        show-buttons
        button-layout="horizontal"
        :increment-button-icon="'pi pi-plus'"
        :decrement-button-icon="'pi pi-minus'"
      />
    </InputGroup>
  </div>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputNumber from 'primevue/inputnumber'
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

// Badge configuration
const badgeIcon = computed(() => {
  switch (badgeState) {
    case 'random':
      return '🎲'
    case 'lock':
      return '🔒'
    case 'increment':
      return '⬆️'
    case 'decrement':
      return '⬇️'
    default:
      return ''
  }
})

const badgeSeverity = computed(() => {
  switch (badgeState) {
    case 'random':
      return 'info'
    case 'lock':
      return 'warn'
    case 'increment':
      return 'success'
    case 'decrement':
      return 'danger'
    default:
      return 'info'
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
