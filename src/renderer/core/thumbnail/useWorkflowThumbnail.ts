import { ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

import { createGraphThumbnail } from './graphThumbnailRenderer'

// Store thumbnails for each workflow
const workflowThumbnails = ref<Map<string, string>>(new Map())

export const useWorkflowThumbnail = () => {
  /**
   * Capture a thumbnail of the given graph
   */
  const createMinimapPreview = (
    graph: LGraph | null | undefined
  ): Promise<string | null> => {
    try {
      const thumbnailDataUrl = createGraphThumbnail(graph)
      return Promise.resolve(thumbnailDataUrl)
    } catch (error) {
      console.error('Failed to capture canvas thumbnail:', error)
      return Promise.resolve(null)
    }
  }

  /**
   * Store a thumbnail of the given graph for a workflow
   */
  const storeThumbnail = async (
    workflow: ComfyWorkflow,
    graph: LGraph | null | undefined
  ) => {
    const thumbnail = await createMinimapPreview(graph)
    if (thumbnail) {
      // Clean up existing thumbnail if it exists
      const existingThumbnail = workflowThumbnails.value.get(workflow.key)
      if (existingThumbnail) {
        URL.revokeObjectURL(existingThumbnail)
      }
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

  /**
   * Move a thumbnail from one workflow key to another (useful for workflow renaming)
   */
  const moveWorkflowThumbnail = (oldKey: string, newKey: string) => {
    // Don't do anything if moving to the same key
    if (oldKey === newKey) return

    const thumbnail = workflowThumbnails.value.get(oldKey)
    if (thumbnail) {
      workflowThumbnails.value.set(newKey, thumbnail)
      workflowThumbnails.value.delete(oldKey)
    }
  }

  return {
    createMinimapPreview,
    storeThumbnail,
    getThumbnail,
    clearThumbnail,
    clearAllThumbnails,
    moveWorkflowThumbnail,
    workflowThumbnails
  }
}
