<script setup lang="ts">
import RadioGroup from '@/components/ui/radio-group/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/radio-group/RadioGroupItem.vue'

import type { AskUserOption } from '../../../services/agent/agentMessageParts'
import AskUserOptionLabel from './AskUserOptionLabel.vue'

/** A required single choice: one radio per option, labelled by the prompt. */
const {
  options,
  idPrefix,
  labelledBy,
  disabled = false
} = defineProps<{
  options: AskUserOption[]
  idPrefix: string
  labelledBy: string
  disabled?: boolean
}>()

const modelValue = defineModel<string | undefined>()

const optionId = (index: number) => `${idPrefix}-option-${index}`
const describedBy = (option: AskUserOption, index: number) =>
  option.description ? `${optionId(index)}-description` : undefined

function choose(value: unknown): void {
  if (typeof value === 'string') modelValue.value = value
}
</script>

<template>
  <RadioGroup
    :model-value="modelValue"
    :disabled
    :aria-labelledby="labelledBy"
    class="flex-col gap-0.5 text-sm/5"
    @update:model-value="choose"
  >
    <div
      v-for="(option, index) in options"
      :key="option.id"
      class="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary-background-hover"
    >
      <RadioGroupItem
        :id="optionId(index)"
        :value="option.id"
        :aria-labelledby="`${optionId(index)}-label`"
        :aria-describedby="describedBy(option, index)"
        class="mt-0.5"
      />
      <AskUserOptionLabel :option-id="optionId(index)" :option />
    </div>
  </RadioGroup>
</template>
