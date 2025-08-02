import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyWorkflow } from '@/stores/workflowStore'

vi.mock('@/composables/useMinimap', () => ({
  useMinimap: vi.fn()
}))

const { useWorkflowThumbnail } = await import(
  '@/composables/useWorkflowThumbnail'
)
const { useMinimap } = await import('@/composables/useMinimap')

describe('useWorkflowThumbnail', () => {
  let mockMinimapInstance: any

  beforeEach(() => {
    vi.clearAllMocks()

    const blob = new Blob()

    global.URL.createObjectURL = vi.fn(() => 'data:image/png;base64,test')
    global.URL.revokeObjectURL = vi.fn()

    mockMinimapInstance = {
      renderMinimap: vi.fn(),
      canvasRef: {
        value: {
          toBlob: vi.fn((cb) => cb(blob))
        }
      },
      width: 250,
      height: 200
    }

    vi.mocked(useMinimap).mockReturnValue(mockMinimapInstance)
  })

  it('should capture minimap thumbnail', async () => {
    const { createMinimapPreview } = useWorkflowThumbnail()
    const thumbnail = await createMinimapPreview()

    expect(useMinimap).toHaveBeenCalledOnce()
    expect(mockMinimapInstance.renderMinimap).toHaveBeenCalledOnce()

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
})
