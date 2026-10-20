<template>
  <Textarea
    ref="textareaRef"
    v-model="draft"
    :aria-label="label"
    :readonly="readOnly"
    class="h-150 min-h-40 flex-auto resize-none rounded-t-none rounded-b-2xl border-t border-solid border-border/50 bg-transparent px-[max(--spacing(4),calc((100%-34em)/2))] py-10 font-inter text-[15px] leading-6 focus-visible:ring-0"
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
  element.setSelectionRange(0, 0)
  element.focus()
})
</script>
