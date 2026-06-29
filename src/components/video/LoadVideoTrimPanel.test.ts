import type { ComponentProps } from 'vue-component-type-helpers'
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import LoadVideoTrimPanel from './LoadVideoTrimPanel.vue'

vi.mock('@/composables/video/useVideoFilmstrip', () => ({
  DEFAULT_VIDEO_FPS: 30,
  useVideoFilmstrip: () => ({
    thumbnails: ref<string[]>(['data:image/jpeg;base64,one']),
    duration: ref(10),
    totalFrames: ref(101),
    width: ref(1920),
    height: ref(1080),
    fps: ref(30),
    fileSize: ref(5 * 1024 * 1024),
    loading: ref(false)
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        increment: 'Increment',
        decrement: 'Decrement',
        remove: 'Remove'
      },
      loadVideoTrim: {
        trimVideo: 'Trim Video',
        startFrame: 'Start Frame',
        endFrame: 'End Frame',
        setStartFrame: 'Set start frame',
        setEndFrame: 'Set end frame',
        play: 'Play',
        pause: 'Pause',
        adjustStartFrame: 'Adjust start frame',
        adjustEndFrame: 'Adjust end frame',
        duration: 'Duration',
        frames: 'Number of Frames',
        fileSize: 'File Size',
        resolution: '{width} × {height}',
        dragAndDropVideos: 'Drag and drop videos here to upload',
        uploadFromDevice: 'Upload from device',
        uploading: 'Uploading…',
        loadingVideo: 'Loading video preview'
      }
    }
  }
})

type PanelProps = ComponentProps<typeof LoadVideoTrimPanel>

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

function renderPanel(props: PanelProps) {
  return render(LoadVideoTrimPanel, {
    props,
    global: {
      plugins: [i18n]
    }
  })
}

describe('LoadVideoTrimPanel', () => {
  it('shows upload empty state and hides trim controls when no video', () => {
    renderPanel({
      videoUrl: undefined
    })

    expect(screen.getByTestId('media-upload-empty')).toBeTruthy()
    expect(screen.queryByText('Trim Video')).toBeNull()
  })

  it('shows trim controls when video is loaded', () => {
    renderPanel({
      videoUrl: 'https://example.com/video.mp4'
    })

    expect(screen.queryByTestId('media-upload-empty')).toBeNull()
    expect(screen.getByText('Trim Video')).toBeTruthy()
  })

  it('keeps the filmstrip visible when trim is toggled off', () => {
    renderPanel({
      videoUrl: 'https://example.com/video.mp4',
      trimEnabled: false
    })

    expect(screen.getByTestId('trim-track')).toBeTruthy()
    expect(screen.queryByText('Start Frame')).toBeNull()
    expect(screen.queryByText('End Frame')).toBeNull()
  })

  it('shows drag and drop empty state while not uploading', () => {
    renderPanel({
      videoUrl: undefined,
      uploading: false
    })

    expect(screen.getByTestId('media-upload-browse-button')).toBeTruthy()
    expect(screen.queryByText('Uploading…')).toBeNull()
  })

  it('shows uploading state only while an upload is in progress', () => {
    renderPanel({
      videoUrl: undefined,
      uploading: true
    })

    expect(screen.queryByTestId('media-upload-browse-button')).toBeNull()
    expect(screen.getByText('Uploading…')).toBeTruthy()
  })

  it('shows remove button on hover and emits remove when clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({
      videoUrl: 'https://example.com/video.mp4'
    })

    expect(screen.queryByTestId('video-remove-button')).toBeNull()

    await user.hover(screen.getByTestId('video-preview-container'))
    const removeButton = screen.getByTestId('video-remove-button')
    expect(removeButton).toBeTruthy()
    expect(removeButton).toHaveAttribute('aria-label', 'Remove')

    await user.click(removeButton)
    expect(emitted().remove).toHaveLength(1)
  })

  it('forwards browse event from empty state', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({
      videoUrl: undefined
    })

    await user.click(screen.getByTestId('media-upload-browse-button'))

    expect(emitted().browse).toHaveLength(1)
  })

  it('keeps playhead when trim edges move without collision', async () => {
    const playheadFrame = ref(50)
    const startFrame = ref(10)
    const endFrame = ref(80)

    const Host = defineComponent({
      components: { LoadVideoTrimPanel },
      setup() {
        return {
          playheadFrame,
          startFrame,
          endFrame,
          trimEnabled: ref(true),
          videoUrl: 'https://example.com/video.mp4'
        }
      },
      template: `
        <LoadVideoTrimPanel
          v-model:playhead-frame="playheadFrame"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:trim-enabled="trimEnabled"
          :video-url="videoUrl"
        />
      `
    })

    render(Host, { global: { plugins: [i18n] } })

    startFrame.value = 20
    await Promise.resolve()

    expect(playheadFrame.value).toBe(50)
  })

  it('moves playhead when trim edge collides with it', async () => {
    const playheadFrame = ref(50)
    const startFrame = ref(10)
    const endFrame = ref(80)

    const Host = defineComponent({
      components: { LoadVideoTrimPanel },
      setup() {
        return {
          playheadFrame,
          startFrame,
          endFrame,
          trimEnabled: ref(true),
          videoUrl: 'https://example.com/video.mp4'
        }
      },
      template: `
        <LoadVideoTrimPanel
          v-model:playhead-frame="playheadFrame"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:trim-enabled="trimEnabled"
          :video-url="videoUrl"
        />
      `
    })

    render(Host, { global: { plugins: [i18n] } })

    startFrame.value = 60
    await Promise.resolve()

    expect(playheadFrame.value).toBe(60)
  })

  it('moves playhead when start frame increment passes playhead', async () => {
    const user = userEvent.setup()
    const playheadFrame = ref(50)
    const startFrame = ref(50)
    const endFrame = ref(80)

    const Host = defineComponent({
      components: { LoadVideoTrimPanel },
      setup() {
        return {
          playheadFrame,
          startFrame,
          endFrame,
          trimEnabled: ref(true),
          videoUrl: 'https://example.com/video.mp4'
        }
      },
      template: `
        <LoadVideoTrimPanel
          v-model:playhead-frame="playheadFrame"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:trim-enabled="trimEnabled"
          :video-url="videoUrl"
        />
      `
    })

    render(Host, { global: { plugins: [i18n] } })

    await user.click(screen.getAllByTestId('increment')[0])

    expect(startFrame.value).toBe(51)
    expect(playheadFrame.value).toBe(51)
  })

  it('resets the start trim handle to the first frame', async () => {
    const user = userEvent.setup()
    const startFrame = ref(10)
    const endFrame = ref(100)
    const playheadFrame = ref(50)

    const Host = defineComponent({
      components: { LoadVideoTrimPanel },
      setup() {
        return {
          playheadFrame,
          startFrame,
          endFrame,
          trimEnabled: ref(true),
          videoUrl: 'https://example.com/video.mp4'
        }
      },
      template: `
        <LoadVideoTrimPanel
          v-model:playhead-frame="playheadFrame"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:trim-enabled="trimEnabled"
          :video-url="videoUrl"
        />
      `
    })

    render(Host, { global: { plugins: [i18n] } })

    await user.click(screen.getByLabelText('Set start frame'))

    expect(startFrame.value).toBe(0)
    expect(playheadFrame.value).toBe(0)
  })

  it('resets the end trim handle to the last frame', async () => {
    const user = userEvent.setup()
    const startFrame = ref(10)
    const endFrame = ref(80)
    const playheadFrame = ref(50)

    const Host = defineComponent({
      components: { LoadVideoTrimPanel },
      setup() {
        return {
          playheadFrame,
          startFrame,
          endFrame,
          trimEnabled: ref(true),
          videoUrl: 'https://example.com/video.mp4'
        }
      },
      template: `
        <LoadVideoTrimPanel
          v-model:playhead-frame="playheadFrame"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:trim-enabled="trimEnabled"
          :video-url="videoUrl"
        />
      `
    })

    render(Host, { global: { plugins: [i18n] } })

    await user.click(screen.getByLabelText('Set end frame'))

    expect(endFrame.value).toBe(100)
    expect(playheadFrame.value).toBe(100)
  })

  it('seeks the video preview when scrubbing the filmstrip', async () => {
    const playheadFrame = ref(0)
    const startFrame = ref(0)
    const endFrame = ref(100)

    const Host = defineComponent({
      components: { LoadVideoTrimPanel },
      setup() {
        return {
          playheadFrame,
          startFrame,
          endFrame,
          trimEnabled: ref(true),
          videoUrl: 'https://example.com/video.mp4'
        }
      },
      template: `
        <LoadVideoTrimPanel
          v-model:playhead-frame="playheadFrame"
          v-model:start-frame="startFrame"
          v-model:end-frame="endFrame"
          v-model:trim-enabled="trimEnabled"
          :video-url="videoUrl"
        />
      `
    })

    render(Host, { global: { plugins: [i18n] } })

    const video = screen.getByTestId('video-preview') as HTMLVideoElement
    let currentTime = 0
    Object.defineProperty(video, 'currentTime', {
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value
      },
      configurable: true
    })
    Object.defineProperty(video, 'duration', {
      value: 10,
      configurable: true
    })

    await fireEvent.loadedMetadata(video)
    await flushPromises()
    await fireEvent.seeked(video)
    await flushPromises()

    const track = screen.getByTestId('trim-track')
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 64,
      right: 200,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
    track.setPointerCapture = vi.fn()

    // eslint-disable-next-line testing-library/prefer-user-event -- pointer capture scrubbing needs low-level pointer events
    await fireEvent.pointerDown(track, {
      clientX: 100,
      button: 0,
      pointerId: 1
    })
    await flushPromises()
    await fireEvent.seeked(video)
    await flushPromises()

    expect(playheadFrame.value).toBe(50)
    expect(currentTime).toBe(5)
  })
})
