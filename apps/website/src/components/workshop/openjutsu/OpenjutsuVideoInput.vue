<script setup lang="ts">
/** A video picker: the slot is the label that opens the file browser. */
const { label, inputTestId } = defineProps<{
  /** Names the picker for screen readers when the slot is not text. */
  label?: string
  /** Names the hidden file input, for tests to upload through. */
  inputTestId?: string
}>()

const emit = defineEmits<{ file: [file: File] }>()

function choose(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (file?.type.startsWith('video/')) emit('file', file)
}
</script>

<template>
  <label
    class="cursor-pointer transition focus-within:ring-3 focus-within:ring-primary-comfy-yellow/50"
  >
    <slot />
    <input
      type="file"
      accept="video/*"
      class="sr-only"
      :aria-label="label"
      :data-testid="inputTestId"
      @change="choose"
    />
  </label>
</template>
