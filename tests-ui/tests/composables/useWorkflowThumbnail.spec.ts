import { describe, expect, it } from 'vitest'

import { useWorkflowThumbnail } from '@/composables/useWorkflowThumbnail'
import { ComfyWorkflow } from '@/stores/workflowStore'

describe('useWorkflowThumbnail', () => {
  it('should capture canvas thumbnail', async () => {
    const { captureCanvasThumbnail } = useWorkflowThumbnail()
    const thumbnail = await captureCanvasThumbnail()

    expect(thumbnail).toBe('data:image/png;base64,test')
  })

  it('should store and retrieve thumbnails', async () => {
    const { storeThumbnail, getThumbnail } = useWorkflowThumbnail()

    const mockWorkflow = { key: 'test-workflow-key' } as ComfyWorkflow

    storeThumbnail(mockWorkflow)

    const thumbnail = getThumbnail('test-workflow-key')
    expect(thumbnail).toBe('data:image/png;base64,test')
  })

  it('should clear thumbnail', async () => {
    const { storeThumbnail, getThumbnail, clearThumbnail } =
      useWorkflowThumbnail()

    const mockWorkflow = { key: 'test-workflow-key' } as ComfyWorkflow

    storeThumbnail(mockWorkflow)
    expect(getThumbnail('test-workflow-key')).toBeDefined()

    clearThumbnail('test-workflow-key')
    expect(getThumbnail('test-workflow-key')).toBeUndefined()
  })

  it('should clear all thumbnails', async () => {
    const { storeThumbnail, getThumbnail, clearAllThumbnails } =
      useWorkflowThumbnail()

    const mockWorkflow1 = { key: 'workflow-1' } as ComfyWorkflow
    const mockWorkflow2 = { key: 'workflow-2' } as ComfyWorkflow

    storeThumbnail(mockWorkflow1)
    storeThumbnail(mockWorkflow2)

    expect(getThumbnail('workflow-1')).toBeDefined()
    expect(getThumbnail('workflow-2')).toBeDefined()

    clearAllThumbnails()

    expect(getThumbnail('workflow-1')).toBeUndefined()
    expect(getThumbnail('workflow-2')).toBeUndefined()
  })
})
