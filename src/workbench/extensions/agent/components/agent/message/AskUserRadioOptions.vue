<script setup lang="ts">
import RadioGroup from '@/components/ui/radio-group/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/radio-group/RadioGroupItem.vue'

import type { AskUserOption } from '../../../services/agent/agentMessageParts'
import AskUserOptionLabel from './AskUserOptionLabel.vue'
import {
  askUserOptionDescribedBy,
  askUserOptionId,
  askUserOptionRowClass
} from './askUserOptions'

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
      :class="askUserOptionRowClass"
    >
      <RadioGroupItem
        :id="askUserOptionId(idPrefix, index)"
        :value="option.id"
        :aria-labelledby="`${askUserOptionId(idPrefix, index)}-label`"
        :aria-describedby="askUserOptionDescribedBy(idPrefix, option, index)"
        class="mt-0.5"
      />
      <AskUserOptionLabel
        :option-id="askUserOptionId(idPrefix, index)"
        :option
        :disabled
      />
    </div>
  </RadioGroup>
</template>
