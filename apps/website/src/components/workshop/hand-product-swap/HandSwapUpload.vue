<script setup lang="ts">
import { useTemplateRef } from 'vue'

defineOptions({ inheritAttrs: false })

const { label, inputId } = defineProps<{
  label: string
  /** Names the hidden file input, for tests to upload through. */
  inputId: string
}>()
const emit = defineEmits<{ file: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file?.type.startsWith('image/')) emit('file', file)
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    :aria-label="label"
    :title="label"
    @click="input?.click()"
  >
    <slot />
  </button>
  <input
    ref="input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    :data-testid="inputId"
    @change="onChange"
  />
</template>
