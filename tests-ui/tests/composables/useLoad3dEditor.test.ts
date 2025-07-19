import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useLoad3dEditor } from '@/composables/useLoad3dEditor'
import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { useLoad3dService } from '@/services/load3dService'
import { useToastStore } from '@/stores/toastStore'

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: vi.fn()
}))

vi.mock('@/stores/toastStore', () => ({
  useToastStore: vi.fn()
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    uploadFile: vi.fn()
  }
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key) => key)
}))

vi.mock('@/extensions/core/load3d/Load3d', () => ({
  default: vi.fn()
}))

describe('useLoad3dEditor', () => {
  let mockLoad3d: any
  let mockSourceLoad3d: any
  let mockLoad3dService: any
  let mockToastStore: any
  let mockNode: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockNode = {
      properties: {
        'Background Color': '#282828',
        'Show Grid': true,
        'Camera Type': 'perspective',
        FOV: 75,
        'Light Intensity': 1,
        'Camera Info': null,
        'Background Image': '',
        'Up Direction': 'original',
        'Material Mode': 'original',
        'Edge Threshold': 85
      },
      graph: {
        setDirtyCanvas: vi.fn()
      }
    } as any

    mockLoad3d = {
      setBackgroundColor: vi.fn(),
      toggleGrid: vi.fn(),
      toggleCamera: vi.fn(),
      setFOV: vi.fn(),
      setLightIntensity: vi.fn(),
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
      setUpDirection: vi.fn(),
      setMaterialMode: vi.fn(),
      setEdgeThreshold: vi.fn(),
      exportModel: vi.fn().mockResolvedValue(undefined),
      handleResize: vi.fn(),
      updateStatusMouseOnEditor: vi.fn(),
      getCameraState: vi.fn().mockReturnValue({
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
        cameraType: 'perspective'
      }),
      forceRender: vi.fn(),
      remove: vi.fn()
    }

    mockSourceLoad3d = {
      getCurrentCameraType: vi.fn().mockReturnValue('perspective'),
      getCameraState: vi.fn().mockReturnValue({
        position: { x: 1, y: 1, z: 1 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
        cameraType: 'perspective'
      }),
      sceneManager: {
        currentBackgroundColor: '#282828',
        gridHelper: { visible: true },
        getCurrentBackgroundInfo: vi.fn().mockReturnValue({
          type: 'color',
          value: '#282828'
        })
      },
      lightingManager: {
        lights: [null, { intensity: 1 }]
      },
      cameraManager: {
        perspectiveCamera: { fov: 75 }
      },
      modelManager: {
        currentUpDirection: 'original',
        materialMode: 'original'
      },
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
      forceRender: vi.fn()
    }

    vi.mocked(Load3d).mockImplementation(() => mockLoad3d)

    mockLoad3dService = {
      copyLoad3dState: vi.fn().mockResolvedValue(undefined),
      handleViewportRefresh: vi.fn(),
      getLoad3d: vi.fn().mockReturnValue(mockSourceLoad3d)
    }
    vi.mocked(useLoad3dService).mockReturnValue(mockLoad3dService)

    mockToastStore = {
      addAlert: vi.fn()
    }
    vi.mocked(useToastStore).mockReturnValue(mockToastStore)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)

      expect(editor.backgroundColor.value).toBe('')
      expect(editor.showGrid.value).toBe(true)
      expect(editor.cameraType.value).toBe('perspective')
      expect(editor.fov.value).toBe(75)
      expect(editor.lightIntensity.value).toBe(1)
      expect(editor.backgroundImage.value).toBe('')
      expect(editor.hasBackgroundImage.value).toBe(false)
      expect(editor.upDirection.value).toBe('original')
      expect(editor.materialMode.value).toBe('original')
      expect(editor.edgeThreshold.value).toBe(85)
    })

    it('should initialize editor with source Load3d state', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      expect(Load3d).toHaveBeenCalledWith(containerRef, { node: mockNode })

      expect(mockLoad3dService.copyLoad3dState).toHaveBeenCalledWith(
        mockSourceLoad3d,
        mockLoad3d
      )

      expect(editor.cameraType.value).toBe('perspective')
      expect(editor.backgroundColor.value).toBe('#282828')
      expect(editor.showGrid.value).toBe(true)
      expect(editor.lightIntensity.value).toBe(1)
      expect(editor.fov.value).toBe(75)
      expect(editor.upDirection.value).toBe('original')
      expect(editor.materialMode.value).toBe('original')
      expect(editor.edgeThreshold.value).toBe(85)
    })

    it('should handle background image during initialization', async () => {
      mockSourceLoad3d.sceneManager.getCurrentBackgroundInfo.mockReturnValue({
        type: 'image',
        value: ''
      })
      mockNode.properties['Background Image'] = 'test-image.jpg'

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      expect(editor.backgroundImage.value).toBe('test-image.jpg')
      expect(editor.hasBackgroundImage.value).toBe(true)
    })

    it('should handle initialization errors', async () => {
      vi.mocked(Load3d).mockImplementationOnce(() => {
        throw new Error('Load3d creation failed')
      })

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToInitializeLoad3dEditor'
      )
    })
  })

  describe('state watchers', () => {
    it('should update background color when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.backgroundColor.value = '#ff0000'
      await nextTick()

      expect(mockLoad3d.setBackgroundColor).toHaveBeenCalledWith('#ff0000')
    })

    it('should update grid visibility when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.showGrid.value = false
      await nextTick()

      expect(mockLoad3d.toggleGrid).toHaveBeenCalledWith(false)
    })

    it('should update camera type when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.cameraType.value = 'orthographic'
      await nextTick()

      expect(mockLoad3d.toggleCamera).toHaveBeenCalledWith('orthographic')
    })

    it('should update FOV when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.fov.value = 90
      await nextTick()

      expect(mockLoad3d.setFOV).toHaveBeenCalledWith(90)
    })

    it('should update light intensity when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.lightIntensity.value = 2
      await nextTick()

      expect(mockLoad3d.setLightIntensity).toHaveBeenCalledWith(2)
    })

    it('should update background image when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.backgroundImage.value = 'new-bg.jpg'
      await nextTick()

      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith('new-bg.jpg')
      expect(editor.hasBackgroundImage.value).toBe(true)
    })

    it('should update up direction when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.upDirection.value = '+y'
      await nextTick()

      expect(mockLoad3d.setUpDirection).toHaveBeenCalledWith('+y')
    })

    it('should update material mode when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.materialMode.value = 'wireframe'
      await nextTick()

      expect(mockLoad3d.setMaterialMode).toHaveBeenCalledWith('wireframe')
    })

    it('should update edge threshold when state changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.edgeThreshold.value = 90
      await nextTick()

      expect(mockLoad3d.setEdgeThreshold).toHaveBeenCalledWith(90)
    })

    it('should handle watcher errors gracefully', async () => {
      mockLoad3d.setBackgroundColor.mockImplementationOnce(() => {
        throw new Error('Color update failed')
      })

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.backgroundColor.value = '#ff0000'
      await nextTick()

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToUpdateBackgroundColor'
      )
    })
  })

  describe('exportModel', () => {
    it('should export model successfully', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      await editor.exportModel('glb')

      expect(mockLoad3d.exportModel).toHaveBeenCalledWith('glb')
    })

    it('should handle export errors', async () => {
      mockLoad3d.exportModel.mockRejectedValueOnce(new Error('Export failed'))

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      await editor.exportModel('glb')

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel'
      )
    })

    it('should not export when load3d is not initialized', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)

      await editor.exportModel('glb')

      expect(mockLoad3d.exportModel).not.toHaveBeenCalled()
    })
  })

  describe('UI interaction methods', () => {
    it('should handle resize', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.handleResize()

      expect(mockLoad3d.handleResize).toHaveBeenCalled()
    })

    it('should handle mouse enter', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.handleMouseEnter()

      expect(mockLoad3d.updateStatusMouseOnEditor).toHaveBeenCalledWith(true)
    })

    it('should handle mouse leave', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.handleMouseLeave()

      expect(mockLoad3d.updateStatusMouseOnEditor).toHaveBeenCalledWith(false)
    })
  })

  describe('restoreInitialState', () => {
    it('should restore all properties to initial values', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      mockNode.properties['Background Color'] = '#ff0000'
      mockNode.properties['Show Grid'] = false

      editor.restoreInitialState()

      expect(mockNode.properties['Background Color']).toBe('#282828')
      expect(mockNode.properties['Show Grid']).toBe(true)
      expect(mockNode.properties['Camera Type']).toBe('perspective')
      expect(mockNode.properties['FOV']).toBe(75)
      expect(mockNode.properties['Light Intensity']).toBe(1)
    })
  })

  describe('applyChanges', () => {
    it('should apply all changes to source and node', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.backgroundColor.value = '#ff0000'
      editor.showGrid.value = false

      const result = await editor.applyChanges()

      expect(result).toBe(true)
      expect(mockNode.properties['Background Color']).toBe('#ff0000')
      expect(mockNode.properties['Show Grid']).toBe(false)
      expect(mockLoad3dService.copyLoad3dState).toHaveBeenCalledWith(
        mockLoad3d,
        mockSourceLoad3d
      )
      expect(mockSourceLoad3d.forceRender).toHaveBeenCalled()
      expect(mockNode.graph.setDirtyCanvas).toHaveBeenCalledWith(true, true)
    })

    it('should handle background image during apply', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.backgroundImage.value = 'new-bg.jpg'

      await editor.applyChanges()

      expect(mockSourceLoad3d.setBackgroundImage).toHaveBeenCalledWith(
        'new-bg.jpg'
      )
    })

    it('should return false when no load3d instances', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)

      const result = await editor.applyChanges()

      expect(result).toBe(false)
    })
  })

  describe('refreshViewport', () => {
    it('should refresh viewport', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.refreshViewport()

      expect(mockLoad3dService.handleViewportRefresh).toHaveBeenCalledWith(
        mockLoad3d
      )
    })
  })

  describe('handleBackgroundImageUpdate', () => {
    it('should upload and set background image', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('uploaded-image.jpg')

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await editor.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(editor.backgroundImage.value).toBe('uploaded-image.jpg')
      expect(editor.hasBackgroundImage.value).toBe(true)
    })

    it('should use resource folder for upload', async () => {
      mockNode.properties['Resource Folder'] = 'subfolder'
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('uploaded-image.jpg')

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await editor.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d/subfolder')
    })

    it('should clear background image when file is null', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.backgroundImage.value = 'existing.jpg'
      editor.hasBackgroundImage.value = true

      await editor.handleBackgroundImageUpdate(null)

      expect(editor.backgroundImage.value).toBe('')
      expect(editor.hasBackgroundImage.value).toBe(false)
    })

    it('should handle upload errors', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockRejectedValueOnce(
        new Error('Upload failed')
      )

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await editor.handleBackgroundImageUpdate(file)

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToUploadBackgroundImage'
      )
    })
  })

  describe('cleanup', () => {
    it('should clean up resources', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      editor.cleanup()

      expect(mockLoad3d.remove).toHaveBeenCalled()
    })

    it('should handle cleanup when not initialized', () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)

      expect(() => editor.cleanup()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle missing container ref', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)

      await editor.initializeEditor(null as any, mockSourceLoad3d)

      expect(Load3d).not.toHaveBeenCalled()
    })

    it('should handle orthographic camera', async () => {
      mockSourceLoad3d.getCurrentCameraType.mockReturnValue('orthographic')
      mockSourceLoad3d.cameraManager = {} // No perspective camera

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      expect(editor.cameraType.value).toBe('orthographic')
    })

    it('should handle missing lights', async () => {
      mockSourceLoad3d.lightingManager.lights = []

      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)
      const containerRef = document.createElement('div')

      await editor.initializeEditor(containerRef, mockSourceLoad3d)

      expect(editor.lightIntensity.value).toBe(1) // Default value
    })

    it('should handle node ref changes', async () => {
      const nodeRef = ref(mockNode)
      const editor = useLoad3dEditor(nodeRef)

      const newNode = { ...mockNode, properties: { ...mockNode.properties } }
      nodeRef.value = newNode

      editor.restoreInitialState()

      expect(newNode.properties['Background Color']).toBe('#282828')
    })
  })
})
