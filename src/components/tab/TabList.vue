<template>
  <div role="tablist" :class="cn('flex w-full items-center gap-2', className)">
    <slot />
  </div>
</template>

<script setup lang="ts" generic="T extends string = string">
import type { HTMLAttributes } from 'vue'
import { provide } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { TAB_LIST_INJECTION_KEY } from './tabKeys'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const modelValue = defineModel<T>({ required: true })

function select(value: string) {
  modelValue.value = value as T
}

provide(TAB_LIST_INJECTION_KEY, {
  modelValue,
  select
})
</script>
