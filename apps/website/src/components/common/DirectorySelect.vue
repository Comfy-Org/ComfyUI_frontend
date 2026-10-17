<script setup lang="ts" generic="T extends string">
import { ChevronDown } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DirectoryControlSize, DirectoryOption } from './directoryControls'

import { directoryControlClass, directoryIconClass } from './directoryControls'

const {
  id,
  label,
  options,
  size = 'default'
} = defineProps<{
  id: string
  label: string
  options: readonly DirectoryOption<T>[]
  size?: DirectoryControlSize
}>()

const selected = defineModel<T>({ required: true })
</script>

<template>
  <div class="relative">
    <label :for="id" class="sr-only">{{ label }}</label>
    <select
      :id
      v-model="selected"
      :class="
        cn(
          directoryControlClass,
          'w-full cursor-pointer appearance-none pr-10',
          size === 'compact' ? 'pl-3 min-[375px]:pl-4' : 'pl-4'
        )
      "
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <ChevronDown
      :class="cn(directoryIconClass, 'right-4')"
      aria-hidden="true"
    />
  </div>
</template>
