import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ComponentProps } from 'vue-component-type-helpers'

import VideoEditPanel from './VideoEditPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      videoEdit: {
        trimVideo: 'Trim Video',
        cropVideo: 'Crop Video',
        startFrame: 'Start Frame',
        endFrame: 'End Frame',
        duration: 'Duration',
        dimensions: 'Dimensions',
        frameRate: 'Frame Rate',
        frameRateValue: '{count} fps',
        frames: 'Number of Frames',
        fileSize: 'File Size',
        resolution: '{width} × {height}',
        timecode: '{current} / {total}',
        play: 'Play',
        pause: 'Pause',
        mute: 'Mute',
        unmute: 'Unmute',
        fullscreen: 'Full screen',
        loadingVideo: 'Loading video preview',
        loadFailed: 'Failed to load video',
        canvasUnavailable: 'Failed to render video preview',
        retry: 'Retry',
        durationZero: '0s',
        durationSeconds: '{count}s',
        selectedOfTotal: '{selected} / {total}',
        fileSizeUnknown: '—',
        fileSizeBytes: '{count} B',
        fileSizeKilobytes: '{count} KB',
        fileSizeMegabytes: '{count} MB',
        noVideoSource: 'Select or connect a video to preview and edit'
      },
      imageCrop: {
        ratio: 'Ratio',
        custom: 'Custom',
        lockRatio: 'Lock ratio',
        unlockRatio: 'Unlock ratio'
      }
    }
  }
})

function stub(testId: string) {
  return defineComponent({
    setup: () => () => h('div', { 'data-testid': testId })
  })
}

const SliderStub = defineComponent({
  emits: ['update:modelValue'],
  setup(_, { emit }) {
    return () =>
      h('button', {
        'data-testid': 'stub-slider-seek',
        onClick: () => emit('update:modelValue', [90])
      })
  }
})

type PanelProps = ComponentProps<typeof VideoEditPanel>

function renderPanel(props: Partial<PanelProps> = {}) {
  return render(VideoEditPanel, {
    props: {
      features: ['trim', 'crop'],
      videoUrl: '/api/view?filename=clip.mp4',
      thumbnail: 'data:image/jpeg;base64,one',
      totalFrames: 100,
      duration: 10,
      fps: 10,
      fileSize: 2048,
      width: 1920,
      height: 1080,
      loading: false,
      ...props
    } as PanelProps,
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        VideoFilmstripTrim: stub('stub-filmstrip'),
        VideoCropOverlay: stub('stub-crop-overlay'),
        WidgetInputNumberInput: stub('stub-number-input'),
        WidgetBoundingBox: stub('stub-bounding-box'),
        Loader: stub('stub-loader'),
        Slider: SliderStub,
        Select: stub('stub-select'),
        SelectTrigger: stub('stub-select-trigger'),
        SelectValue: stub('stub-select-value'),
        SelectContent: stub('stub-select-content'),
        SelectItem: stub('stub-select-item'),
        Button: stub('stub-lock-button')
      }
    }
  })
}

describe('VideoEditPanel', () => {
  it('shows an empty state without a video source', () => {
    renderPanel({ videoUrl: undefined })

    expect(screen.getByTestId('video-edit-empty')).toBeTruthy()
    expect(screen.queryByTestId('video-preview')).toBeNull()
    expect(screen.queryByTestId('stub-filmstrip')).toBeNull()
  })

  it('renders only the editors of the enabled features', () => {
    renderPanel({ features: ['trim'] })

    expect(screen.getByTestId('stub-filmstrip')).toBeTruthy()
    expect(screen.getAllByTestId('stub-number-input')).toHaveLength(2)
    expect(screen.queryByTestId('stub-crop-overlay')).toBeNull()
    expect(screen.queryByTestId('stub-bounding-box')).toBeNull()
  })

  it('shows the crop editor for crop-only nodes', () => {
    renderPanel({ features: ['crop'] })

    expect(screen.getByTestId('stub-crop-overlay')).toBeTruthy()
    expect(screen.getByTestId('stub-bounding-box')).toBeTruthy()
    expect(screen.queryByTestId('stub-filmstrip')).toBeNull()
  })

  it('shows a loading overlay while the filmstrip loads', () => {
    renderPanel({ loading: true })

    expect(screen.getByTestId('video-preview-loading')).toBeTruthy()
  })

  it('shows the load error state with a retry control', async () => {
    const retries: number[] = []
    renderPanel({
      error: 'load-failed',
      onRetry: () => retries.push(1)
    } as Partial<PanelProps>)

    expect(screen.getByTestId('video-preview-error')).toBeTruthy()
    expect(screen.getByText('Failed to load video')).toBeTruthy()
    expect(screen.queryByTestId('video-preview-loading')).toBeNull()

    await userEvent.click(screen.getByTestId('video-preview-retry'))

    expect(retries).toHaveLength(1)
  })

  it('describes canvas failures separately from load failures', () => {
    renderPanel({ error: 'canvas-unavailable' })

    expect(screen.getByText('Failed to render video preview')).toBeTruthy()
  })

  it('prefers the loading overlay over a stale error overlay', () => {
    renderPanel({ error: 'load-failed', loading: true })

    expect(screen.getByTestId('video-preview-loading')).toBeTruthy()
    expect(screen.queryByTestId('video-preview-error')).toBeNull()
  })

  it('shows selected/total metadata when trim is a feature', () => {
    renderPanel({
      features: ['trim'],
      startFrame: 0,
      endFrame: 99
    })

    expect(screen.getByText('10s / 10s')).toBeTruthy()
    expect(screen.getByText('100 / 100')).toBeTruthy()
    expect(screen.getByText('2 KB')).toBeTruthy()
  })

  it('shows plain totals when trim is not a feature', () => {
    renderPanel({ features: ['crop'] })

    expect(screen.getByText('10s')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
  })

  it('renders dimensions and frame rate in the metadata rows', () => {
    renderPanel()

    expect(screen.getByText('Dimensions')).toBeTruthy()
    expect(screen.getByText('1920 × 1080')).toBeTruthy()
    expect(screen.getByText('Frame Rate')).toBeTruthy()
    expect(screen.getByText('10 fps')).toBeTruthy()
  })

  it('shows playback controls with the current timecode', () => {
    renderPanel()

    expect(screen.getByTestId('video-playback-controls')).toBeTruthy()
    expect(screen.getByTestId('playback-timecode').textContent?.trim()).toBe(
      '0:00 / 0:10'
    )
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('clamps slider seeks into the trim window while trim is enabled', async () => {
    const updates: number[] = []
    renderPanel({
      features: ['trim'],
      startFrame: 30,
      endFrame: 60,
      'onUpdate:playheadFrame': (value: number) => updates.push(value)
    } as Partial<PanelProps>)

    await userEvent.click(screen.getByTestId('stub-slider-seek'))

    expect(updates).toContain(60)
    expect(updates).not.toContain(90)
  })

  it('lets slider seeks reach the full range on crop-only nodes', async () => {
    const updates: number[] = []
    renderPanel({
      features: ['crop'],
      'onUpdate:playheadFrame': (value: number) => updates.push(value)
    } as Partial<PanelProps>)

    await userEvent.click(screen.getByTestId('stub-slider-seek'))

    expect(updates).toContain(90)
  })

  it('requests native fullscreen on the video element', async () => {
    renderPanel()

    const video = screen.getByTestId('video-preview') as HTMLVideoElement
    video.requestFullscreen = vi.fn().mockResolvedValue(undefined)

    await userEvent.click(screen.getByTestId('playback-fullscreen'))

    expect(video.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('toggles the mute button label', async () => {
    renderPanel()

    const muteButton = screen.getByTestId('playback-mute')
    expect(muteButton.getAttribute('aria-label')).toBe('Mute')

    await userEvent.click(muteButton)

    expect(muteButton.getAttribute('aria-label')).toBe('Unmute')
  })

  it('hides the playback controls without a video source', () => {
    renderPanel({ videoUrl: undefined })

    expect(screen.queryByTestId('video-playback-controls')).toBeNull()
  })
})
