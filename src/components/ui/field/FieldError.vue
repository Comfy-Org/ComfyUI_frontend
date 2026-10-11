<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

type FieldErrorItem = string | { message: string | undefined } | undefined

const { class: className, errors = [] } = defineProps<{
  class?: HTMLAttributes['class']
  errors?: FieldErrorItem[]
}>()

const messages = computed(() => {
  const unique = new Set(
    errors.map((error) => (typeof error === 'string' ? error : error?.message))
  )
  return [...unique].filter((message) => !!message)
})
</script>

<template>
  <div
    v-if="$slots.default || messages.length"
    role="alert"
    data-slot="field-error"
    :class="cn('text-sm font-normal text-destructive-background', className)"
  >
    <slot v-if="$slots.default" />
    <template v-else-if="messages.length === 1">{{ messages[0] }}</template>
    <ul v-else class="m-0 flex list-disc flex-col gap-1 pl-4">
      <li v-for="message in messages" :key="message">{{ message }}</li>
    </ul>
  </div>
</template>
