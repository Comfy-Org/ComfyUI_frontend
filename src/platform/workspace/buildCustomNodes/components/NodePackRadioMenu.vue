<template>
  <RadioGroup v-model="selected" :aria-label="label" class="flex-col gap-1">
    <label
      v-for="option in options"
      :key="option.value"
      class="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-secondary"
    >
      <RadioGroupItem
        :value="option.value"
        class="size-4.5 border-muted-foreground data-[state=checked]:border-foreground"
      >
        <RadioGroupIndicator class="size-2.5 rounded-full bg-foreground" />
      </RadioGroupItem>
      {{ option.label }}
    </label>
  </RadioGroup>
</template>

<script setup lang="ts" generic="Value extends string">
import RadioGroup from '@comfyorg/design-system/radio-group/RadioGroup'
import RadioGroupItem from '@comfyorg/design-system/radio-group/RadioGroupItem'
import { RadioGroupIndicator } from 'reka-ui'

const { label, options } = defineProps<{
  label: string
  options: readonly { value: Value; label: string }[]
}>()

const selected = defineModel<Value>({ required: true })
</script>
