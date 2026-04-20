import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'

import { nodeToLoad3dMap, useLoad3d } from '@/composables/useLoad3d'
import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type { Size } from '@/lib/litegraph/src/interfaces'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IWidget } from '@/lib/litegraph/src/types/widgets'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import {
  createMockCanvasPointerEvent,
  createMockLGraphNode
} from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/extensions/core/load3d/Load3d', () => ({
  default: vi.fn()
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    splitFilePath: vi.fn(),
    getResourceURL: vi.fn(),
    uploadFile: vi.fn(),
    mapSceneLightIntensityToHdri: vi.fn(
      (scene: number, min: number, max: number) => {
        const span = max - min
        const t = span > 0 ? (scene - min) / span : 0
        const clampedT = Math.min(1, Math.max(0, t))
        const mapped = clampedT * 5
        const minHdri = 0.25
        return Math.min(5, Math.max(minHdri, mapped))
      }
    )
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getServerFeature: vi.fn(() => false)
  }
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key) => key)
}))

describe('useLoad3d', () => {
  let mockLoad3d: Partial<Load3d>
  let mockNode: LGraphNode
  let mockToastStore: ReturnType<typeof useToastStore>

  beforeEach(() => {
    vi.clearAllMocks()
    nodeToLoad3dMap.clear()

    mockNode = createMockLGraphNode({
      properties: {
        'Scene Config': {
          showGrid: true,
          backgroundColor: '#000000',
          backgroundImage: '',
          backgroundRenderMode: 'tiled'
        },
        'Model Config': {
          upDirection: 'original',
          materialMode: 'original',
          showSkeleton: false
        },
        'Camera Config': {
          cameraType: 'perspective',
          fov: 75,
          state: null
        },
        'Light Config': {
          intensity: 5,
          hdri: {
            enabled: false,
            hdriPath: '',
            showAsBackground: false,
            intensity: 1
          }
        },
        'Resource Folder': ''
      },
      widgets: [
        { name: 'width', value: 512, type: 'number' } as IWidget,
        { name: 'height', value: 512, type: 'number' } as IWidget
      ],
      graph: {
        setDirtyCanvas: vi.fn()
      } as Partial<LGraph> as LGraph,
      flags: {},
      onMouseEnter: undefined,
      onMouseLeave: undefined,
      onResize: undefined,
      onDrawBackground: undefined
    })

    const mockCanvas = document.createElement('canvas')
    mockCanvas.hidden = false

    mockLoad3d = {
      toggleGrid: vi.fn(),
      setBackgroundColor: vi.fn(),
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
      setBackgroundRenderMode: vi.fn(),
      setUpDirection: vi.fn(),
      setMaterialMode: vi.fn(),
      toggleCamera: vi.fn(),
      setFOV: vi.fn(),
      setLightIntensity: vi.fn(),
      setCameraState: vi.fn(),
      loadModel: vi.fn().mockResolvedValue(undefined),
      refreshViewport: vi.fn(),
      updateStatusMouseOnNode: vi.fn(),
      updateStatusMouseOnScene: vi.fn(),
      handleResize: vi.fn(),
      toggleAnimation: vi.fn(),
      setAnimationSpeed: vi.fn(),
      updateSelectedAnimation: vi.fn(),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn(),
      getRecordingDuration: vi.fn().mockReturnValue(10),
      exportRecording: vi.fn(),
      clearRecording: vi.fn(),
      exportModel: vi.fn().mockResolvedValue(undefined),
      isSplatModel: vi.fn().mockReturnValue(false),
      isPlyModel: vi.fn().mockReturnValue(false),
      hasSkeleton: vi.fn().mockReturnValue(false),
      setShowSkeleton: vi.fn(),
      loadHDRI: vi.fn().mockResolvedValue(undefined),
      setHDRIEnabled: vi.fn(),
      setHDRIAsBackground: vi.fn(),
      setHDRIIntensity: vi.fn(),
      clearHDRI: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
      setGizmoEnabled: vi.fn(),
      setGizmoMode: vi.fn(),
      resetGizmoTransform: vi.fn(),
      applyGizmoTransform: vi.fn(),
      fitToViewer: vi.fn(),
      setAnimationTime: vi.fn(),
      renderer: {
        domElement: mockCanvas
      } as Partial<Load3d['renderer']> as Load3d['renderer']
    }

    vi.mocked(Load3d).mockImplementation(function (this: Load3d) {
      Object.assign(this, mockLoad3d)
      return this
    })

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
    it('should initialize Load3d with container and node', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(Load3d).toHaveBeenCalledWith(
        containerRef,
        expect.objectContaining({
          width: 512,
          height: 512,
          getDimensions: expect.any(Function),
          onContextMenu: expect.any(Function)
        })
      )
      expect(nodeToLoad3dMap.has(mockNode)).toBe(true)
    })

    it('should restore configurations from node', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)
      await nextTick()

      expect(mockLoad3d.toggleGrid).toHaveBeenCalledWith(true)
      expect(mockLoad3d.setBackgroundColor).toHaveBeenCalledWith('#000000')
      expect(mockLoad3d.setBackgroundRenderMode).toHaveBeenCalledWith('tiled')
      expect(mockLoad3d.toggleCamera).toHaveBeenCalledWith('perspective')
      expect(mockLoad3d.setFOV).toHaveBeenCalledWith(75)
      expect(mockLoad3d.setLightIntensity).toHaveBeenCalledWith(5)
    })

    it('should set up node event handlers', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockNode.onMouseEnter).toBeDefined()
      expect(mockNode.onMouseLeave).toBeDefined()
      expect(mockNode.onResize).toBeDefined()
      expect(mockNode.onDrawBackground).toBeDefined()

      // Test the handlers
      mockNode.onMouseEnter?.(createMockCanvasPointerEvent(0, 0))
      expect(mockLoad3d.refreshViewport).toHaveBeenCalled()
      expect(mockLoad3d.updateStatusMouseOnNode).toHaveBeenCalledWith(true)

      mockNode.onMouseLeave?.(createMockCanvasPointerEvent(0, 0))
      expect(mockLoad3d.updateStatusMouseOnNode).toHaveBeenCalledWith(false)

      mockNode.onResize?.([512, 512] as Size)
      expect(mockLoad3d.handleResize).toHaveBeenCalled()
    })

    it('should handle collapsed state', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      mockNode.flags.collapsed = true
      mockNode.onDrawBackground?.({} as CanvasRenderingContext2D)

      expect(mockLoad3d.renderer!.domElement.hidden).toBe(true)
    })

    it('should initialize without loading model (model loading is handled by Load3DConfiguration)', async () => {
      mockNode.widgets!.push({
        name: 'model_file',
        value: 'test.glb',
        type: 'text'
      } as IWidget)

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockLoad3d.loadModel).not.toHaveBeenCalled()
      expect(nodeToLoad3dMap.has(mockNode)).toBe(true)
    })

    it('should restore camera config from node properties', async () => {
      ;(
        mockNode.properties!['Camera Config'] as Record<string, unknown>
      ).state = {
        position: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 }
      }

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)
      await nextTick()

      expect(composable.cameraConfig.value.state).toEqual({
        position: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 }
      })
    })

    it('should set preview mode when no width/height widgets', async () => {
      mockNode.widgets = []

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(composable.isPreview.value).toBe(true)
    })

    it('should handle initialization errors', async () => {
      vi.mocked(Load3d).mockImplementationOnce(function () {
        throw new Error('Load3d creation failed')
      })

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToInitializeLoad3d'
      )
    })

    it('should handle missing container or node', async () => {
      const composable = useLoad3d(mockNode)

      await composable.initializeLoad3d(null!)

      expect(Load3d).not.toHaveBeenCalled()
    })

    it('should accept ref as parameter', () => {
      const nodeRef = shallowRef<LGraphNode | null>(mockNode)
      const composable = useLoad3d(nodeRef)

      expect(composable.sceneConfig.value.backgroundColor).toBe('#000000')
    })
  })

  describe('waitForLoad3d', () => {
    it('should execute callback immediately if Load3d exists', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      const callback = vi.fn()
      composable.waitForLoad3d(callback)

      expect(callback).toHaveBeenCalledWith(mockLoad3d)
    })

    it('should queue callback if Load3d does not exist', () => {
      const composable = useLoad3d(mockNode)
      const callback = vi.fn()

      composable.waitForLoad3d(callback)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should execute queued callbacks after initialization', async () => {
      const composable = useLoad3d(mockNode)
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      composable.waitForLoad3d(callback1)
      composable.waitForLoad3d(callback2)

      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      expect(callback1).toHaveBeenCalledWith(mockLoad3d)
      expect(callback2).toHaveBeenCalledWith(mockLoad3d)
    })
  })

  describe('configuration watchers', () => {
    it('should update scene config when values change', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      vi.mocked(mockLoad3d.toggleGrid!).mockClear()
      vi.mocked(mockLoad3d.setBackgroundColor!).mockClear()
      vi.mocked(mockLoad3d.setBackgroundImage!).mockClear()

      composable.sceneConfig.value = {
        showGrid: false,
        backgroundColor: '#ffffff',
        backgroundImage: 'test.jpg',
        backgroundRenderMode: 'panorama'
      }
      await nextTick()

      expect(mockLoad3d.toggleGrid).toHaveBeenCalledWith(false)
      expect(mockLoad3d.setBackgroundColor).toHaveBeenCalledWith('#ffffff')
      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith('test.jpg')
      expect(mockLoad3d.setBackgroundRenderMode).toHaveBeenCalledWith(
        'panorama'
      )
      expect(mockNode.properties['Scene Config']).toEqual({
        showGrid: false,
        backgroundColor: '#ffffff',
        backgroundImage: 'test.jpg',
        backgroundRenderMode: 'panorama'
      })
    })

    it('should update model config when values change', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)
      await nextTick()

      vi.mocked(mockLoad3d.setUpDirection!).mockClear()
      vi.mocked(mockLoad3d.setMaterialMode!).mockClear()

      composable.modelConfig.value.upDirection = '+y'
      composable.modelConfig.value.materialMode = 'wireframe'
      await nextTick()

      expect(mockLoad3d.setUpDirection).toHaveBeenCalledWith('+y')
      expect(mockLoad3d.setMaterialMode).toHaveBeenCalledWith('wireframe')
      const savedModelConfig = mockNode.properties['Model Config'] as Record<
        string,
        unknown
      >
      expect(savedModelConfig.upDirection).toBe('+y')
      expect(savedModelConfig.materialMode).toBe('wireframe')
      expect(savedModelConfig.showSkeleton).toBe(false)
    })

    it('should update camera config when values change', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)
      await nextTick()

      vi.mocked(mockLoad3d.toggleCamera!).mockClear()
      vi.mocked(mockLoad3d.setFOV!).mockClear()

      composable.cameraConfig.value.cameraType = 'orthographic'
      composable.cameraConfig.value.fov = 90
      await nextTick()

      expect(mockLoad3d.toggleCamera).toHaveBeenCalledWith('orthographic')
      expect(mockLoad3d.setFOV).toHaveBeenCalledWith(90)
      expect(mockNode.properties['Camera Config']).toEqual({
        cameraType: 'orthographic',
        fov: 90,
        state: null
      })
    })

    it('should update light config when values change', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)
      await nextTick()

      vi.mocked(mockLoad3d.setLightIntensity!).mockClear()

      composable.lightConfig.value.intensity = 10
      await nextTick()

      expect(mockLoad3d.setLightIntensity).toHaveBeenCalledWith(10)
      expect(mockNode.properties['Light Config']).toMatchObject({
        intensity: 10
      })
    })
  })

  describe('animation controls', () => {
    it('should toggle animation playback', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.playing.value = true
      await nextTick()

      expect(mockLoad3d.toggleAnimation).toHaveBeenCalledWith(true)

      composable.playing.value = false
      await nextTick()

      expect(mockLoad3d.toggleAnimation).toHaveBeenCalledWith(false)
    })

    it('should update animation speed', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.selectedSpeed.value = 2
      await nextTick()

      expect(mockLoad3d.setAnimationSpeed).toHaveBeenCalledWith(2)
    })

    it('should update selected animation', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.selectedAnimation.value = 1
      await nextTick()

      expect(mockLoad3d.updateSelectedAnimation).toHaveBeenCalledWith(1)
    })
  })

  describe('recording controls', () => {
    it('should start recording', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      await composable.handleStartRecording()

      expect(mockLoad3d.startRecording).toHaveBeenCalled()
      expect(composable.isRecording.value).toBe(true)
    })

    it('should stop recording', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleStopRecording()

      expect(mockLoad3d.stopRecording).toHaveBeenCalled()
      expect(composable.isRecording.value).toBe(false)
      expect(composable.recordingDuration.value).toBe(10)
      expect(composable.hasRecording.value).toBe(true)
    })

    it('should export recording with timestamp', async () => {
      const dateSpy = vi
        .spyOn(Date.prototype, 'toISOString')
        .mockReturnValue('2024-01-01T12:00:00.000Z')

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleExportRecording()

      expect(mockLoad3d.exportRecording).toHaveBeenCalledWith(
        '2024-01-01T12-00-00-000Z-scene-recording.mp4'
      )

      dateSpy.mockRestore()
    })

    it('should clear recording', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.hasRecording.value = true
      composable.recordingDuration.value = 10

      composable.handleClearRecording()

      expect(mockLoad3d.clearRecording).toHaveBeenCalled()
      expect(composable.hasRecording.value).toBe(false)
      expect(composable.recordingDuration.value).toBe(0)
    })
  })

  describe('background image handling', () => {
    it('should upload and set background image', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('uploaded-image.jpg')

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await composable.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(composable.sceneConfig.value.backgroundImage).toBe(
        'uploaded-image.jpg'
      )
      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith(
        'uploaded-image.jpg'
      )
    })

    it('should use resource folder for upload', async () => {
      mockNode.properties!['Resource Folder'] = 'subfolder'
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('uploaded-image.jpg')

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      await composable.handleBackgroundImageUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d/subfolder')
    })

    it('should clear background image when file is null', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.sceneConfig.value.backgroundImage = 'existing.jpg'

      await composable.handleBackgroundImageUpdate(null)

      expect(composable.sceneConfig.value.backgroundImage).toBe('')
      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith('')
    })
  })

  describe('model export', () => {
    it('should export model successfully', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      await composable.handleExportModel('glb')

      expect(mockLoad3d.exportModel).toHaveBeenCalledWith('glb')
    })

    it('should show alert when no Load3d instance', async () => {
      const composable = useLoad3d(mockNode)

      await composable.handleExportModel('glb')

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.no3dSceneToExport'
      )
    })

    it('should handle export errors', async () => {
      vi.mocked(mockLoad3d.exportModel!).mockRejectedValueOnce(
        new Error('Export failed')
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      await composable.handleExportModel('glb')

      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.failedToExportModel'
      )
    })
  })

  describe('mouse interactions', () => {
    it('should handle mouse enter on scene', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleMouseEnter()

      expect(mockLoad3d.updateStatusMouseOnScene).toHaveBeenCalledWith(true)
    })

    it('should handle mouse leave on scene', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleMouseLeave()

      expect(mockLoad3d.updateStatusMouseOnScene).toHaveBeenCalledWith(false)
    })
  })

  describe('event handling', () => {
    it('should add event listeners on initialization', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      const expectedEvents = [
        'materialModeChange',
        'backgroundColorChange',
        'backgroundRenderModeChange',
        'lightIntensityChange',
        'fovChange',
        'cameraTypeChange',
        'showGridChange',
        'upDirectionChange',
        'backgroundImageChange',
        'backgroundImageLoadingStart',
        'backgroundImageLoadingEnd',
        'modelLoadingStart',
        'modelLoadingEnd',
        'skeletonVisibilityChange',
        'exportLoadingStart',
        'exportLoadingEnd',
        'recordingStatusChange',
        'animationListChange',
        'animationProgressChange',
        'cameraChanged'
      ]

      expectedEvents.forEach((event) => {
        expect(mockLoad3d.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        )
      })
    })

    it('should handle materialModeChange event', async () => {
      let materialModeHandler: ((mode: string) => void) | undefined

      vi.mocked(mockLoad3d.addEventListener!).mockImplementation(
        (event: string, handler: unknown) => {
          if (event === 'materialModeChange') {
            materialModeHandler = handler as (mode: string) => void
          }
        }
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      materialModeHandler?.('wireframe')

      expect(composable.modelConfig.value.materialMode).toBe('wireframe')
    })

    it('should handle loading events', async () => {
      let modelLoadingStartHandler: (() => void) | undefined
      let modelLoadingEndHandler: (() => void) | undefined

      vi.mocked(mockLoad3d.addEventListener!).mockImplementation(
        (event: string, handler: unknown) => {
          if (event === 'modelLoadingStart') {
            modelLoadingStartHandler = handler as () => void
          } else if (event === 'modelLoadingEnd') {
            modelLoadingEndHandler = handler as () => void
          }
        }
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      modelLoadingStartHandler?.()
      expect(composable.loading.value).toBe(true)
      expect(composable.loadingMessage.value).toBe('load3d.loadingModel')

      modelLoadingEndHandler?.()
      expect(composable.loading.value).toBe(false)
      expect(composable.loadingMessage.value).toBe('')
    })

    it('should handle recordingStatusChange event', async () => {
      let recordingStatusHandler: ((status: boolean) => void) | undefined

      vi.mocked(mockLoad3d.addEventListener!).mockImplementation(
        (event: string, handler: unknown) => {
          if (event === 'recordingStatusChange') {
            recordingStatusHandler = handler as (status: boolean) => void
          }
        }
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      recordingStatusHandler?.(false)

      expect(composable.isRecording.value).toBe(false)
      expect(composable.recordingDuration.value).toBe(10)
      expect(composable.hasRecording.value).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners and clean up resources', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.cleanup()

      expect(mockLoad3d.removeEventListener).toHaveBeenCalled()
      expect(mockLoad3d.remove).toHaveBeenCalled()
      expect(nodeToLoad3dMap.has(mockNode)).toBe(false)
    })

    it('should handle cleanup when not initialized', () => {
      const composable = useLoad3d(mockNode)

      expect(() => composable.cleanup()).not.toThrow()
    })
  })

  describe('handleModelDrop', () => {
    it('should upload file, construct URL, and load model', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('uploaded/model.glb')
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue([
        'uploaded',
        'model.glb'
      ])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/api/view/uploaded/model.glb'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/api/view/uploaded/model.glb'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      const file = new File([''], 'model.glb', {
        type: 'model/gltf-binary'
      })
      await composable.handleModelDrop(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(mockLoad3d.loadModel).toHaveBeenCalledWith(
        'http://localhost/api/view/uploaded/model.glb'
      )
    })

    it('should use resource folder for upload subfolder', async () => {
      mockNode.properties['Resource Folder'] = 'subfolder'
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('uploaded/model.glb')
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue([
        'uploaded',
        'model.glb'
      ])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/api/view/uploaded/model.glb'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/api/view/uploaded/model.glb'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      const file = new File([''], 'model.glb', {
        type: 'model/gltf-binary'
      })
      await composable.handleModelDrop(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d/subfolder')
    })

    it('should not load model when load3d is not initialized', async () => {
      const composable = useLoad3d(mockNode)

      const file = new File([''], 'model.glb', {
        type: 'model/gltf-binary'
      })
      await composable.handleModelDrop(file)

      expect(mockLoad3d.loadModel).not.toHaveBeenCalled()
      expect(mockToastStore.addAlert).toHaveBeenCalledWith(
        'toastMessages.no3dScene'
      )
    })
  })

  describe('hdri controls', () => {
    it('should call setHDRIEnabled when hdriConfig.enabled changes', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      composable.lightConfig.value = {
        ...composable.lightConfig.value,
        hdri: { ...composable.lightConfig.value.hdri!, enabled: true }
      }
      await nextTick()

      expect(mockLoad3d.setHDRIEnabled).toHaveBeenCalledWith(true)
    })

    it('should call setHDRIAsBackground when hdriConfig.showAsBackground changes', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      composable.lightConfig.value = {
        ...composable.lightConfig.value,
        hdri: { ...composable.lightConfig.value.hdri!, showAsBackground: true }
      }
      await nextTick()

      expect(mockLoad3d.setHDRIAsBackground).toHaveBeenCalledWith(true)
    })

    it('should call setHDRIIntensity when hdriConfig.intensity changes', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      composable.lightConfig.value = {
        ...composable.lightConfig.value,
        hdri: { ...composable.lightConfig.value.hdri!, intensity: 2.5 }
      }
      await nextTick()

      expect(mockLoad3d.setHDRIIntensity).toHaveBeenCalledWith(2.5)
    })

    it('should upload file, load HDRI and update hdriConfig', async () => {
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/env.hdr')
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['3d', 'env.hdr'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/view?filename=env.hdr'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/view?filename=env.hdr'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      const file = new File([''], 'env.hdr', { type: 'image/x-hdr' })
      await composable.handleHDRIFileUpdate(file)

      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(mockLoad3d.loadHDRI).toHaveBeenCalledWith(
        'http://localhost/view?filename=env.hdr'
      )
      expect(composable.lightConfig.value.hdri!.hdriPath).toBe('3d/env.hdr')
      expect(composable.lightConfig.value.hdri!.enabled).toBe(true)
    })

    it('should clear HDRI when file is null', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')
      await composable.initializeLoad3d(containerRef)

      composable.lightConfig.value = {
        ...composable.lightConfig.value,
        hdri: {
          enabled: true,
          hdriPath: '3d/env.hdr',
          showAsBackground: true,
          intensity: 1
        }
      }

      await composable.handleHDRIFileUpdate(null)

      expect(mockLoad3d.clearHDRI).toHaveBeenCalled()
      expect(composable.lightConfig.value.hdri!.hdriPath).toBe('')
      expect(composable.lightConfig.value.hdri!.enabled).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle null node ref', () => {
      const nodeRef = ref(null)
      const composable = useLoad3d(nodeRef)

      const callback = vi.fn()
      composable.waitForLoad3d(callback)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should handle missing configurations', async () => {
      delete mockNode.properties!['Scene Config']
      delete mockNode.properties!['Model Config']
      delete mockNode.properties!['Camera Config']
      delete mockNode.properties!['Light Config']

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      // Should not throw and should use defaults
      expect(Load3d).toHaveBeenCalled()
    })

    it('should handle background image with existing config', async () => {
      ;(
        mockNode.properties!['Scene Config'] as {
          backgroundImage: string
        }
      ).backgroundImage = 'existing.jpg'

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith('existing.jpg')
    })
  })

  describe('gizmo controls', () => {
    it('should include default gizmo config in modelConfig', () => {
      const composable = useLoad3d(mockNode)

      expect(composable.modelConfig.value.gizmo).toEqual({
        enabled: false,
        mode: 'translate',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      })
    })

    it('should restore gizmo config from node properties', async () => {
      ;(mockNode.properties!['Model Config'] as Record<string, unknown>).gizmo =
        {
          enabled: true,
          mode: 'rotate',
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0.1, y: 0.2, z: 0.3 },
          scale: { x: 2, y: 2, z: 2 }
        }

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(composable.modelConfig.value.gizmo).toEqual({
        enabled: true,
        mode: 'rotate',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.1, y: 0.2, z: 0.3 },
        scale: { x: 2, y: 2, z: 2 }
      })
    })

    it('should add default gizmo config when missing from saved config', async () => {
      mockNode.properties!['Model Config'] = {
        upDirection: 'original',
        materialMode: 'original',
        showSkeleton: false
      }

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(composable.modelConfig.value.gizmo).toBeDefined()
      expect(composable.modelConfig.value.gizmo!.enabled).toBe(false)
    })

    it('should add default scale when gizmo config lacks scale', async () => {
      ;(mockNode.properties!['Model Config'] as Record<string, unknown>).gizmo =
        {
          enabled: false,
          mode: 'translate',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(composable.modelConfig.value.gizmo!.scale).toEqual({
        x: 1,
        y: 1,
        z: 1
      })
    })

    it('handleToggleGizmo should enable gizmo and update config', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleToggleGizmo(true)

      expect(mockLoad3d.setGizmoEnabled).toHaveBeenCalledWith(true)
      expect(composable.modelConfig.value.gizmo!.enabled).toBe(true)
    })

    it('handleToggleGizmo should disable gizmo and update config', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleToggleGizmo(true)
      composable.handleToggleGizmo(false)

      expect(mockLoad3d.setGizmoEnabled).toHaveBeenLastCalledWith(false)
      expect(composable.modelConfig.value.gizmo!.enabled).toBe(false)
    })

    it('handleSetGizmoMode should set mode and update config', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleSetGizmoMode('rotate')

      expect(mockLoad3d.setGizmoMode).toHaveBeenCalledWith('rotate')
      expect(composable.modelConfig.value.gizmo!.mode).toBe('rotate')
    })

    it('handleResetGizmoTransform should call resetGizmoTransform', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleResetGizmoTransform()

      expect(mockLoad3d.resetGizmoTransform).toHaveBeenCalled()
    })

    it('should persist gizmo config to node properties via modelConfig watcher', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleToggleGizmo(true)
      composable.handleSetGizmoMode('rotate')
      await nextTick()

      const savedConfig = mockNode.properties['Model Config'] as {
        gizmo: { enabled: boolean; mode: string }
      }
      expect(savedConfig.gizmo.enabled).toBe(true)
      expect(savedConfig.gizmo.mode).toBe('rotate')
    })

    it('should register gizmoTransformChange event handler', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      const addEventCalls = vi.mocked(mockLoad3d.addEventListener!).mock.calls
      const gizmoEventCall = addEventCalls.find(
        ([event]) => event === 'gizmoTransformChange'
      )
      expect(gizmoEventCall).toBeDefined()
    })

    it('gizmoTransformChange event should update modelConfig', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      const addEventCalls = vi.mocked(mockLoad3d.addEventListener!).mock.calls
      const gizmoEventCall = addEventCalls.find(
        ([event]) => event === 'gizmoTransformChange'
      )
      const handler = gizmoEventCall![1] as (data: unknown) => void

      handler({
        position: { x: 5, y: 6, z: 7 },
        rotation: { x: 0.5, y: 0.6, z: 0.7 },
        scale: { x: 3, y: 3, z: 3 },
        enabled: true,
        mode: 'rotate'
      })

      expect(composable.modelConfig.value.gizmo!.position).toEqual({
        x: 5,
        y: 6,
        z: 7
      })
      expect(composable.modelConfig.value.gizmo!.rotation).toEqual({
        x: 0.5,
        y: 0.6,
        z: 0.7
      })
      expect(composable.modelConfig.value.gizmo!.scale).toEqual({
        x: 3,
        y: 3,
        z: 3
      })
      expect(composable.modelConfig.value.gizmo!.enabled).toBe(true)
      expect(composable.modelConfig.value.gizmo!.mode).toBe('rotate')
    })

    it('should reset gizmo config on model switch (not first load)', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.handleToggleGizmo(true)
      composable.handleSetGizmoMode('rotate')

      const addEventCalls = vi.mocked(mockLoad3d.addEventListener!).mock.calls
      const loadingStartCall = addEventCalls.find(
        ([event]) => event === 'modelLoadingStart'
      )
      const loadingStartHandler = loadingStartCall![1] as () => void

      const loadingEndCall = addEventCalls.find(
        ([event]) => event === 'modelLoadingEnd'
      )
      const loadingEndHandler = loadingEndCall![1] as () => void
      loadingEndHandler()

      loadingStartHandler()

      expect(composable.modelConfig.value.gizmo).toEqual({
        enabled: false,
        mode: 'translate',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      })
    })

    it('should not call gizmo methods when load3d is not initialized', () => {
      const composable = useLoad3d(mockNode)

      // These should not throw
      composable.handleToggleGizmo(true)
      composable.handleSetGizmoMode('rotate')
      composable.handleResetGizmoTransform()

      expect(mockLoad3d.setGizmoEnabled).not.toHaveBeenCalled()
      expect(mockLoad3d.setGizmoMode).not.toHaveBeenCalled()
      expect(mockLoad3d.resetGizmoTransform).not.toHaveBeenCalled()
    })
  })
})
