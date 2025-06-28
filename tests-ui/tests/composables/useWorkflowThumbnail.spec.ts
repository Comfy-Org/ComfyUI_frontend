import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowThumbnail } from '@/composables/useWorkflowThumbnail'
import { ComfyWorkflow } from '@/stores/workflowStore'

global.URL.createObjectURL = vi.fn(() => 'data:image/png;base64,test')
global.URL.revokeObjectURL = vi.fn()

const mockCanvas = document.createElement('canvas')
mockCanvas.width = 800
mockCanvas.height = 600

describe('useWorkflowThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const originalCreateElement = document.createElement
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return {
          getContext: vi.fn(() => {
            return {
              drawImage: vi.fn()
            } as unknown as CanvasRenderingContext2D
          }),
          toBlob: vi.fn((callback) => {
            callback(new Blob(['test'], { type: 'image/png' }))
          })
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement.call(document, tagName)
    })

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'graph-canvas') {
        return mockCanvas
      }
      return null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should capture canvas thumbnail', async () => {
    const { captureCanvasThumbnail } = useWorkflowThumbnail()
    const thumbnail = await captureCanvasThumbnail()

    expect(thumbnail).toBe('data:image/png;base64,test')
  })

  it('should store and retrieve thumbnails', async () => {
    const { storeThumbnail, getThumbnail } = useWorkflowThumbnail()

    const mockWorkflow = { key: 'test-workflow-key' } as ComfyWorkflow

    await storeThumbnail(mockWorkflow)

    const thumbnail = getThumbnail('test-workflow-key')
    expect(thumbnail).toBe('data:image/png;base64,test')
  })

  it('should clear thumbnail', async () => {
    const { storeThumbnail, getThumbnail, clearThumbnail } =
      useWorkflowThumbnail()

    const mockWorkflow = { key: 'test-workflow-key' } as ComfyWorkflow

    await storeThumbnail(mockWorkflow)

    expect(getThumbnail('test-workflow-key')).toBeDefined()

    clearThumbnail('test-workflow-key')

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'data:image/png;base64,test'
    )
    expect(getThumbnail('test-workflow-key')).toBeUndefined()
  })

  it('should clear all thumbnails', async () => {
    const { storeThumbnail, getThumbnail, clearAllThumbnails } =
      useWorkflowThumbnail()

    const mockWorkflow1 = { key: 'workflow-1' } as ComfyWorkflow
    const mockWorkflow2 = { key: 'workflow-2' } as ComfyWorkflow

    await storeThumbnail(mockWorkflow1)
    await storeThumbnail(mockWorkflow2)

    expect(getThumbnail('workflow-1')).toBeDefined()
    expect(getThumbnail('workflow-2')).toBeDefined()

    clearAllThumbnails()

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(getThumbnail('workflow-1')).toBeUndefined()
    expect(getThumbnail('workflow-2')).toBeUndefined()
  })

  it('should handle canvas capture failure', async () => {
    // Mock getElementById to return null to simulate missing canvas
    vi.mocked(document.getElementById).mockReturnValue(null)

    const { captureCanvasThumbnail } = useWorkflowThumbnail()
    const thumbnail = await captureCanvasThumbnail()

    expect(thumbnail).toBeNull()
  })
})
