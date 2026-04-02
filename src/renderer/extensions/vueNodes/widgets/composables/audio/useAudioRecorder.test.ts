import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useAudioRecorder } from '@/renderer/extensions/vueNodes/widgets/composables/audio/useAudioRecorder'

const mockMediaRecorder = vi.hoisted(() => {
  let onstopHandler: (() => void) | null = null
  let ondataHandler: ((e: { data: Blob }) => void) | null = null
  const instance = {
    state: 'recording' as string,
    start: vi.fn(),
    stop: vi.fn(() => {
      instance.state = 'inactive'
      onstopHandler?.()
    }),
    get onstop() {
      return onstopHandler
    },
    set onstop(fn) {
      onstopHandler = fn
    },
    get ondataavailable() {
      return ondataHandler
    },
    set ondataavailable(fn) {
      ondataHandler = fn
    },
    pushData(data: Blob) {
      ondataHandler?.({ data })
    },
    reset() {
      instance.state = 'recording'
      onstopHandler = null
      ondataHandler = null
      instance.start.mockClear()
      instance.stop.mockClear()
    }
  }
  return instance
})

vi.mock('extendable-media-recorder', () => ({
  // Must be a regular function (not arrow) to support `new`
  MediaRecorder: vi.fn(function () {
    return mockMediaRecorder
  })
}))

vi.mock('@/services/audioService', () => ({
  useAudioService: () => ({
    registerWavEncoder: vi.fn().mockResolvedValue(undefined)
  })
}))

function createMockTrack() {
  return { kind: 'audio', readyState: 'live', stop: vi.fn() }
}

function createMockStream(tracks = [createMockTrack()]) {
  return { getTracks: () => tracks } as unknown as MediaStream
}

const mockGetUserMedia = vi.fn()
vi.stubGlobal('navigator', {
  mediaDevices: { getUserMedia: mockGetUserMedia }
})

describe('useAudioRecorder', () => {
  beforeEach(() => {
    mockMediaRecorder.reset()
    mockGetUserMedia.mockResolvedValue(createMockStream())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts recording and sets isRecording to true', async () => {
    const scope = effectScope()
    const { isRecording, startRecording } = scope.run(() => useAudioRecorder())!

    await startRecording()

    expect(isRecording.value).toBe(true)
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(mockMediaRecorder.start).toHaveBeenCalledWith(100)

    scope.stop()
  })

  it('stops recording and releases microphone tracks', async () => {
    const mockStream = createMockStream()
    mockGetUserMedia.mockResolvedValue(mockStream)
    const scope = effectScope()
    const { isRecording, startRecording, stopRecording } = scope.run(() =>
      useAudioRecorder()
    )!

    await startRecording()
    stopRecording()
    await vi.waitFor(() => expect(isRecording.value).toBe(false))

    const tracks = mockStream.getTracks()
    expect(tracks[0].stop).toHaveBeenCalled()

    scope.stop()
  })

  it('creates blob URL after stopping', async () => {
    const scope = effectScope()
    const { recordedURL, startRecording, stopRecording } = scope.run(() =>
      useAudioRecorder()
    )!

    await startRecording()
    mockMediaRecorder.pushData(new Blob(['audio'], { type: 'audio/wav' }))
    stopRecording()

    await vi.waitFor(() => expect(recordedURL.value).not.toBeNull())
    expect(recordedURL.value).toMatch(/^blob:/)

    scope.stop()
  })

  it('calls onRecordingComplete with blob after stop', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const scope = effectScope()
    const { startRecording, stopRecording } = scope.run(() =>
      useAudioRecorder({ onRecordingComplete: onComplete })
    )!

    await startRecording()
    mockMediaRecorder.pushData(new Blob(['chunk'], { type: 'audio/wav' }))
    stopRecording()

    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled())
    expect(onComplete).toHaveBeenCalledWith(expect.any(Blob))

    scope.stop()
  })

  it('releases mic BEFORE calling onRecordingComplete', async () => {
    const mockStream = createMockStream()
    mockGetUserMedia.mockResolvedValue(mockStream)
    const tracks = mockStream.getTracks()
    let micReleasedBeforeCallback = false

    const onComplete = vi.fn().mockImplementation(async () => {
      micReleasedBeforeCallback =
        vi.mocked(tracks[0].stop).mock.calls.length > 0
    })

    const scope = effectScope()
    const { startRecording, stopRecording } = scope.run(() =>
      useAudioRecorder({ onRecordingComplete: onComplete })
    )!

    await startRecording()
    stopRecording()

    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled())
    expect(micReleasedBeforeCallback).toBe(true)

    scope.stop()
  })

  it('calls onStop synchronously during cleanup', async () => {
    const onStop = vi.fn()
    const scope = effectScope()
    const { startRecording, stopRecording } = scope.run(() =>
      useAudioRecorder({ onStop })
    )!

    await startRecording()
    stopRecording()

    await vi.waitFor(() => expect(onStop).toHaveBeenCalled())

    scope.stop()
  })

  it('sets mediaRecorder to null in cleanup', async () => {
    const scope = effectScope()
    const { mediaRecorder, startRecording, stopRecording } = scope.run(() =>
      useAudioRecorder()
    )!

    await startRecording()
    expect(mediaRecorder.value).not.toBeNull()

    stopRecording()
    await vi.waitFor(() => expect(mediaRecorder.value).toBeNull())

    scope.stop()
  })

  it('calls onError when getUserMedia fails', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))
    const onError = vi.fn()
    const scope = effectScope()
    const { isRecording, startRecording } = scope.run(() =>
      useAudioRecorder({ onError })
    )!

    await expect(startRecording()).rejects.toThrow('Permission denied')
    expect(onError).toHaveBeenCalled()
    expect(isRecording.value).toBe(false)

    scope.stop()
  })

  it('dispose stops recording and revokes blob URL', async () => {
    const revokeURL = vi.spyOn(URL, 'revokeObjectURL')
    const scope = effectScope()
    const { recordedURL, startRecording, stopRecording, dispose } = scope.run(
      () => useAudioRecorder()
    )!

    await startRecording()
    stopRecording()
    await vi.waitFor(() => expect(recordedURL.value).not.toBeNull())

    const blobUrl = recordedURL.value
    dispose()

    expect(recordedURL.value).toBeNull()
    expect(revokeURL).toHaveBeenCalledWith(blobUrl)

    scope.stop()
  })

  it('cleanup is idempotent when called on inactive recorder', () => {
    const scope = effectScope()
    const { isRecording, stopRecording } = scope.run(() => useAudioRecorder())!

    expect(isRecording.value).toBe(false)
    stopRecording()
    expect(isRecording.value).toBe(false)

    scope.stop()
  })
})
