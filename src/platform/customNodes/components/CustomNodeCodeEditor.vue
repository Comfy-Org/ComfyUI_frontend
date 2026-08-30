<template>
  <div
    ref="editorElement"
    class="size-full min-h-0 min-w-0 bg-base-background"
    :aria-label="$t('customNodePacks.editor.agent.diff')"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { languageForCustomNodePath, monaco } from './customNodeMonaco'

const { originalContent, path, proposedContent, theme } = defineProps<{
  path: string
  originalContent: string
  proposedContent: string
  theme: 'light' | 'dark'
}>()

const editorElement = useTemplateRef<HTMLDivElement>('editorElement')
let editor: monaco.editor.IStandaloneDiffEditor | undefined
let originalModel: monaco.editor.ITextModel | undefined
let proposedModel: monaco.editor.ITextModel | undefined

function disposeEditor() {
  editor?.dispose()
  editor = undefined
  originalModel?.dispose()
  originalModel = undefined
  proposedModel?.dispose()
  proposedModel = undefined
}

function createEditor() {
  if (!editorElement.value) return
  disposeEditor()
  const language = languageForCustomNodePath(path)
  originalModel = monaco.editor.createModel(originalContent, language)
  proposedModel = monaco.editor.createModel(proposedContent, language)
  editor = monaco.editor.createDiffEditor(editorElement.value, {
    automaticLayout: true,
    fontSize: 13,
    minimap: { enabled: false },
    originalEditable: false,
    readOnly: true,
    renderSideBySide: true,
    scrollBeyondLastLine: false,
    theme: theme === 'light' ? 'vs' : 'vs-dark'
  })
  editor.setModel({ original: originalModel, modified: proposedModel })
}

onMounted(createEditor)

watch(
  () => [path, originalContent, proposedContent, theme] as const,
  createEditor
)

onBeforeUnmount(disposeEditor)
</script>
