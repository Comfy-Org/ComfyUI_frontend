<template>
  <Textarea
    ref="textareaRef"
    v-model="draft"
    :aria-label="label"
    :readonly="readOnly"
    class="min-h-80 flex-1 resize-none font-mono text-[calc(var(--comfy-textarea-font-size)+2px)] leading-normal"
    data-testid="text-editor-dialog-textarea"
    @update:model-value="(value) => onEdit(String(value))"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

import Textarea from '@/components/ui/textarea/Textarea.vue'

const {
  text,
  label,
  readOnly = false,
  onEdit
} = defineProps<{
  text: string
  label: string
  readOnly?: boolean
  onEdit: (text: string) => void
}>()

const draft = ref(text)
const textareaRef = useTemplateRef('textareaRef')

onMounted(() => {
  const element: unknown = textareaRef.value?.$el
  if (!(element instanceof HTMLTextAreaElement)) return
  element.focus()
  element.setSelectionRange(element.value.length, element.value.length)
})
</script>
