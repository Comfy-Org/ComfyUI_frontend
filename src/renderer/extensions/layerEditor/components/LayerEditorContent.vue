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

import LayerEditorCanvas from '@/renderer/extensions/layerEditor/components/LayerEditorCanvas.vue'
import LayerEditorToolbar from '@/renderer/extensions/layerEditor/components/LayerEditorToolbar.vue'
import LayerPanel from '@/renderer/extensions/layerEditor/components/LayerPanel.vue'
import LayerPropertiesPanel from '@/renderer/extensions/layerEditor/components/LayerPropertiesPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  saveCompositorLayerState,
  saveCompositorPreview
} from '@/renderer/extensions/compositor/composables/compositorSave'
import { loadCompositorSession } from '@/renderer/extensions/compositor/composables/compositorSession'
import { useCompositorAutoSave } from '@/renderer/extensions/compositor/composables/useCompositorAutoSave'
import {
  isTextEditingTarget,
  useLayerEditorSession
} from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToast } from '@/components/ui/toast'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
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

async function loadCompositorLayers(): Promise<number> {
  return loadCompositorSession(session, node, (i) =>
    t('layerEditor.layerN', { n: i + 1 })
  )
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
      if (saveCompositorLayerState(session, node)) {
        void saveCompositorPreview(session, node)
        node.graph?.setDirtyCanvas(true)
      } else {
        useToast().error(t('g.error'), {
          description: t('compositor.saveFailed')
        })
      }
    } else if (sessionHasEdits()) {
      useToast().error(t('g.error'), {
        description: t('compositor.saveFailed')
      })
    }
  } finally {
    changeTracker?.afterChange()
  }
}

onMounted(() => {
  if (mode === 'compositor') {
    changeTracker?.beforeChange()
    loadCompositorLayers()
      .then((failed) => {
        if (closed) return
        if (failed > 0) {
          useToast().warning(t('layerEditor.title'), {
            description: t('layerEditor.layersFailedToLoad', { count: failed })
          })
          return
        }
        autoSave = useCompositorAutoSave(session, node)
      })
      .catch((err) => {
        console.error('[Compositor] Loading layers failed:', err)
        if (closed) return
        useToast().error(t('g.error'), {
          description: t('layerEditor.loadFailed')
        })
      })
    return
  }
  const urls = useNodeOutputStore().getNodeImageUrls(node) ?? []
  const names = urls.map((url, i) => layerName(url, i))
  session
    .loadImages(urls, names)
    .then((failed) => {
      if (closed || failed === 0) return
      useToast().warning(t('layerEditor.title'), {
        description: t('layerEditor.layersFailedToLoad', { count: failed })
      })
    })
    .catch((err) => console.error('[LayerEditor] Loading images failed:', err))
})

onUnmounted(() => {
  closed = true
  if (mode === 'compositor') finalizeCompositorSession()
  session.dispose()
})
</script>
