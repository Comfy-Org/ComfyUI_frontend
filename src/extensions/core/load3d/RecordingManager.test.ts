import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventManagerInterface } from './interfaces'
import { RecordingManager } from './RecordingManager'

const { downloadBlobMock } = vi.hoisted(() => ({
  downloadBlobMock: vi.fn()
}))

vi.mock('@/base/common/downloadUtil', () => ({
  downloadBlob: downloadBlobMock
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  // Avoid TextureLoader -> ImageLoader -> new Image() in happy-dom.
  class StubTextureLoader {
    load() {
      return new actual.Texture()
    }
  }
  return { ...actual, TextureLoader: StubTextureLoader }
})

type DataAvailableHandler = (event: { data: Blob }) => void
type StopHandler = () => void

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  ondataavailable: DataAvailableHandler | null = null
  onstop: StopHandler | null = null
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions
  ) {
    MockMediaRecorder.instances.push(this)
  }
  start = vi.fn(() => {
    this.state = 'recording'
  })
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.onstop?.()
  })
  pushChunk(blob: Blob) {
    this.ondataavailable?.({ data: blob })
  }
}

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  } satisfies EventManagerInterface
}

function makeStream(): MediaStream {
  const tracks: { stop: ReturnType<typeof vi.fn> }[] = [{ stop: vi.fn() }]
  return {
    getTracks: () => tracks
  } as unknown as MediaStream
}

function makeRenderer(): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  return { domElement: canvas } as unknown as THREE.WebGLRenderer
}

describe('RecordingManager', () => {
  let scene: THREE.Scene
  let renderer: THREE.WebGLRenderer
  let events: ReturnType<typeof makeMockEventManager>
  let manager: RecordingManager
  let rafSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    MockMediaRecorder.instances = []
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn()
    })
    // happy-dom canvases lack captureStream; stub it on the prototype so
    // every canvas the production code creates gets a usable stream.
    vi.spyOn(
      HTMLCanvasElement.prototype as unknown as {
        captureStream: (fps?: number) => MediaStream
      },
      'captureStream'
    ).mockImplementation(makeStream)
    // happy-dom returns null from getContext('2d'); production code throws
    // without it. Provide a minimal context with the methods the manager calls.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn()
    } as unknown as ReturnType<HTMLCanvasElement['getContext']>)
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    scene = new THREE.Scene()
    renderer = makeRenderer()
    events = makeMockEventManager()
    manager = new RecordingManager(scene, renderer, events)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('construction', () => {
    it('adds a hidden recording indicator sprite to the scene', () => {
      const sprite = scene.children.find((c) => c instanceof THREE.Sprite) as
        | THREE.Sprite
        | undefined

      expect(sprite).toBeDefined()
      expect(sprite!.visible).toBe(false)
    })
  })

  describe('startRecording', () => {
    it('initializes a MediaRecorder, marks recording state, and emits recordingStarted', async () => {
      await manager.startRecording()

      expect(MockMediaRecorder.instances).toHaveLength(1)
      expect(MockMediaRecorder.instances[0].start).toHaveBeenCalledWith(100)
      expect(manager.getIsRecording()).toBe(true)
      expect(events.emitEvent).toHaveBeenCalledWith('recordingStarted', null)
    })

    it('shows the recording indicator sprite', async () => {
      const sprite = scene.children.find(
        (c) => c instanceof THREE.Sprite
      ) as THREE.Sprite

      await manager.startRecording()

      expect(sprite.visible).toBe(true)
    })

    it('begins capturing frames via requestAnimationFrame', async () => {
      await manager.startRecording()
      expect(rafSpy).toHaveBeenCalled()
    })

    it('is idempotent — a second startRecording while already recording is ignored', async () => {
      await manager.startRecording()
      await manager.startRecording()

      expect(MockMediaRecorder.instances).toHaveLength(1)
    })

    it('emits recordingError when MediaRecorder construction fails', async () => {
      vi.stubGlobal(
        'MediaRecorder',
        class {
          constructor() {
            throw new Error('codec not supported')
          }
        }
      )

      await manager.startRecording()

      expect(events.emitEvent).toHaveBeenCalledWith(
        'recordingError',
        expect.any(Error)
      )
      expect(manager.getIsRecording()).toBe(false)
    })
  })

  describe('stopRecording', () => {
    it('is a no-op when not currently recording', () => {
      manager.stopRecording()
      expect(events.emitEvent).not.toHaveBeenCalledWith(
        'recordingStopped',
        expect.anything()
      )
    })

    it('hides the indicator, clears recording state, and emits recordingStopped', async () => {
      await manager.startRecording()
      const sprite = scene.children.find(
        (c) => c instanceof THREE.Sprite
      ) as THREE.Sprite

      manager.stopRecording()

      expect(sprite.visible).toBe(false)
      expect(manager.getIsRecording()).toBe(false)
      expect(events.emitEvent).toHaveBeenCalledWith(
        'recordingStopped',
        expect.objectContaining({ hasRecording: false })
      )
    })

    it('reports a non-zero duration after recording', async () => {
      await manager.startRecording()
      // Force a known startTime so duration math is deterministic.
      ;(
        manager as unknown as { recordingStartTime: number }
      ).recordingStartTime = Date.now() - 2000

      manager.stopRecording()

      expect(manager.getRecordingDuration()).toBeGreaterThanOrEqual(2)
    })
  })

  describe('hasRecording / getRecordingData', () => {
    it('reports no recording until chunks have been received', async () => {
      await manager.startRecording()
      expect(manager.hasRecording()).toBe(false)
      expect(manager.getRecordingData()).toBeNull()
    })

    it('returns a blob URL once chunks exist', async () => {
      await manager.startRecording()
      MockMediaRecorder.instances[0].pushChunk(new Blob(['x']))

      expect(manager.hasRecording()).toBe(true)
      expect(manager.getRecordingData()).toBe('blob:mock')
    })

    it('does not push zero-byte chunks', async () => {
      await manager.startRecording()
      MockMediaRecorder.instances[0].pushChunk(new Blob([]))

      expect(manager.hasRecording()).toBe(false)
    })
  })

  describe('exportRecording', () => {
    it('emits a recordingError when there is nothing to export', () => {
      manager.exportRecording()

      expect(events.emitEvent).toHaveBeenCalledWith(
        'recordingError',
        expect.any(Error)
      )
      expect(downloadBlobMock).not.toHaveBeenCalled()
    })

    it('downloads the blob with the requested filename and emits exportingRecording then recordingExported', async () => {
      await manager.startRecording()
      MockMediaRecorder.instances[0].pushChunk(new Blob(['x']))

      manager.exportRecording('clip.webm')

      expect(downloadBlobMock).toHaveBeenCalledWith(
        'clip.webm',
        expect.any(Blob)
      )
      expect(events.emitEvent).toHaveBeenCalledWith('exportingRecording', null)
      expect(events.emitEvent).toHaveBeenCalledWith('recordingExported', null)
    })

    it('uses the default filename when none is provided', async () => {
      await manager.startRecording()
      MockMediaRecorder.instances[0].pushChunk(new Blob(['x']))

      manager.exportRecording()

      expect(downloadBlobMock).toHaveBeenCalledWith(
        'scene-recording.mp4',
        expect.any(Blob)
      )
    })
  })

  describe('clearRecording', () => {
    it('drops all chunks, resets duration, and emits recordingCleared', async () => {
      await manager.startRecording()
      MockMediaRecorder.instances[0].pushChunk(new Blob(['x']))
      manager.stopRecording()

      manager.clearRecording()

      expect(manager.hasRecording()).toBe(false)
      expect(manager.getRecordingDuration()).toBe(0)
      expect(events.emitEvent).toHaveBeenCalledWith('recordingCleared', null)
    })
  })

  describe('dispose', () => {
    it('removes the indicator sprite from the scene and disposes its material', async () => {
      const sprite = scene.children.find(
        (c) => c instanceof THREE.Sprite
      ) as THREE.Sprite
      const disposeSpy = vi.spyOn(
        sprite.material as THREE.SpriteMaterial,
        'dispose'
      )

      manager.dispose()

      expect(scene.children).not.toContain(sprite)
      expect(disposeSpy).toHaveBeenCalled()
    })

    it('stops an in-flight recording before disposing', async () => {
      await manager.startRecording()

      manager.dispose()

      expect(MockMediaRecorder.instances[0].stop).toHaveBeenCalled()
    })
  })
})
