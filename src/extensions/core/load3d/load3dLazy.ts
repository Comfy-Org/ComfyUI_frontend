import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'

import type { ComfyExtension } from '@/types/comfy'

import { isThreeJsNode } from './nodeTypes'
import { load3dSettings } from './load3dSettings'
import { load3dWidgets } from './load3dWidgets'

interface GraphNodeTypes {
  nodes?: readonly { type?: unknown }[]
  definitions?: { subgraphs?: readonly GraphNodeTypes[] }
}

let load3dExtensionsLoaded = false
let load3dExtensionsLoading: Promise<ComfyExtension[] | undefined> | null = null

function loadLoad3dExtensions(): Promise<ComfyExtension[] | undefined> {
  if (load3dExtensionsLoaded) return Promise.resolve([])
  load3dExtensionsLoading ??= importLoad3dExtensions()
  return load3dExtensionsLoading
}

async function importLoad3dExtensions(): Promise<ComfyExtension[] | undefined> {
  const disposers: (() => void)[] = []
  let extensions: ComfyExtension[]
  try {
    const [
      load3d,
      load3dAdvanced,
      load3dPreview,
      saveMesh,
      cameraInfo,
      cameraAngle,
      lightInfo
    ] = await Promise.all([
      import('./load3d'),
      import('./load3dAdvanced'),
      import('./load3dPreviewExtensions'),
      import('./saveMesh'),
      import('./cameraInfo'),
      import('./cameraAngle'),
      import('./lightInfo')
    ])
    extensions = [
      load3d.load3dExtension,
      load3d.preview3DExtension,
      load3d.preview3DAdvancedExtension,
      load3d.save3DAdvancedExtension,
      load3dAdvanced.load3dAdvancedExtension,
      load3dPreview.previewGaussianSplatExtension,
      load3dPreview.previewPointCloudExtension,
      load3dPreview.saveGaussianSplatExtension,
      load3dPreview.savePointCloudExtension,
      saveMesh.saveMeshExtension,
      cameraInfo.cameraInfoExtension,
      cameraAngle.cameraAngleExtension,
      lightInfo.lightInfoExtension
    ]
    const { registerExtension } = useExtensionService()
    for (const extension of extensions)
      disposers.push(registerExtension(extension))
  } catch (cause) {
    disposers.forEach((dispose) => dispose())
    load3dExtensionsLoading = null
    reportError(cause, {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })
    return undefined
  }
  load3dExtensionsLoaded = true
  const { isExtensionEnabled } = useExtensionStore()
  return extensions.filter((extension) => isExtensionEnabled(extension.name))
}

function enableMeshUpload(nodeData: ComfyNodeDef) {
  const modelFile = nodeData.input?.required?.model_file
  if (!modelFile?.[1]) return
  modelFile[1].mesh_upload = true
  modelFile[1].upload_subfolder = '3d'
}

function addPreview3dInput(nodeData: ComfyNodeDef) {
  const input = (nodeData.input ??= {})
  ;(input.required ??= {}).image = ['PREVIEW_3D']
}

function addLoad3dAdvancedViewport(nodeData: ComfyNodeDef) {
  enableMeshUpload(nodeData)
  const required = nodeData.input?.required
  if (required) required.viewport_state = ['LOAD_3D_ADVANCED', {}]
}

const nodeDefPatches: Record<string, (nodeData: ComfyNodeDef) => void> = {
  Load3D: enableMeshUpload,
  Load3DAdvanced: addLoad3dAdvancedViewport,
  Preview3D: addPreview3dInput,
  SaveGLB: addPreview3dInput
}

function containsThreeJsNode(graph: GraphNodeTypes): boolean {
  return (
    (graph.nodes ?? []).some(
      ({ type }) => typeof type === 'string' && isThreeJsNode(type)
    ) || (graph.definitions?.subgraphs ?? []).some(containsThreeJsNode)
  )
}

async function replayNodeCreated(extension: ComfyExtension, node: LGraphNode) {
  try {
    await extension.nodeCreated?.(node, app)
  } catch (cause) {
    reportError(cause, {
      errorType: 'error_replaying_3d_node_created',
      surface: 'graph',
      context: { extension: extension.name }
    })
  }
}

export const load3dLazyExtension: ComfyExtension = {
  name: 'Comfy.Load3DLazy',
  settings: load3dSettings,

  getCustomWidgets: () => load3dWidgets,

  beforeRegisterNodeDef(_nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
    nodeDefPatches[nodeData.name]?.(nodeData)
  },

  async beforeConfigureGraph(graphData) {
    if (containsThreeJsNode(graphData)) await loadLoad3dExtensions()
  },

  async nodeCreated(node: LGraphNode) {
    const { comfyClass } = node.constructor
    if (!comfyClass || !isThreeJsNode(comfyClass)) return
    const newExtensions = await loadLoad3dExtensions()
    await Promise.all(
      (newExtensions ?? []).map((extension) =>
        replayNodeCreated(extension, node)
      )
    )
  }
}
