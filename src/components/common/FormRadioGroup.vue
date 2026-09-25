<template>
  <RadioGroup
    v-model="modelValue"
    :name="id"
    orientation="horizontal"
    class="gap-4"
  >
    <div
      v-for="option in normalizedOptions"
      :key="option.value"
      class="flex items-center"
    >
      <RadioGroupItem
        :id="`${id}-${option.value}`"
        :value="option.value"
        :aria-describedby="`${option.text}-label`"
      />
      <label
        :id="`${option.text}-label`"
        :for="`${id}-${option.value}`"
        class="ml-2 cursor-pointer"
      >
        {{ option.text }}
      </label>
    </div>
  </RadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import RadioGroup from '@/components/ui/radio-group/RadioGroup.vue'
import RadioGroupItem from '@/components/ui/radio-group/RadioGroupItem.vue'
import type { SettingOption } from '@/platform/settings/types'

const { options = [] } = defineProps<{
  options?: (string | SettingOption)[]
  id?: string
}>()

const modelValue = defineModel<string | number | null>()

const normalizedOptions = computed(() =>
  options.map((option) =>
    typeof option === 'string'
      ? { text: option, value: option }
      : { text: option.text, value: option.value ?? option.text }
  )
)
</script>
