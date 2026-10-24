<template>
  <Textarea
    ref="textareaRef"
    v-model="draft"
    :aria-label="label"
    :readonly="readOnly()"
    class="h-150 min-h-40 flex-auto resize-none rounded-t-none rounded-b-2xl border-t border-solid border-border/50 bg-transparent px-[max(--spacing(4),calc((100%-34em)/2))] py-10 font-inter text-[15px] leading-6 focus-visible:ring-0"
    data-testid="text-editor-dialog-textarea"
    @update:model-value="(value) => onEdit(String(value))"
  />
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import Textarea from '@/components/ui/textarea/Textarea.vue'

const { readText, label, readOnly, onEdit } = defineProps<{
  readText: () => string
  label: string
  readOnly: () => boolean
  onEdit: (text: string) => void
}>()

const draft = ref(readText())
const textareaRef = useTemplateRef('textareaRef')

function textareaElement(): HTMLTextAreaElement | undefined {
  const element: unknown = textareaRef.value?.$el
  return element instanceof HTMLTextAreaElement ? element : undefined
}

watch(
  () => readText(),
  async (text) => {
    if (text === draft.value) return
    const element = textareaElement()
    const view = element && {
      start: element.selectionStart,
      end: element.selectionEnd,
      direction: element.selectionDirection ?? undefined,
      scrollTop: element.scrollTop,
      selectedThrough: draft.value.slice(0, element.selectionEnd)
    }
    draft.value = text
    if (!element || !view) return
    await nextTick()
    const start = Math.min(view.start, text.length)
    const isSelectionIntact = text.startsWith(view.selectedThrough)
    element.setSelectionRange(
      start,
      isSelectionIntact ? view.end : start,
      view.direction
    )
    element.scrollTop = view.scrollTop
  }
)

onMounted(() => {
  const element = textareaElement()
  if (!element) return
  element.setSelectionRange(0, 0)
  element.focus()
})
</script>
