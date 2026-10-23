import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'

import type { ComfyExtension } from '@/types/comfy'

import { isLoad3dNode, isThreeJsNode } from './nodeTypes'

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

export const load3dLazyExtension: ComfyExtension = {
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
}
