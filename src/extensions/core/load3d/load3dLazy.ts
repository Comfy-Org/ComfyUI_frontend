import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useApp } from '@/scripts/appInstance'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'

import type { ComfyExtension } from '@/types/comfy'

import { isThreeJsNode } from './nodeTypes'
import { load3dSettings } from './load3dSettings'
import { load3dWidgets } from './load3dWidgets'

interface GraphNodeTypes {
  nodes?: readonly { type?: unknown }[]
  definitions?: { subgraphs?: readonly GraphNodeTypes[] }
}

interface Load3dLoadState {
  loaded: boolean
  loading: Promise<ComfyExtension[] | undefined> | null
}

const loadStates = new WeakMap<object, Load3dLoadState>()

function loadLoad3dExtensions(): Promise<ComfyExtension[] | undefined> {
  const extensionStore = useExtensionStore()
  let state = loadStates.get(extensionStore)
  if (!state) {
    state = { loaded: false, loading: null }
    loadStates.set(extensionStore, state)
  }
  if (state.loaded) return Promise.resolve([])
  state.loading ??= importLoad3dExtensions(extensionStore, state)
  return state.loading
}

async function importLoad3dExtensions(
  extensionStore: ReturnType<typeof useExtensionStore>,
  state: Load3dLoadState
): Promise<ComfyExtension[] | undefined> {
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
    extensionStore.markCoreExtensions(extensions)
    const { registerExtension } = useExtensionService()
    for (const extension of extensions)
      disposers.push(registerExtension(extension))
  } catch (cause) {
    state.loading = null
    disposers.forEach((dispose) => dispose())
    reportError(cause, {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })
    return undefined
  }
  state.loaded = true
  return extensions.filter((extension) =>
    extensionStore.isExtensionEnabled(extension.name)
  )
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
    await extension.nodeCreated?.(node, useApp())
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
