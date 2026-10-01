<script setup lang="ts">
import { useTemplateRef } from 'vue'

defineOptions({ inheritAttrs: false })

const { label, disabled = false } = defineProps<{
  /** Names the button for screen readers when its content is not text. */
  label?: string
  disabled?: boolean
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
    :disabled
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
    @change="onChange"
  />
</template>
