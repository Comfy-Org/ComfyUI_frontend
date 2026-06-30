<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

const { class: className } = defineProps<{
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  submit: [event: Event]
}>()

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
