<template>
  <div
    ref="editorEl"
    :data-placeholder="placeholder"
    :class="
      cn(
        'comfy-markdown-input comfy-markdown-content rounded-lg border border-border-default bg-secondary-background px-3 py-2 text-sm text-base-foreground transition-colors focus-within:border-node-component-border',
        hasError && 'border-destructive-background'
      )
    "
  />
</template>

<script setup lang="ts">
import { Editor as TiptapEditor } from '@tiptap/core'
import TiptapLink from '@tiptap/extension-link'
import TiptapStarterKit from '@tiptap/starter-kit'
import { Markdown as TiptapMarkdown } from 'tiptap-markdown'
import { onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const {
  placeholder = '',
  maxlength,
  hasError = false
} = defineProps<{
  placeholder?: string
  maxlength?: number
  hasError?: boolean
}>()

const modelValue = defineModel<string>({ default: '' })

const editorEl = ref<HTMLElement>()
let editor: TiptapEditor | null = null

function getMarkdown(): string {
  return editor?.storage.markdown?.getMarkdown() ?? ''
}

watch(editorEl, (el) => {
  if (!el) return

  editor = new TiptapEditor({
    element: el,
    extensions: [
      TiptapStarterKit,
      TiptapMarkdown.configure({
        html: false,
        breaks: true,
        transformPastedText: true
      }),
      TiptapLink.configure({ openOnClick: false })
    ],
    content: modelValue.value,
    onUpdate() {
      const md = getMarkdown()
      if (maxlength && md.length > maxlength) {
        editor?.commands.undo()
        return
      }
      modelValue.value = md
    }
  })
})

watch(modelValue, (value) => {
  if (!editor) return
  const current = getMarkdown()
  if (value !== current) {
    editor.commands.setContent(value)
  }
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})
</script>

<style>
.comfy-markdown-input .tiptap {
  outline: none;
  min-height: 3.5rem;
}

.comfy-markdown-input .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--p-text-muted-color, #999);
  float: left;
  height: 0;
  pointer-events: none;
}

.comfy-markdown-input .tiptap p {
  margin: 0 0 0.25em;
}

.comfy-markdown-input .tiptap p:last-child {
  margin-bottom: 0;
}
</style>
