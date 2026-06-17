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
import { app } from '@/scripts/app'
import { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'

import type { ComfyExtension } from '@/types/comfy'

import { isLoad3dNode } from './load3d/nodeTypes'

let load3dExtensionsLoaded = false
let load3dExtensionsLoading: Promise<ComfyExtension[]> | null = null

/**
 * Dynamically load the 3D extensions (and THREE.js) on demand.
 * Returns the list of newly registered extensions so the caller can
 * replay hooks that they missed.
 */
async function loadLoad3dExtensions(): Promise<ComfyExtension[]> {
  if (load3dExtensionsLoaded) return []

  if (load3dExtensionsLoading) {
    return load3dExtensionsLoading
  }

  load3dExtensionsLoading = (async () => {
    const before = new Set(useExtensionStore().enabledExtensions)
    // Import extensions - they self-register via useExtensionService()
    await Promise.all([
      import('./load3d'),
      import('./load3dAdvanced'),
      import('./load3dPreviewExtensions'),
      import('./saveMesh')
    ])
    load3dExtensionsLoaded = true
    return useExtensionStore().enabledExtensions.filter(
      (ext) => !before.has(ext)
    )
  })()

  return load3dExtensionsLoading
}

// Register a lightweight extension that triggers lazy loading
useExtensionService().registerExtension({
  name: 'Comfy.Load3DLazy',

  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyNodeDef
  ) {
    if (isLoad3dNode(nodeData.name)) {
      // Inject mesh_upload spec flags so WidgetSelect.vue can detect
      // Load3D's model_file as a mesh upload widget without hardcoding.
      if (nodeData.name === 'Load3D' || nodeData.name === 'Load3DAdvanced') {
        const modelFile = nodeData.input?.required?.model_file
        if (modelFile?.[1]) {
          modelFile[1].mesh_upload = true
          modelFile[1].upload_subfolder = '3d'
        }
      }

      // Load the 3D extensions and replay their beforeRegisterNodeDef hooks,
      // since invokeExtensionsAsync already captured the extensions snapshot
      // before these new extensions were registered.
      const newExtensions = await loadLoad3dExtensions()
      for (const ext of newExtensions) {
        await ext.beforeRegisterNodeDef?.(nodeType, nodeData, app)
      }
    }
  }
})
