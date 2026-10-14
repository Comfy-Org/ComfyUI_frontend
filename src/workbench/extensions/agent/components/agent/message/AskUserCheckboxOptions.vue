<script setup lang="ts">
import type { AgentAskOption } from '@comfyorg/ingest-types'
import { xor } from 'es-toolkit'

import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

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

function toggle(id: string): void {
  selected.value = xor(selected.value, [id])
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
        class="mt-0.5 p-0"
        @update:model-value="toggle(option.id)"
      />
      <AskUserOptionLabel
        :option-id="askUserOptionId(idPrefix, index)"
        :option
        :disabled="optionDisabled(option.id)"
      />
    </div>
  </div>
</template>
