import {
  applyLayerState,
  parseLayerState,
  resolveInitialLayerState
} from '@comfyorg/layer-editor/persistence/compositorLayerState'
import { imageRefViewQuery } from '@/renderer/extensions/layerEditor/compositor/compositorPaths'
import { getCompositorWidgetValue } from '@/renderer/extensions/layerEditor/compositor/compositorWidgets'
import {
  getCompositorBBoxes,
  getCompositorCanvas,
  getCompositorInputsFingerprint,
  getCompositorLayers
} from '@/renderer/extensions/layerEditor/compositor/useCompositorLayers'
import type { LayerEditorSession } from '@comfyorg/layer-editor/vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export async function loadCompositorSession(
  session: LayerEditorSession,
  node: LGraphNode,
  fallbackLayerName: (index: number) => string
): Promise<number> {
  const refs = getCompositorLayers(node) ?? []
  const rand = app.getRandParam()
  const urls = refs.map((fileRef) =>
    api.apiURL(`/view?${imageRefViewQuery(fileRef)}${rand}`)
  )
  const names = refs.map(
    (fileRef, i) =>
      fileRef.filename.replace(/\.[^.]+$/, '') || fallbackLayerName(i)
  )
  const failed = await session.loadImages(urls, names)

  const canvas = getCompositorCanvas(node)
  const initialState = resolveInitialLayerState(
    parseLayerState(getCompositorWidgetValue(node)),
    getCompositorInputsFingerprint(node),
    getCompositorBBoxes(node),
    canvas
  )
  if (initialState) {
    applyLayerState(initialState, session.imageLayers.value, session)
    session.editor.history.clear()
    session.fitView()
  } else if (canvas) {
    session.setCanvasSize(canvas.w, canvas.h)
    session.editor.history.clear()
    session.fitView()
  }
  return failed
}
