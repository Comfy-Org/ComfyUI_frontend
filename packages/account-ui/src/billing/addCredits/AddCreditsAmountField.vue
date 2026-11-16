<template>
  <div class="flex flex-col gap-2">
    <label :for="fieldId" class="text-muted-foreground">{{ label }}</label>
    <div
      :class="
        cn(
          'flex h-10 items-center gap-2 rounded-lg border border-solid border-transparent bg-secondary px-4 focus-within:border-foreground',
          error && 'border-destructive focus-within:border-destructive',
          locked && 'opacity-50',
          ui.field
        )
      "
    >
      <span class="text-muted-foreground" aria-hidden="true">$</span>
      <input
        :id="fieldId"
        :value="input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :disabled="locked"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? errorId : undefined"
        class="min-w-0 flex-1 border-none bg-transparent text-base text-foreground outline-none"
        data-testid="add-credits-amount-input"
        @input="onInput"
      />
    </div>
    <p
      :id="errorId"
      :class="cn('m-0 min-h-5 text-destructive', ui.error)"
      data-testid="add-credits-amount-error"
      aria-live="polite"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsUi } from './addCreditsPresentation'

const { input, error, locked, label, ui } = defineProps<{
  input: string
  error: string | undefined
  locked: boolean
  label: string
  ui: AddCreditsUi
}>()

const emit = defineEmits<{ type: [input: string] }>()

const fieldId = useId()
const errorId = useId()

function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) emit('type', event.target.value)
}
</script>
