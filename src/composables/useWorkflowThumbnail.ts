import { ref } from 'vue'

import { ComfyWorkflow } from '@/stores/workflowStore'

import { useMinimap } from './useMinimap'

// Store thumbnails for each workflow
const workflowThumbnails = ref<Map<string, string>>(new Map())

// Shared minimap instance
let minimap: ReturnType<typeof useMinimap> | null = null

export const useWorkflowThumbnail = () => {
  /**
   * Capture a thumbnail of the canvas
   */
  const createMinimapPreview = (): Promise<string | null> => {
    try {
      if (!minimap) {
        minimap = useMinimap()
        minimap.canvasRef.value = document.createElement('canvas')
        minimap.canvasRef.value.width = minimap.width
        minimap.canvasRef.value.height = minimap.height
      }
      minimap.renderMinimap()

      return new Promise((resolve) => {
        minimap!.canvasRef.value!.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          } else {
            resolve(null)
          }
        })
      })
    } catch (error) {
      console.error('Failed to capture canvas thumbnail:', error)
      return Promise.resolve(null)
    }
  }

  /**
   * Store a thumbnail for a workflow
   */
  const storeThumbnail = async (workflow: ComfyWorkflow) => {
    const thumbnail = await createMinimapPreview()
    if (thumbnail) {
      workflowThumbnails.value.set(workflow.key, thumbnail)
    }
  }

  /**
   * Get a thumbnail for a workflow
   */
  const getThumbnail = (workflowKey: string): string | undefined => {
    return workflowThumbnails.value.get(workflowKey)
  }

  /**
   * Clear a thumbnail for a workflow
   */
  const clearThumbnail = (workflowKey: string) => {
    const thumbnail = workflowThumbnails.value.get(workflowKey)
    if (thumbnail) {
      URL.revokeObjectURL(thumbnail)
    }
    workflowThumbnails.value.delete(workflowKey)
  }

  /**
   * Clear all thumbnails
   */
  const clearAllThumbnails = () => {
    for (const thumbnail of workflowThumbnails.value.values()) {
      URL.revokeObjectURL(thumbnail)
    }
    workflowThumbnails.value.clear()
  }

  return {
    createMinimapPreview,
    storeThumbnail,
    getThumbnail,
    clearThumbnail,
    clearAllThumbnails,
    workflowThumbnails
  }
}
