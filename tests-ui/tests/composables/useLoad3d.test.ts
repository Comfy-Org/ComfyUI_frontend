import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { nodeToLoad3dMap, useLoad3d } from '@/composables/useLoad3d'
import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'

vi.mock('@/extensions/core/load3d/Load3d', () => ({
  default: vi.fn()
}))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    splitFilePath: vi.fn(),
    getResourceURL: vi.fn(),
    uploadFile: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn()
  }
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key) => key)
}))

describe('useLoad3d', () => {
  let mockLoad3d: any
  let mockNode: any
  let mockToastStore: any

  beforeEach(() => {
    vi.clearAllMocks()
    nodeToLoad3dMap.clear()

    mockNode = {
      properties: {
        'Scene Config': {
          showGrid: true,
          backgroundColor: '#000000',
          backgroundImage: ''
        },
        'Model Config': {
          upDirection: 'original',
          materialMode: 'original'
        },
        'Camera Config': {
          cameraType: 'perspective',
          fov: 75,
          state: null
        },
        'Light Config': {
          intensity: 5
        },
        'Resource Folder': ''
      },
      widgets: [
        { name: 'width', value: 512 },
        { name: 'height', value: 512 }
      ],
      graph: {
        setDirtyCanvas: vi.fn()
      },
      flags: {},
      onMouseEnter: null,
      onMouseLeave: null,
      onResize: null,
      onDrawBackground: null
    }

    mockLoad3d = {
      toggleGrid: vi.fn(),
      setBackgroundColor: vi.fn(),
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
      renderer: {
        domElement: {
          hidden: false
        }
      }
    }

    vi.mocked(Load3d).mockImplementation(() => mockLoad3d)

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
      const composable = useLoad3d(mockNode)

      expect(composable.sceneConfig.value).toEqual({
        showGrid: true,
        backgroundColor: '#000000',
        backgroundImage: ''
      })
      expect(composable.modelConfig.value).toEqual({
        upDirection: 'original',
        materialMode: 'original'
      })
      expect(composable.cameraConfig.value).toEqual({
        cameraType: 'perspective',
        fov: 75
      })
      expect(composable.lightConfig.value).toEqual({
        intensity: 5
      })
      expect(composable.isRecording.value).toBe(false)
      expect(composable.hasRecording.value).toBe(false)
      expect(composable.loading.value).toBe(false)
    })

    it('should initialize Load3d with container and node', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(Load3d).toHaveBeenCalledWith(containerRef, {
        node: mockNode
      })
      expect(nodeToLoad3dMap.has(mockNode)).toBe(true)
    })

    it('should restore configurations from node', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockLoad3d.toggleGrid).toHaveBeenCalledWith(true)
      expect(mockLoad3d.setBackgroundColor).toHaveBeenCalledWith('#000000')
      expect(mockLoad3d.setUpDirection).toHaveBeenCalledWith('original')
      expect(mockLoad3d.setMaterialMode).toHaveBeenCalledWith('original')
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
      mockNode.onMouseEnter()
      expect(mockLoad3d.refreshViewport).toHaveBeenCalled()
      expect(mockLoad3d.updateStatusMouseOnNode).toHaveBeenCalledWith(true)

      mockNode.onMouseLeave()
      expect(mockLoad3d.updateStatusMouseOnNode).toHaveBeenCalledWith(false)

      mockNode.onResize()
      expect(mockLoad3d.handleResize).toHaveBeenCalled()
    })

    it('should handle collapsed state', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      mockNode.flags.collapsed = true
      mockNode.onDrawBackground()

      expect(mockLoad3d.renderer.domElement.hidden).toBe(true)
    })

    it('should load model if model_file widget exists', async () => {
      mockNode.widgets.push({ name: 'model_file', value: 'test.glb' })
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue([
        'subfolder',
        'test.glb'
      ])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/api/view/test.glb'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/api/view/test.glb'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockLoad3d.loadModel).toHaveBeenCalledWith(
        'http://localhost/api/view/test.glb'
      )
    })

    it('should restore camera state after loading model', async () => {
      mockNode.widgets.push({ name: 'model_file', value: 'test.glb' })
      mockNode.properties['Camera Config'].state = {
        position: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 }
      }
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue([
        'subfolder',
        'test.glb'
      ])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/api/view/test.glb'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/api/view/test.glb'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)
      await nextTick()

      expect(mockLoad3d.setCameraState).toHaveBeenCalledWith({
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
      vi.mocked(Load3d).mockImplementationOnce(() => {
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

      await composable.initializeLoad3d(null as any)

      expect(Load3d).not.toHaveBeenCalled()
    })

    it('should accept ref as parameter', () => {
      const nodeRef = ref(mockNode)
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

      mockLoad3d.toggleGrid.mockClear()
      mockLoad3d.setBackgroundColor.mockClear()
      mockLoad3d.setBackgroundImage.mockClear()

      composable.sceneConfig.value = {
        showGrid: false,
        backgroundColor: '#ffffff',
        backgroundImage: 'test.jpg'
      }
      await nextTick()

      expect(mockLoad3d.toggleGrid).toHaveBeenCalledWith(false)
      expect(mockLoad3d.setBackgroundColor).toHaveBeenCalledWith('#ffffff')
      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith('test.jpg')
      expect(mockNode.properties['Scene Config']).toEqual({
        showGrid: false,
        backgroundColor: '#ffffff',
        backgroundImage: 'test.jpg'
      })
    })

    it('should update model config when values change', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      composable.modelConfig.value.upDirection = '+y'
      composable.modelConfig.value.materialMode = 'wireframe'
      await nextTick()

      expect(mockLoad3d.setUpDirection).toHaveBeenCalledWith('+y')
      expect(mockLoad3d.setMaterialMode).toHaveBeenCalledWith('wireframe')
      expect(mockNode.properties['Model Config']).toEqual({
        upDirection: '+y',
        materialMode: 'wireframe'
      })
    })

    it('should update camera config when values change', async () => {
      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

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

      composable.lightConfig.value.intensity = 10
      await nextTick()

      expect(mockLoad3d.setLightIntensity).toHaveBeenCalledWith(10)
      expect(mockNode.properties['Light Config']).toEqual({
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
      mockNode.properties['Resource Folder'] = 'subfolder'
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
      mockLoad3d.exportModel.mockRejectedValueOnce(new Error('Export failed'))

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
        'exportLoadingStart',
        'exportLoadingEnd',
        'recordingStatusChange',
        'animationListChange'
      ]

      expectedEvents.forEach((event) => {
        expect(mockLoad3d.addEventListener).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        )
      })
    })

    it('should handle materialModeChange event', async () => {
      let materialModeHandler: any

      mockLoad3d.addEventListener.mockImplementation(
        (event: string, handler: any) => {
          if (event === 'materialModeChange') {
            materialModeHandler = handler
          }
        }
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      materialModeHandler('wireframe')

      expect(composable.modelConfig.value.materialMode).toBe('wireframe')
    })

    it('should handle loading events', async () => {
      let modelLoadingStartHandler: any
      let modelLoadingEndHandler: any

      mockLoad3d.addEventListener.mockImplementation(
        (event: string, handler: any) => {
          if (event === 'modelLoadingStart') {
            modelLoadingStartHandler = handler
          } else if (event === 'modelLoadingEnd') {
            modelLoadingEndHandler = handler
          }
        }
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      modelLoadingStartHandler()
      expect(composable.loading.value).toBe(true)
      expect(composable.loadingMessage.value).toBe('load3d.loadingModel')

      modelLoadingEndHandler()
      expect(composable.loading.value).toBe(false)
      expect(composable.loadingMessage.value).toBe('')
    })

    it('should handle recordingStatusChange event', async () => {
      let recordingStatusHandler: any

      mockLoad3d.addEventListener.mockImplementation(
        (event: string, handler: any) => {
          if (event === 'recordingStatusChange') {
            recordingStatusHandler = handler
          }
        }
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      recordingStatusHandler(false)

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

  describe('getModelUrl', () => {
    it('should handle http URLs directly', async () => {
      mockNode.widgets.push({
        name: 'model_file',
        value: 'http://example.com/model.glb'
      })

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockLoad3d.loadModel).toHaveBeenCalledWith(
        'http://example.com/model.glb'
      )
    })

    it('should construct URL for local files', async () => {
      mockNode.widgets.push({ name: 'model_file', value: 'models/test.glb' })
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue([
        'models',
        'test.glb'
      ])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/api/view/models/test.glb'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/api/view/models/test.glb'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(Load3dUtils.splitFilePath).toHaveBeenCalledWith('models/test.glb')
      expect(Load3dUtils.getResourceURL).toHaveBeenCalledWith(
        'models',
        'test.glb',
        'input'
      )
      expect(api.apiURL).toHaveBeenCalledWith('/api/view/models/test.glb')
      expect(mockLoad3d.loadModel).toHaveBeenCalledWith(
        'http://localhost/api/view/models/test.glb'
      )
    })

    it('should use output type for preview mode', async () => {
      mockNode.widgets = [{ name: 'model_file', value: 'test.glb' }] // No width/height widgets
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'test.glb'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
        '/api/view/test.glb'
      )
      vi.mocked(api.apiURL).mockReturnValue(
        'http://localhost/api/view/test.glb'
      )

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(Load3dUtils.getResourceURL).toHaveBeenCalledWith(
        '',
        'test.glb',
        'output'
      )
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
      delete mockNode.properties['Scene Config']
      delete mockNode.properties['Model Config']
      delete mockNode.properties['Camera Config']
      delete mockNode.properties['Light Config']

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      // Should not throw and should use defaults
      expect(Load3d).toHaveBeenCalled()
    })

    it('should handle background image with existing config', async () => {
      mockNode.properties['Scene Config'].backgroundImage = 'existing.jpg'

      const composable = useLoad3d(mockNode)
      const containerRef = document.createElement('div')

      await composable.initializeLoad3d(containerRef)

      expect(mockLoad3d.setBackgroundImage).toHaveBeenCalledWith('existing.jpg')
    })
  })
})
