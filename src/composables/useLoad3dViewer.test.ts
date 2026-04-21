import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useLoad3dViewer } from '@/composables/useLoad3dViewer'
import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useLoad3dService } from '@/services/load3dService'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/services/load3dService', () => ({
  useLoad3dService: vi.fn()
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
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

function createMockSceneManager(): Load3d['sceneManager'] {
  const mock: Partial<Load3d['sceneManager']> = {
    scene: {} as Load3d['sceneManager']['scene'],
    backgroundScene: {} as Load3d['sceneManager']['backgroundScene'],
    backgroundCamera: {} as Load3d['sceneManager']['backgroundCamera'],
    currentBackgroundColor: '#282828',
    gridHelper: { visible: true } as Load3d['sceneManager']['gridHelper'],
    getCurrentBackgroundInfo: vi.fn().mockReturnValue({
      type: 'color',
      value: '#282828'
    })
  }
  return mock as Load3d['sceneManager']
}

describe('useLoad3dViewer', () => {
  let mockLoad3d: Partial<Load3d>
  let mockSourceLoad3d: Partial<Load3d>
  let mockLoad3dService: ReturnType<typeof useLoad3dService>
  let mockToastStore: ReturnType<typeof useToastStore>
  let mockNode: LGraphNode

  beforeEach(() => {
    vi.clearAllMocks()

    mockNode = createMockLGraphNode({
      properties: {
        'Scene Config': {
          backgroundColor: '#282828',
          showGrid: true,
          backgroundImage: '',
          backgroundRenderMode: 'tiled'
        },
        'Camera Config': {
          cameraType: 'perspective',
          fov: 75
        },
        'Light Config': {
          intensity: 1
        },
        'Model Config': {
          upDirection: 'original',
          materialMode: 'original'
        },
        'Resource Folder': ''
      },
      graph: {
        setDirtyCanvas: vi.fn()
      } as Partial<LGraph> as LGraph,
      widgets: []
    })

    mockLoad3d = {
      setBackgroundColor: vi.fn(),
      toggleGrid: vi.fn(),
      toggleCamera: vi.fn(),
      setFOV: vi.fn(),
      setLightIntensity: vi.fn(),
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
      setUpDirection: vi.fn(),
      setMaterialMode: vi.fn(),
      exportModel: vi.fn().mockResolvedValue(undefined),
      handleResize: vi.fn(),
      updateStatusMouseOnViewer: vi.fn(),
      getCameraState: vi.fn().mockReturnValue({
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
        cameraType: 'perspective'
      }),
      forceRender: vi.fn(),
      remove: vi.fn(),
      setTargetSize: vi.fn(),
      loadModel: vi.fn().mockResolvedValue(undefined),
      setCameraState: vi.fn(),
      addEventListener: vi.fn(),
      hasAnimations: vi.fn().mockReturnValue(false),
      isSplatModel: vi.fn().mockReturnValue(false),
      isPlyModel: vi.fn().mockReturnValue(false),
      setGizmoEnabled: vi.fn(),
      setGizmoMode: vi.fn(),
      setBackgroundRenderMode: vi.fn(),
      getGizmoTransform: vi.fn().mockReturnValue({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      })
    }

    mockSourceLoad3d = {
      getCurrentCameraType: vi.fn().mockReturnValue('perspective'),
      getCameraState: vi.fn().mockReturnValue({
        position: { x: 1, y: 1, z: 1 },
        target: { x: 0, y: 0, z: 0 },
        zoom: 1,
        cameraType: 'perspective'
      }),
      sceneManager: createMockSceneManager(),
      lightingManager: {
        lights: [null, { intensity: 1 }]
      } as Load3d['lightingManager'],
      cameraManager: {
        perspectiveCamera: { fov: 75 }
      } as Load3d['cameraManager'],
      modelManager: {
        currentUpDirection: 'original',
        materialMode: 'original'
      } as Load3d['modelManager'],
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
      setBackgroundRenderMode: vi.fn(),
      forceRender: vi.fn()
    }

    vi.mocked(Load3d).mockImplementation(function () {
      Object.assign(this, mockLoad3d)
    })

    mockLoad3dService = {
      copyLoad3dState: vi.fn().mockResolvedValue(undefined),
      handleViewportRefresh: vi.fn(),
      getLoad3d: vi.fn().mockReturnValue(mockSourceLoad3d)
    } as Partial<ReturnType<typeof useLoad3dService>> as ReturnType<
      typeof useLoad3dService
    >
    vi.mocked(useLoad3dService).mockReturnValue(mockLoad3dService)

    mockToastStore = {
      addAlert: vi.fn()
    } as Partial<ReturnType<typeof useToastStore>> as ReturnType<
      typeof useToastStore
    >
    vi.mocked(useToastStore).mockReturnValue(mockToastStore)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize viewer with source Load3d state', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(Load3d).toHaveBeenCalledWith(containerRef, {
        width: undefined,
        height: undefined,
        getDimensions: undefined,
        isViewerMode: false
      })

      expect(mockLoad3dService.copyLoad3dState).toHaveBeenCalledWith(
        mockSourceLoad3d,
        mockLoad3d
      )

      expect(viewer.cameraType.value).toBe('perspective')
      expect(viewer.backgroundColor.value).toBe('#282828')
      expect(viewer.showGrid.value).toBe(true)
      expect(viewer.lightIntensity.value).toBe(1)
      expect(viewer.fov.value).toBe(75)
      expect(viewer.upDirection.value).toBe('original')
      expect(viewer.materialMode.value).toBe('original')
    })

    it('should handle background image during initialization', async () => {
      vi.mocked(
        mockSourceLoad3d.sceneManager!.getCurrentBackgroundInfo
      ).mockReturnValue({
        type: 'image',
        value: ''
      })
      ;(
        mockNode.properties!['Scene Config'] as Record<string, unknown>
      ).backgroundImage = 'test-image.jpg'

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(viewer.backgroundImage.value).toBe('test-image.jpg')
      expect(viewer.hasBackgroundImage.value).toBe(true)
    })

    it('should handle initialization errors', async () => {
      vi.mocked(Load3d).mockImplementationOnce(function () {
        throw new Error('Load3d creation failed')
      })

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToInitializeLoad3dViewer'
      )
    })
  })

  describe('error handling', () => {
    it('should handle watcher errors gracefully', async () => {
      vi.mocked(mockLoad3d.setBackgroundColor!).mockImplementationOnce(
        function () {
          throw new Error('Color update failed')
        }
      )

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.backgroundColor.value = '#ff0000'
      await nextTick()

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToUpdateBackgroundColor'
      )
    })
  })

  describe('exportModel', () => {
    it('should export model successfully', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      await viewer.exportModel('glb')

      expect(mockLoad3d.exportModel).toHaveBeenCalledWith('glb')
    })

    it('should handle export errors', async () => {
      vi.mocked(mockLoad3d.exportModel!).mockRejectedValueOnce(
        new Error('Export failed')
      )

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      await viewer.exportModel('glb')

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel'
      )
    })

    it('should not export when load3d is not initialized', async () => {
      const viewer = useLoad3dViewer(mockNode)

      await viewer.exportModel('glb')

      expect(mockLoad3d.exportModel).not.toHaveBeenCalled()
    })
  })

  describe('UI interaction methods', () => {
    it('should handle resize', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.handleResize()

      expect(mockLoad3d.handleResize).toHaveBeenCalled()
    })

    it('should handle mouse enter', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.handleMouseEnter()

      expect(mockLoad3d.updateStatusMouseOnViewer).toHaveBeenCalledWith(true)
    })

    it('should handle mouse leave', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.handleMouseLeave()

      expect(mockLoad3d.updateStatusMouseOnViewer).toHaveBeenCalledWith(false)
    })

    it('should sync hover state when mouseenter fires before init', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      viewer.handleMouseEnter()

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(mockLoad3d.updateStatusMouseOnViewer).toHaveBeenCalledWith(true)
    })
  })

  describe('restoreInitialState', () => {
    it('should restore all properties to initial values', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)
      ;(
        mockNode.properties!['Scene Config'] as Record<string, unknown>
      ).backgroundColor = '#ff0000'
      ;(
        mockNode.properties!['Scene Config'] as Record<string, unknown>
      ).showGrid = false

      viewer.restoreInitialState()

      expect(
        (mockNode.properties!['Scene Config'] as Record<string, unknown>)
          .backgroundColor
      ).toBe('#282828')
      expect(
        (mockNode.properties!['Scene Config'] as Record<string, unknown>)
          .showGrid
      ).toBe(true)
      expect(
        (mockNode.properties!['Camera Config'] as Record<string, unknown>)
          .cameraType
      ).toBe('perspective')
      expect(
        (mockNode.properties!['Camera Config'] as Record<string, unknown>).fov
      ).toBe(75)
      expect(
        (mockNode.properties!['Light Config'] as Record<string, unknown>)
          .intensity
      ).toBe(1)
    })
  })

  describe('applyChanges', () => {
    it('should apply all changes to source and node', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.backgroundColor.value = '#ff0000'
      viewer.showGrid.value = false

      const result = await viewer.applyChanges()

      expect(result).toBe(true)
      expect(
        (mockNode.properties!['Scene Config'] as Record<string, unknown>)
          .backgroundColor
      ).toBe('#ff0000')
      expect(
        (mockNode.properties!['Scene Config'] as Record<string, unknown>)
          .showGrid
      ).toBe(false)
      expect(mockLoad3dService.copyLoad3dState).toHaveBeenCalledWith(
        mockLoad3d,
        mockSourceLoad3d
      )
      expect(mockSourceLoad3d.forceRender).toHaveBeenCalled()
      expect(mockNode.graph!.setDirtyCanvas).toHaveBeenCalledWith(true, true)
    })

    it('should handle background image during apply', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.backgroundImage.value = 'new-bg.jpg'

      await viewer.applyChanges()

      expect(mockSourceLoad3d.setBackgroundImage).toHaveBeenCalledWith(
        'new-bg.jpg'
      )
    })

    it('should return false when no load3d instances', async () => {
      const viewer = useLoad3dViewer(mockNode)

      const result = await viewer.applyChanges()

      expect(result).toBe(false)
    })
  })

  describe('refreshViewport', () => {
    it('should refresh viewport', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.refreshViewport()

      expect(mockLoad3dService.handleViewportRefresh).toHaveBeenCalledWith(
        mockLoad3d
      )
    })
  })

  describe('handleBackgroundImageUpdate', () => {
    it('should upload and set background image', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValueOnce(
        'uploaded-image.jpg'
      )

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await viewer.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(viewer.backgroundImage.value).toBe('uploaded-image.jpg')
      expect(viewer.hasBackgroundImage.value).toBe(true)
    })

    it('should use resource folder for upload', async () => {
      mockNode.properties['Resource Folder'] = 'subfolder'
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValueOnce(
        'uploaded-image.jpg'
      )

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await viewer.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d/subfolder')
    })

    it('should clear background image when file is null', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.backgroundImage.value = 'existing.jpg'
      viewer.hasBackgroundImage.value = true

      await viewer.handleBackgroundImageUpdate(null)

      expect(viewer.backgroundImage.value).toBe('')
      expect(viewer.hasBackgroundImage.value).toBe(false)
    })

    it('should handle upload errors', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockRejectedValueOnce(
        new Error('Upload failed')
      )

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await viewer.handleBackgroundImageUpdate(file)

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToUploadBackgroundImage'
      )
    })

    it('should work in standalone mode without a node', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValueOnce(
        'uploaded-image.jpg'
      )
      const viewer = useLoad3dViewer()
      const containerRef = document.createElement('div')
      await viewer.initializeStandaloneViewer(containerRef, 'model.glb')

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await viewer.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(viewer.backgroundImage.value).toBe('uploaded-image.jpg')
    })
  })

  describe('cleanup', () => {
    it('should clean up resources', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.cleanup()

      expect(mockLoad3d.remove).toHaveBeenCalled()
    })

    it('should handle cleanup when not initialized', () => {
      const viewer = useLoad3dViewer(mockNode)

      expect(() => viewer.cleanup()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle missing container ref', async () => {
      const viewer = useLoad3dViewer(mockNode)

      await viewer.initializeViewer(null!, mockSourceLoad3d as Load3d)

      expect(Load3d).not.toHaveBeenCalled()
    })

    it('should handle orthographic camera', async () => {
      vi.mocked(mockSourceLoad3d.getCurrentCameraType!).mockReturnValue(
        'orthographic'
      )
      mockSourceLoad3d.cameraManager = {
        perspectiveCamera: { fov: 75 }
      } as Partial<Load3d['cameraManager']> as Load3d['cameraManager']
      delete (mockNode.properties!['Camera Config'] as Record<string, unknown>)
        .cameraType

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(viewer.cameraType.value).toBe('orthographic')
    })

    it('should handle missing lights', async () => {
      mockSourceLoad3d.lightingManager!.lights = []

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(viewer.lightIntensity.value).toBe(1) // Default value
    })
  })

  describe('standalone mode persistence', () => {
    it('should save and restore configuration in standalone mode', async () => {
      const viewer = useLoad3dViewer()
      const containerRef = document.createElement('div')
      const model1 = 'model1.glb'
      const model2 = 'model2.glb'

      await viewer.initializeStandaloneViewer(containerRef, model1)
      expect(viewer.isStandaloneMode.value).toBe(true)

      viewer.backgroundColor.value = '#ff0000'
      viewer.showGrid.value = false
      viewer.cameraType.value = 'orthographic'
      viewer.fov.value = 45
      viewer.lightIntensity.value = 2
      viewer.backgroundImage.value = 'test.jpg'
      viewer.backgroundRenderMode.value = 'tiled'
      viewer.upDirection.value = '+y'
      viewer.materialMode.value = 'wireframe'
      await nextTick()

      await viewer.initializeStandaloneViewer(containerRef, model2)
      expect(viewer.backgroundColor.value).toBe('#282828')
      expect(viewer.showGrid.value).toBe(true)
      expect(viewer.backgroundImage.value).toBe('')

      await viewer.initializeStandaloneViewer(containerRef, model1)
      expect(viewer.backgroundColor.value).toBe('#ff0000')
      expect(viewer.showGrid.value).toBe(false)
      expect(viewer.cameraType.value).toBe('orthographic')
      expect(viewer.fov.value).toBe(45)
      expect(viewer.lightIntensity.value).toBe(2)
      expect(viewer.backgroundImage.value).toBe('test.jpg')
      expect(viewer.hasBackgroundImage.value).toBe(true)
      expect(viewer.backgroundRenderMode.value).toBe('tiled')
      expect(viewer.upDirection.value).toBe('+y')
      expect(viewer.materialMode.value).toBe('wireframe')

      await viewer.initializeStandaloneViewer(containerRef, model2)
      expect(viewer.backgroundColor.value).toBe('#282828')
    })

    it('should save configuration during cleanup in standalone mode', async () => {
      const viewer = useLoad3dViewer()
      const containerRef = document.createElement('div')
      const modelUrl = 'model_cleanup.glb'

      await viewer.initializeStandaloneViewer(containerRef, modelUrl)
      viewer.backgroundColor.value = '#0000ff'
      await nextTick()

      viewer.cleanup()

      const newViewer = useLoad3dViewer()
      await newViewer.initializeStandaloneViewer(containerRef, modelUrl)
      expect(newViewer.backgroundColor.value).toBe('#0000ff')
    })
  })

  describe('gizmo controls', () => {
    it('should initialize gizmo state from node model config', async () => {
      ;(mockNode.properties!['Model Config'] as Record<string, unknown>).gizmo =
        {
          enabled: true,
          mode: 'rotate'
        }

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(viewer.gizmoEnabled.value).toBe(true)
      expect(viewer.gizmoMode.value).toBe('rotate')
    })

    it('should default gizmo to disabled translate when no config', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      expect(viewer.gizmoEnabled.value).toBe(false)
      expect(viewer.gizmoMode.value).toBe('translate')
    })

    it('should persist gizmo state in applyChanges', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.gizmoEnabled.value = true
      viewer.gizmoMode.value = 'rotate'

      await viewer.applyChanges()

      const modelConfig = mockNode.properties!['Model Config'] as Record<
        string,
        unknown
      >
      const gizmo = modelConfig.gizmo as Record<string, unknown>
      expect(gizmo.enabled).toBe(true)
      expect(gizmo.mode).toBe('rotate')
    })

    it('should save gizmo transform from load3d in applyChanges', async () => {
      vi.mocked(mockLoad3d.getGizmoTransform!).mockReturnValue({
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 },
        scale: { x: 2, y: 2, z: 2 }
      })

      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      await viewer.applyChanges()

      const modelConfig = mockNode.properties!['Model Config'] as Record<
        string,
        unknown
      >
      const gizmo = modelConfig.gizmo as {
        position: { x: number; y: number; z: number }
        rotation: { x: number; y: number; z: number }
        scale: { x: number; y: number; z: number }
      }
      expect(gizmo.position).toEqual({ x: 1, y: 2, z: 3 })
      expect(gizmo.rotation).toEqual({ x: 0.1, y: 0.2, z: 0.3 })
      expect(gizmo.scale).toEqual({ x: 2, y: 2, z: 2 })
    })

    it('should restore gizmo state in restoreInitialState', async () => {
      const viewer = useLoad3dViewer(mockNode)
      const containerRef = document.createElement('div')

      await viewer.initializeViewer(containerRef, mockSourceLoad3d as Load3d)

      viewer.gizmoEnabled.value = true
      viewer.gizmoMode.value = 'rotate'

      viewer.restoreInitialState()

      const modelConfig = mockNode.properties!['Model Config'] as Record<
        string,
        unknown
      >
      const gizmo = modelConfig.gizmo as Record<string, unknown>
      expect(gizmo.enabled).toBe(false)
      expect(gizmo.mode).toBe('translate')
    })

    it('should restore gizmo state from standalone config cache', async () => {
      const viewer = useLoad3dViewer()
      const containerRef = document.createElement('div')
      const model1 = 'gizmo_model1.glb'

      await viewer.initializeStandaloneViewer(containerRef, model1)
      viewer.gizmoEnabled.value = true
      viewer.gizmoMode.value = 'rotate'
      await nextTick()

      viewer.cleanup()

      const restoredViewer = useLoad3dViewer()
      await restoredViewer.initializeStandaloneViewer(containerRef, model1)
      expect(restoredViewer.gizmoEnabled.value).toBe(true)
      expect(restoredViewer.gizmoMode.value).toBe('rotate')
    })
  })
})
