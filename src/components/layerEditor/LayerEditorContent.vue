<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex min-h-0 flex-1">
      <LayerPanel :session="session" />
      <div class="relative flex min-h-0 min-w-0 flex-1">
        <LayerEditorCanvas :session="session" />
        <LayerEditorToolbar :session="session" />
      </div>
      <LayerPropertiesPanel :session="session" />
    </div>
    <div
      class="flex items-center justify-end gap-2 border-t border-border-default bg-base-background px-4 py-3"
    >
      <Button variant="destructive" size="md" @click="onCancel">
        {{ t('g.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="md"
        :disabled="mode !== 'compositor' || saving"
        @click="onSave"
      >
        {{ t('g.save') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
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
import { getCompositorWidgetValue } from '@/composables/compositor/compositorWidgets'
import {
  getCompositorBBoxes,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/composables/compositor/useCompositorLayers'
import { useCompositorSaver } from '@/composables/compositor/useCompositorSaver'
import { useLayerEditorSession } from '@/composables/layerEditor/useLayerEditorSession'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

const { node, mode = 'images' } = defineProps<{
  node: LGraphNode
  mode?: 'images' | 'compositor'
}>()

const { t } = useI18n()
const session = useLayerEditorSession()
const { saveComposite } = useCompositorSaver()
const saving = ref(false)

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

function onCancel(): void {
  useDialogStore().closeDialog({ key: 'global-layer-editor' })
}

async function onSave(): Promise<void> {
  if (mode !== 'compositor' || saving.value) return
  saving.value = true
  try {
    await saveComposite(session, node)
  } finally {
    saving.value = false
  }
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

onMounted(() => {
  if (mode === 'compositor') {
    void loadCompositorLayers()
    return
  }
  const urls = useNodeOutputStore().getNodeImageUrls(node) ?? []
  const names = urls.map((url, i) => layerName(url, i))
  void session.loadImages(urls, names)
})

onUnmounted(() => {
  session.dispose()
})
</script>
