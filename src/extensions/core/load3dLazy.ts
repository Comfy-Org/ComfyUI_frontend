/**
 * Lazy loader for 3D extensions (Load3D, Preview3D, SaveGLB)
 *
 * This module defers loading of THREE.js (~1.8MB) until a 3D node is actually
 * used in a workflow. The heavy imports are only loaded when:
 * - A workflow containing 3D nodes is loaded
 * - A user adds a 3D node from the node menu
 */

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'

import type { ComfyExtension } from '@/types/comfy'

import { isLoad3dNode, isThreeJsNode } from './load3d/nodeTypes'

let load3dExtensionsLoaded = false
let load3dExtensionsLoading: Promise<ComfyExtension[] | undefined> | null = null

function loadLoad3dExtensions(): Promise<ComfyExtension[] | undefined> {
  if (load3dExtensionsLoaded) return Promise.resolve([])
  load3dExtensionsLoading ??= importLoad3dExtensions()
  return load3dExtensionsLoading
}

async function importLoad3dExtensions(): Promise<ComfyExtension[] | undefined> {
  const before = new Set(useExtensionStore().enabledExtensions)
  try {
    await Promise.all([
      import('./load3d'),
      import('./load3dAdvanced'),
      import('./load3dPreviewExtensions'),
      import('./saveMesh'),
      import('./cameraInfo'),
      import('./cameraAngle'),
      import('./lightInfo')
    ])
  } catch (cause) {
    load3dExtensionsLoading = null
    reportError(cause, {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })
    return undefined
  }
  load3dExtensionsLoaded = true
  return useExtensionStore().enabledExtensions.filter((ext) => !before.has(ext))
}

useExtensionService().registerExtension({
  name: 'Comfy.Load3DLazy',

  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (!isThreeJsNode(nodeData.name)) return

    if (isLoad3dNode(nodeData.name)) {
      if (nodeData.name === 'Load3D' || nodeData.name === 'Load3DAdvanced') {
        const modelFile = nodeData.input?.required?.model_file
        if (modelFile?.[1]) {
          modelFile[1].mesh_upload = true
          modelFile[1].upload_subfolder = '3d'
        }
      }
    }

    const newExtensions = await loadLoad3dExtensions()
    if (!newExtensions) return
    for (const ext of newExtensions) {
      await ext.beforeRegisterNodeDef?.(nodeType, nodeData, app)
    }
  }
})
