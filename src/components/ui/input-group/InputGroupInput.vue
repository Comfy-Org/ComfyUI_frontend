<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Input from '@/components/ui/input/Input.vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<string | number>()
</script>

<template>
  <Input
    v-model="modelValue"
    data-slot="input-group-control"
    :class="
      cn(
        'flex-1 rounded-none bg-transparent text-inherit focus-visible:ring-0 aria-invalid:ring-0',
        className
      )
    "
  />
</template>
