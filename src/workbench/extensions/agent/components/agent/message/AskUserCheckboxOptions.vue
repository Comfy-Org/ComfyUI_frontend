<script setup lang="ts">
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

import type { AgentAskOption } from '../../../schemas/agentApiSchema'
import AskUserOptionLabel from './AskUserOptionLabel.vue'
import {
  askUserOptionDescribedBy,
  askUserOptionId,
  askUserOptionRowClass
} from './askUserOptions'

const {
  options,
  idPrefix,
  labelledBy,
  describedBy,
  disabled = false,
  full = false
} = defineProps<{
  options: AgentAskOption[]
  idPrefix: string
  labelledBy: string
  describedBy?: string
  disabled?: boolean
  full?: boolean
}>()

const selected = defineModel<string[]>({ required: true })

function optionDisabled(id: string): boolean {
  return disabled || (full && !selected.value.includes(id))
}

function toggle(id: string, checked: boolean): void {
  const others = selected.value.filter((value) => value !== id)
  selected.value = checked ? [...others, id] : others
}
</script>

<template>
  <div
    role="group"
    :aria-labelledby="labelledBy"
    :aria-describedby="describedBy"
    class="flex flex-col gap-0.5 text-sm/5"
  >
    <div
      v-for="(option, index) in options"
      :key="option.id"
      :class="askUserOptionRowClass"
    >
      <Checkbox
        :id="askUserOptionId(idPrefix, index)"
        :model-value="selected.includes(option.id)"
        :disabled="optionDisabled(option.id)"
        :aria-labelledby="`${askUserOptionId(idPrefix, index)}-label`"
        :aria-describedby="askUserOptionDescribedBy(idPrefix, option, index)"
        class="mt-0.5"
        @update:model-value="(checked) => toggle(option.id, checked === true)"
      />
      <AskUserOptionLabel
        :option-id="askUserOptionId(idPrefix, index)"
        :option
        :disabled="optionDisabled(option.id)"
      />
    </div>
  </div>
</template>
