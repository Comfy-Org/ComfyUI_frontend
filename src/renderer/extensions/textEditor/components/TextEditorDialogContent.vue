<template>
  <Textarea
    ref="textareaRef"
    v-model="draft"
    :aria-label="label"
    :readonly="readOnly"
    :class="
      cn(
        'min-h-100 flex-1 resize-none px-[max(--spacing(4),calc((100%-34em)/2))] py-3 font-inter text-[15px] leading-6',
        maximized && 'py-8'
      )
    "
    data-testid="text-editor-dialog-textarea"
    @update:model-value="(value) => onEdit(String(value))"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

import Textarea from '@/components/ui/textarea/Textarea.vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  text,
  label,
  readOnly = false,
  maximized = false,
  onEdit
} = defineProps<{
  text: string
  label: string
  readOnly?: boolean
  maximized?: boolean
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
