import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useLoad3dDrag } from '@/composables/useLoad3dDrag'
import { useToastStore } from '@/platform/updates/common/toastStore'

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn()
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key) => key)
}))

function createMockDragEvent(
  type: string,
  options: { hasFiles?: boolean; files?: File[] } = {}
): DragEvent {
  const files = options.files || []
  const types = options.hasFiles ? ['Files'] : []

  const dataTransfer = {
    types,
    files,
    dropEffect: 'none' as DataTransfer['dropEffect']
  }

  const event = {
    type,
    dataTransfer
  } as unknown as DragEvent

  return event
}

describe('useLoad3dDrag', () => {
  let mockToastStore: any
  let mockOnModelDrop: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockToastStore = {
      addAlert: vi.fn()
    }
    vi.mocked(useToastStore).mockReturnValue(mockToastStore)

    mockOnModelDrop = vi.fn()
  })

  it('should initialize with default state', () => {
    const { isDragging, dragMessage } = useLoad3dDrag({
      onModelDrop: mockOnModelDrop
    })

    expect(isDragging.value).toBe(false)
    expect(dragMessage.value).toBe('')
  })

  describe('handleDragOver', () => {
    it('should set isDragging to true when files are being dragged', () => {
      const { isDragging, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      const event = createMockDragEvent('dragover', { hasFiles: true })

      handleDragOver(event)

      expect(isDragging.value).toBe(true)
      expect(event.dataTransfer!.dropEffect).toBe('copy')
    })

    it('should not set isDragging when disabled', () => {
      const disabled = ref(true)
      const { isDragging, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop,
        disabled
      })

      const event = createMockDragEvent('dragover', { hasFiles: true })

      handleDragOver(event)

      expect(isDragging.value).toBe(false)
    })

    it('should not set isDragging when no files are being dragged', () => {
      const { isDragging, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      const event = createMockDragEvent('dragover', { hasFiles: false })

      handleDragOver(event)

      expect(isDragging.value).toBe(false)
    })
  })

  describe('handleDragLeave', () => {
    it('should reset isDragging to false', () => {
      const { isDragging, handleDragLeave, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      // First set isDragging to true
      const dragOverEvent = createMockDragEvent('dragover', { hasFiles: true })
      handleDragOver(dragOverEvent)
      expect(isDragging.value).toBe(true)

      // Then test dragleave
      handleDragLeave()
      expect(isDragging.value).toBe(false)
    })
  })

  describe('handleDrop', () => {
    it('should call onModelDrop with valid model file', async () => {
      const { handleDrop } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      const modelFile = new File([], 'model.glb', { type: 'model/gltf-binary' })
      const event = createMockDragEvent('drop', {
        hasFiles: true,
        files: [modelFile]
      })

      await handleDrop(event)

      expect(mockOnModelDrop).toHaveBeenCalledWith(modelFile)
    })

    it('should show error toast for unsupported file types', async () => {
      const { handleDrop } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      const invalidFile = new File([], 'image.png', { type: 'image/png' })
      const event = createMockDragEvent('drop', {
        hasFiles: true,
        files: [invalidFile]
      })

      await handleDrop(event)

      expect(mockOnModelDrop).not.toHaveBeenCalled()
      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'load3d.unsupportedFileType'
      )
    })

    it('should not call onModelDrop when disabled', async () => {
      const disabled = ref(true)
      const { handleDrop } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop,
        disabled
      })

      const modelFile = new File([], 'model.glb', { type: 'model/gltf-binary' })
      const event = createMockDragEvent('drop', {
        hasFiles: true,
        files: [modelFile]
      })

      await handleDrop(event)

      expect(mockOnModelDrop).not.toHaveBeenCalled()
    })

    it('should reset isDragging after drop', async () => {
      const { isDragging, handleDrop, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      // Set isDragging to true
      const dragOverEvent = createMockDragEvent('dragover', { hasFiles: true })
      handleDragOver(dragOverEvent)
      expect(isDragging.value).toBe(true)

      // Drop the file
      const modelFile = new File([], 'model.glb', { type: 'model/gltf-binary' })
      const dropEvent = createMockDragEvent('drop', {
        hasFiles: true,
        files: [modelFile]
      })

      await handleDrop(dropEvent)

      expect(isDragging.value).toBe(false)
    })

    it('should support all valid 3D model extensions', async () => {
      const { handleDrop } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      const extensions = ['.gltf', '.glb', '.obj', '.fbx', '.stl']

      for (const ext of extensions) {
        mockOnModelDrop.mockClear()

        const modelFile = new File([], `model${ext}`)
        const event = createMockDragEvent('drop', {
          hasFiles: true,
          files: [modelFile]
        })

        await handleDrop(event)

        expect(mockOnModelDrop).toHaveBeenCalledWith(modelFile)
      }
    })

    it('should handle empty file list', async () => {
      const { handleDrop } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop
      })

      const event = createMockDragEvent('drop', {
        hasFiles: true,
        files: []
      })

      await handleDrop(event)

      expect(mockOnModelDrop).not.toHaveBeenCalled()
      expect(mockToastStore.addAlert).not.toHaveBeenCalled()
    })
  })

  describe('disabled option', () => {
    it('should work with reactive disabled ref', () => {
      const disabled = ref(false)
      const { isDragging, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop,
        disabled
      })

      const event = createMockDragEvent('dragover', { hasFiles: true })

      // Should work when disabled is false
      handleDragOver(event)
      expect(isDragging.value).toBe(true)

      // Reset
      isDragging.value = false

      // Should not work when disabled is true
      disabled.value = true
      handleDragOver(event)
      expect(isDragging.value).toBe(false)
    })

    it('should work with plain boolean', () => {
      const { isDragging, handleDragOver } = useLoad3dDrag({
        onModelDrop: mockOnModelDrop,
        disabled: false
      })

      const event = createMockDragEvent('dragover', { hasFiles: true })
      handleDragOver(event)
      expect(isDragging.value).toBe(true)
    })
  })
})
