<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { provide, ref } from 'vue'

import { PROMPT_INPUT_FOCUSED_KEY } from './promptInputContext'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  submit: [event: Event]
}>()

const isFocused = ref(false)
provide(PROMPT_INPUT_FOCUSED_KEY, isFocused)

function onSubmit(event: Event) {
  event.preventDefault()
  emit('submit', event)
}
</script>

<template>
  <form :class="cn('w-full', className)" @submit="onSubmit">
    <slot />
  </form>
</template>
