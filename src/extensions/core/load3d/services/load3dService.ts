/**
 * Load3D Service - provides access to Load3D instances
 *
 * This service uses lazy imports to avoid pulling THREE.js into the main bundle.
 * The nodeToLoad3dMap is accessed lazily - it will only be available after
 * the load3d extension has been loaded.
 */
import { toRaw } from 'vue'

import type Load3d from '@comfyorg/viewport3d/load3d/Load3d'
import {
  cacheNodeToLoad3dMap,
  getNodeToLoad3dMapSync,
  removeLoad3d
} from '@/extensions/core/load3d/load3dInstances'
import type {
  AnimationItem,
  BackgroundRenderModeType,
  CameraType,
  MaterialMode,
  UpDirection
} from '@comfyorg/viewport3d/load3d/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'

// Type for the useLoad3dViewer composable function
// Using explicit type to avoid import() type annotations (lint rule)
type UseLoad3dViewerFn = (node?: LGraphNode) => {
  backgroundColor: { value: string }
  showGrid: { value: boolean }
  cameraType: { value: CameraType }
  fov: { value: number }
  lightIntensity: { value: number }
  backgroundImage: { value: string }
  hasBackgroundImage: { value: boolean }
  backgroundRenderMode: { value: BackgroundRenderModeType }
  upDirection: { value: UpDirection }
  materialMode: { value: MaterialMode }
  needApplyChanges: { value: boolean }
  isPreview: { value: boolean }
  isStandaloneMode: { value: boolean }
  isSplatModel: { value: boolean }
  isPlyModel: { value: boolean }
  sourceFormat: { value: string | null }
  animations: { value: AnimationItem[] }
  playing: { value: boolean }
  selectedSpeed: { value: number }
  selectedAnimation: { value: number }
  animationProgress: { value: number }
  animationDuration: { value: number }

  initializeViewer: (containerRef: HTMLElement, source: Load3d) => Promise<void>
  initializeStandaloneViewer: (
    containerRef: HTMLElement,
    modelUrl: string
  ) => Promise<void>
  cleanup: () => void
  handleResize: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  applyChanges: () => Promise<boolean>
  restoreInitialState: () => void
  refreshViewport: () => void
  exportModel: (format: string) => Promise<void>
  handleBackgroundImageUpdate: (file: File | null) => Promise<void>
  handleModelDrop: (file: File) => Promise<void>
  handleSeek: (progress: number) => void
}

// Cache for lazy-loaded modules
let cachedUseLoad3dViewer: UseLoad3dViewerFn | null = null

// Async loader for nodeToLoad3dMap - also caches for sync access
async function loadNodeToLoad3dMap(): Promise<Map<LGraphNode, Load3d>> {
  const cached = getNodeToLoad3dMapSync()
  if (cached) return cached
  const module = await import('@/extensions/core/load3d/composables/useLoad3d')
  cacheNodeToLoad3dMap(module.nodeToLoad3dMap)
  return module.nodeToLoad3dMap
}

async function loadUseLoad3dViewer() {
  if (!cachedUseLoad3dViewer) {
    const module =
      await import('@/extensions/core/load3d/composables/useLoad3dViewer')
    cachedUseLoad3dViewer = module.useLoad3dViewer
  }
  return cachedUseLoad3dViewer
}

// Type definitions for Load3D node
interface Load3DNode extends LGraphNode {
  syncLoad3dConfig?: () => void
}

const viewerInstances = new Map<NodeId, ReturnType<UseLoad3dViewerFn>>()

class Load3dService {
  private static instance: Load3dService | undefined

  private constructor() {}

  static getInstance(): Load3dService {
    if (!Load3dService.instance) {
      Load3dService.instance = new Load3dService()
    }
    return Load3dService.instance
  }

  /**
   * Get Load3d instance for a node (synchronous).
   * Returns null if the load3d module hasn't been loaded yet.
   */
  getLoad3d(node: LGraphNode): Load3d | null {
    const rawNode = toRaw(node)
    const map = getNodeToLoad3dMapSync()
    if (!map) return null
    return map.get(rawNode) || null
  }

  /**
   * Get Load3d instance for a node (async, loads module if needed).
   */
  async getLoad3dAsync(node: LGraphNode): Promise<Load3d | null> {
    const rawNode = toRaw(node)
    const map = await loadNodeToLoad3dMap()
    return map.get(rawNode) || null
  }

  clear() {
    const map = getNodeToLoad3dMapSync()
    if (!map) return
    for (const [node] of map) {
      removeLoad3d(node)
    }
  }

  /**
   * Get or create viewer (async, loads module if needed).
   * Use this for initial viewer creation.
   */
  async getOrCreateViewer(node: LGraphNode) {
    const nodeId = node.id
    if (!viewerInstances.has(nodeId)) {
      const useLoad3dViewer = await loadUseLoad3dViewer()
      viewerInstances.set(nodeId, useLoad3dViewer(node))
    }

    return viewerInstances.get(nodeId)
  }

  /**
   * Get or create viewer (sync version).
   * Only works after useLoad3dViewer has been loaded.
   * Returns null if module not yet loaded - use async version instead.
   */
  getOrCreateViewerSync<T extends UseLoad3dViewerFn>(
    node: LGraphNode,
    useLoad3dViewer: T
  ): ReturnType<T> {
    const nodeId = node.id
    if (!viewerInstances.has(nodeId)) {
      viewerInstances.set(nodeId, useLoad3dViewer(node))
    }

    return viewerInstances.get(nodeId) as ReturnType<T>
  }

  removeViewer(node: LGraphNode) {
    const nodeId = node.id
    const viewer = viewerInstances.get(nodeId)

    if (viewer) {
      viewer.cleanup()
    }

    viewerInstances.delete(nodeId)
  }

  async handleViewerClose(node: LGraphNode) {
    const viewer = await useLoad3dService().getOrCreateViewer(node)
    if (!viewer) return

    if (viewer.needApplyChanges.value) {
      await viewer.applyChanges()

      // Sync configuration back to the node's UI
      const load3DNode = node as Load3DNode
      if (load3DNode.syncLoad3dConfig) {
        load3DNode.syncLoad3dConfig()
      }
    }

    useLoad3dService().removeViewer(node)
  }
}

export const useLoad3dService = () => {
  return Load3dService.getInstance()
}
