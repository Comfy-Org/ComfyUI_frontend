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
      <span v-if="prefix" class="text-muted-foreground" aria-hidden="true">
        {{ prefix }}
      </span>
      <input
        :id="fieldId"
        :value="input"
        type="text"
        :inputmode="prefix ? 'decimal' : 'numeric'"
        autocomplete="off"
        :disabled="locked"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        class="min-w-0 flex-1 border-none bg-transparent text-base text-foreground outline-none"
        :data-testid="inputTestId"
        @input="onInput"
      />
    </div>
    <p
      v-if="reserveNote || error || hint"
      :id="noteId"
      :class="
        cn(
          'm-0',
          reserveNote && 'min-h-5',
          hint && !error ? 'text-muted-foreground' : 'text-destructive',
          ui.error
        )
      "
      :data-testid="noteTestId"
      aria-live="polite"
    >
      {{ error ?? hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsUi } from './addCreditsPresentation'

const {
  input,
  label,
  error,
  hint,
  prefix,
  locked,
  reserveNote,
  inputTestId,
  noteTestId,
  ui
} = defineProps<{
  input: string
  label: string
  error?: string
  hint?: string
  prefix?: string
  locked: boolean
  /** Keeps the note line's height so an error does not shift the layout. */
  reserveNote?: boolean
  inputTestId: string
  noteTestId: string
  ui: AddCreditsUi
}>()

const emit = defineEmits<{ type: [input: string] }>()

const fieldId = useId()
const noteId = useId()
const describedBy = computed(() => (error || hint ? noteId : undefined))

function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) emit('type', event.target.value)
}
</script>
