/**
 * Lazy loader for 3D extensions (Load3D, Preview3D, SaveGLB)
 *
 * This module defers loading of THREE.js (~1.8MB) until a 3D node is actually
 * used in a workflow. The heavy imports are only loaded when:
 * - A workflow containing 3D nodes is loaded
 * - A user adds a 3D node from the node menu
 */

import { useExtensionService } from '@/services/extensionService'

const LOAD3D_NODE_TYPES = new Set(['Load3D', 'Preview3D', 'SaveGLB'])

let load3dExtensionsLoaded = false
let load3dExtensionsLoading: Promise<void> | null = null

/**
 * Dynamically load the 3D extensions (and THREE.js) on demand
 */
async function loadLoad3dExtensions(): Promise<void> {
  if (load3dExtensionsLoaded) return

  if (load3dExtensionsLoading) {
    return load3dExtensionsLoading
  }

  load3dExtensionsLoading = (async () => {
    // Import both extensions - they will self-register via useExtensionService()
    await Promise.all([import('./load3d'), import('./saveMesh')])
    load3dExtensionsLoaded = true
  })()

  return load3dExtensionsLoading
}

/**
 * Check if a node type is a 3D node that requires THREE.js
 */
function isLoad3dNodeType(nodeTypeName: string): boolean {
  return LOAD3D_NODE_TYPES.has(nodeTypeName)
}

// Register a lightweight extension that triggers lazy loading
useExtensionService().registerExtension({
  name: 'Comfy.Load3DLazy',

  async beforeRegisterNodeDef(_nodeType, nodeData) {
    // When a 3D node type is being registered, load the 3D extensions
    if (isLoad3dNodeType(nodeData.name)) {
      await loadLoad3dExtensions()
    }
  }
})
