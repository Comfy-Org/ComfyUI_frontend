<script setup lang="ts">
import { Search } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import { directoryControlClass, directoryIconClass } from './directoryControls'

const { id, label, placeholder } = defineProps<{
  id: string
  label: string
  placeholder: string
}>()

const query = defineModel<string>({ required: true })
</script>

<template>
  <div class="relative flex-1">
    <label :for="id" class="sr-only">{{ label }}</label>
    <Search :class="cn(directoryIconClass, 'left-4')" aria-hidden="true" />
    <input
      :id
      v-model="query"
      type="search"
      :placeholder
      :class="
        cn(
          directoryControlClass,
          'w-full pr-4 pl-11 placeholder:text-primary-comfy-canvas/50'
        )
      "
    />
  </div>
</template>
