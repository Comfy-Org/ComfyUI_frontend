import { nextTick } from 'vue'

import { useLoad3d } from '@/extensions/core/load3d/composables/useLoad3d'
import { createExportMenuItems } from '@/extensions/core/load3d/exportMenuHelper'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import type {
  NodeExecutionOutput,
  NodeOutputWith,
  ResultItem
} from '@/platform/remote/comfyui/execution/types'
import type { ComfyExtension } from '@/types/comfy'

type SaveMeshOutput = NodeOutputWith<{
  '3d'?: ResultItem[]
}>
import { app } from '@/scripts/app'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

function applySaveGLBOutput(node: LGraphNode, fileInfo: ResultItem): void {
  const filePath = (fileInfo.subfolder ?? '') + '/' + (fileInfo.filename ?? '')
  const loadFolder = fileInfo.type as 'input' | 'output'

  const modelWidget = node.widgets?.find((w) => w.name === 'image')
  if (!modelWidget) return

  if (
    modelWidget.value === filePath &&
    node.properties['Last Time Model File'] === filePath &&
    node.properties['Last Time Model Folder'] === loadFolder
  ) {
    return
  }

  modelWidget.value = filePath
  node.properties['Last Time Model File'] = filePath
  node.properties['Last Time Model Folder'] = loadFolder

  useLoad3d(node).waitForLoad3d((load3d) => {
    const config = new Load3DConfiguration(load3d, node.properties)
    config.configureForSaveMesh(loadFolder, filePath, {
      silentOnNotFound: true
    })
  })
}

export const saveMeshExtension: ComfyExtension = {
  name: 'Comfy.SaveGLB',

  onNodeOutputsUpdated(
    nodeOutputs: Record<NodeLocatorId, NodeExecutionOutput>
  ) {
    for (const [locatorId, output] of Object.entries(nodeOutputs)) {
      const fileInfo = (output as SaveMeshOutput)['3d']?.[0]
      if (!fileInfo) continue

      const node = getNodeByLocatorId(app.rootGraph, locatorId)
      if (!node || node.constructor.comfyClass !== 'SaveGLB') continue

      applySaveGLBOutput(node, fileInfo)
    }
  },

  getNodeMenuItems(node: LGraphNode): (IContextMenuValue | null)[] {
    // Only show menu items for SaveGLB nodes
    if (node.constructor.comfyClass !== 'SaveGLB') return []

    const load3d = useLoad3dService().getLoad3d(node)
    if (!load3d) return []

    if (load3d.isSplatModel()) return []

    return createExportMenuItems(load3d)
  },

  async nodeCreated(node: LGraphNode) {
    if (node.constructor.comfyClass !== 'SaveGLB') return

    const [oldWidth, oldHeight] = node.size

    node.setSize([Math.max(oldWidth, 400), Math.max(oldHeight, 550)])

    await nextTick()

    useLoad3d(node).onLoad3dReady((load3d) => {
      const modelWidget = node.widgets?.find((w) => w.name === 'image')
      if (!modelWidget) return

      const lastTimeModelFile = node.properties['Last Time Model File'] as
        | string
        | undefined
      const lastTimeModelFolder =
        (node.properties['Last Time Model Folder'] as
          | 'input'
          | 'output'
          | undefined) ?? 'output'

      if (!lastTimeModelFile) return

      modelWidget.value = lastTimeModelFile

      const config = new Load3DConfiguration(load3d, node.properties)
      config.configureForSaveMesh(lastTimeModelFolder, lastTimeModelFile, {
        silentOnNotFound: true
      })
    })

    const onExecuted = node.onExecuted

    node.onExecuted = function (output: SaveMeshOutput) {
      onExecuted?.call(this, output)

      const fileInfo = output['3d']?.[0]

      if (!fileInfo) return

      useLoad3d(node).waitForLoad3d((load3d) => {
        const modelWidget = node.widgets?.find((w) => w.name === 'image')

        if (modelWidget) {
          const filePath =
            (fileInfo.subfolder ?? '') + '/' + (fileInfo.filename ?? '')

          modelWidget.value = filePath

          const config = new Load3DConfiguration(load3d, node.properties)

          const loadFolder = fileInfo.type as 'input' | 'output'

          node.properties['Last Time Model File'] = filePath
          node.properties['Last Time Model Folder'] = loadFolder

          config.configureForSaveMesh(loadFolder, filePath, {
            silentOnNotFound: true
          })
        }
      })
    }
  }
}
