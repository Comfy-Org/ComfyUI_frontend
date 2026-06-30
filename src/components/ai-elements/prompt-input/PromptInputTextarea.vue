<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'
import { ref } from 'vue'

const { class: className, placeholder } = defineProps<{
  class?: HTMLAttributes['class']
  placeholder?: string
}>()

const model = defineModel<string>({ default: '' })

const isComposing = ref(false)

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || isComposing.value) return
  event.preventDefault()
  const form = (event.target as HTMLElement).closest('form')
  form?.requestSubmit()
}
</script>

<template>
  <textarea
    v-model="model"
    rows="1"
    :placeholder="placeholder"
    :class="
      cn(
        'field-sizing-content max-h-48 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none',
        className
      )
    "
    @keydown="onKeydown"
    @compositionstart="isComposing = true"
    @compositionend="isComposing = false"
  />
</template>
