<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <Teleport defer to="#layer-editor-header-actions">
      <Button
        v-if="mode === 'compositor'"
        variant="secondary"
        size="md"
        :disabled="!session.canUndo.value"
        @click="onRestore"
      >
        <i class="icon-[lucide--rotate-ccw] size-4" />
        {{ t('g.restore') }}
      </Button>
    </Teleport>
    <div class="flex min-h-0 flex-1">
      <LayerPanel :session="session" />
      <div class="relative flex min-h-0 min-w-0 flex-1">
        <LayerEditorCanvas :session="session" />
        <LayerEditorToolbar :session="session" />
      </div>
      <LayerPropertiesPanel :session="session" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

import LayerEditorCanvas from '@/components/layerEditor/LayerEditorCanvas.vue'
import LayerEditorToolbar from '@/components/layerEditor/LayerEditorToolbar.vue'
import LayerPanel from '@/components/layerEditor/LayerPanel.vue'
import LayerPropertiesPanel from '@/components/layerEditor/LayerPropertiesPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  applyLayerState,
  parseLayerState,
  resolveInitialLayerState
} from '@/composables/compositor/compositorLayerState'
import { imageRefViewQuery } from '@/composables/compositor/compositorPaths'
import {
  saveCompositorLayerState,
  saveCompositorPreview
} from '@/composables/compositor/compositorSave'
import { getCompositorWidgetValue } from '@/composables/compositor/compositorWidgets'
import { useCompositorAutoSave } from '@/composables/compositor/useCompositorAutoSave'
import {
  getCompositorBBoxes,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/composables/compositor/useCompositorLayers'
import {
  isTextEditingTarget,
  useLayerEditorSession
} from '@/composables/layerEditor/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

const { node, mode = 'images' } = defineProps<{
  node: LGraphNode
  mode?: 'images' | 'compositor'
}>()

const { t } = useI18n()
const session = useLayerEditorSession()
const changeTracker =
  mode === 'compositor'
    ? useWorkflowStore().activeWorkflow?.changeTracker
    : undefined

let autoSave: { stop(): void } | null = null
let closed = false

function layerName(url: string, index: number): string {
  try {
    const filename = new URL(url, window.location.origin).searchParams.get(
      'filename'
    )
    if (filename) return filename.replace(/\.[^.]+$/, '')
  } catch {
    void 0
  }
  return t('layerEditor.layerN', { n: index + 1 })
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.defaultPrevented || isTextEditingTarget(e.target)) return
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.code === 'KeyZ') {
    e.preventDefault()
    if (e.shiftKey) session.redo()
    else session.undo()
  } else if (e.code === 'KeyY') {
    e.preventDefault()
    session.redo()
  }
})

function onRestore(): void {
  session.editor.cancelFloating()
  while (session.editor.history.canUndo()) session.undo()
}

async function loadCompositorLayers(): Promise<void> {
  const refs = getCompositorLayers(node.id) ?? []
  const rand = app.getRandParam()
  const urls = refs.map((fileRef) =>
    api.apiURL(`/view?${imageRefViewQuery(fileRef)}${rand}`)
  )
  const names = refs.map(
    (fileRef, i) =>
      fileRef.filename.replace(/\.[^.]+$/, '') ||
      t('layerEditor.layerN', { n: i + 1 })
  )
  await session.loadImages(urls, names)

  const initialState = resolveInitialLayerState(
    parseLayerState(getCompositorWidgetValue(node)),
    getCompositorInputsFingerprint(node.id),
    getCompositorBBoxes(node.id)
  )
  if (initialState) {
    applyLayerState(initialState, session.imageLayers.value, session)
    session.editor.history.clear()
  }
}

function sessionHasEdits(): boolean {
  return (
    Boolean(session.editor.floating()) ||
    session.editor.history.canUndo() ||
    session.editor.history.canRedo()
  )
}

function finalizeCompositorSession(): void {
  try {
    autoSave?.stop()
    if (autoSave && sessionHasEdits()) {
      session.editor.anchorFloating()
      if (!saveCompositorLayerState(session, node)) {
        useToastStore().add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('compositor.saveFailed')
        })
      }
      void saveCompositorPreview(session, node)
      node.graph?.setDirtyCanvas(true)
    }
  } finally {
    changeTracker?.afterChange()
  }
}

onMounted(() => {
  if (mode === 'compositor') {
    changeTracker?.beforeChange()
    loadCompositorLayers()
      .then(() => {
        if (closed) return
        autoSave = useCompositorAutoSave(session, node)
      })
      .catch((err) => console.error('[Compositor] Loading layers failed:', err))
    return
  }
  const urls = useNodeOutputStore().getNodeImageUrls(node) ?? []
  const names = urls.map((url, i) => layerName(url, i))
  void session.loadImages(urls, names)
})

onUnmounted(() => {
  closed = true
  if (mode === 'compositor') finalizeCompositorSession()
  session.dispose()
})
</script>
