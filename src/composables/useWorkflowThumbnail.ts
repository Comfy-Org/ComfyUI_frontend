import { ref } from 'vue'

import { ComfyWorkflow } from '@/stores/workflowStore'

// Store thumbnails for each workflow
const workflowThumbnails = ref<Map<string, string>>(new Map())

export const DEFAULT_THUMBNAIL_WIDTH = 300
export const DEFAULT_THUMBNAIL_HEIGHT = 200

export const useWorkflowThumbnail = () => {
  /**
   * Capture a thumbnail of the canvas
   */
  const captureCanvasThumbnail = async (
    width: number = DEFAULT_THUMBNAIL_WIDTH,
    height: number = DEFAULT_THUMBNAIL_HEIGHT
  ): Promise<string | null> => {
    const graphCanvas = document.getElementById(
      'graph-canvas'
    ) as HTMLCanvasElement

    try {
      const resizedCanvas = document.createElement('canvas')
      const resizedContext = resizedCanvas.getContext('2d')
      if (!resizedContext) return null

      resizedCanvas.height = height
      resizedCanvas.width = width

      // Calculate aspect ratios
      const sourceAspect = graphCanvas.width / graphCanvas.height
      const targetAspect = width / height

      let sourceX = 0
      let sourceY = 0
      let sourceWidth = graphCanvas.width
      let sourceHeight = graphCanvas.height

      // If source is wider than target, crop horizontally
      if (sourceAspect > targetAspect) {
        sourceWidth = graphCanvas.height * targetAspect
        sourceX = (graphCanvas.width - sourceWidth) / 2
      }
      // If source is taller than target, crop vertically
      else if (sourceAspect < targetAspect) {
        sourceHeight = graphCanvas.width / targetAspect
        sourceY = (graphCanvas.height - sourceHeight) / 2
      }

      // Draw the cropped portion to fit the target dimensions
      resizedContext.drawImage(
        graphCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height
      )

      return await new Promise((resolve) => {
        resizedCanvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          } else {
            resolve(null)
          }
        })
      })
    } catch (error) {
      console.error('Failed to capture canvas thumbnail:', error)
      return null
    }
  }

  /**
   * Store a thumbnail for a workflow
   */
  const storeThumbnail = async (
    workflow: ComfyWorkflow,
    width: number = DEFAULT_THUMBNAIL_WIDTH,
    height: number = DEFAULT_THUMBNAIL_HEIGHT
  ) => {
    const thumbnail = await captureCanvasThumbnail(width, height)
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
    captureCanvasThumbnail,
    storeThumbnail,
    getThumbnail,
    clearThumbnail,
    clearAllThumbnails,
    workflowThumbnails
  }
}
