<template>
  <div
    role="tablist"
    :class="cn('flex w-full items-center gap-2', props.class)"
  >
    <slot />
  </div>
</template>

<script setup lang="ts" generic="T extends string = string">
import { provide } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { TAB_LIST_INJECTION_KEY } from './tabKeys'

const props = defineProps<{ class?: string }>()

const modelValue = defineModel<T>({ required: true })

function select(value: string) {
  modelValue.value = value as T
}

provide(TAB_LIST_INJECTION_KEY, {
  modelValue,
  select
})
</script>
