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
        frames: 'Number of Frames',
        fileSize: 'File Size',
        resolution: '{width} × {height}',
        loadingVideo: 'Loading video preview',
        setStartFrame: 'Reset start frame',
        setEndFrame: 'Reset end frame',
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

const ToggleStub = defineComponent({
  props: {
    widget: { type: Object, required: true },
    modelValue: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('button', {
        'data-testid': `toggle-${props.widget.name}`,
        onClick: () => emit('update:modelValue', !props.modelValue)
      })
  }
})

type PanelProps = ComponentProps<typeof VideoEditPanel>

function renderPanel(props: Partial<PanelProps> = {}) {
  return render(VideoEditPanel, {
    props: {
      features: ['trim', 'crop'],
      videoUrl: '/api/view?filename=clip.mp4',
      thumbnails: ['data:image/jpeg;base64,one'],
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
        WidgetToggleSwitch: ToggleStub,
        Loader: stub('stub-loader'),
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
    expect(screen.queryByTestId('toggle-trim_enabled')).toBeNull()
  })

  it('renders only the toggles of the enabled features', () => {
    renderPanel({ features: ['trim'] })

    expect(screen.getByTestId('toggle-trim_enabled')).toBeTruthy()
    expect(screen.queryByTestId('toggle-crop_enabled')).toBeNull()
  })

  it('keeps the filmstrip visible but collapses trim controls until enabled', async () => {
    renderPanel({ features: ['trim'] })

    expect(screen.getByTestId('stub-filmstrip')).toBeTruthy()
    expect(screen.queryByTestId('stub-number-input')).toBeNull()

    await userEvent.click(screen.getByTestId('toggle-trim_enabled'))

    expect(screen.getAllByTestId('stub-number-input')).toHaveLength(2)
  })

  it('expands the crop editor when the crop toggle is enabled', async () => {
    renderPanel({ features: ['crop'] })

    expect(screen.queryByTestId('stub-crop-overlay')).toBeNull()
    expect(screen.queryByTestId('stub-bounding-box')).toBeNull()

    await userEvent.click(screen.getByTestId('toggle-crop_enabled'))

    expect(screen.getByTestId('stub-crop-overlay')).toBeTruthy()
    expect(screen.getByTestId('stub-bounding-box')).toBeTruthy()
  })

  it('resets the trim bounds from the reset frame buttons', async () => {
    const updates: Array<[string, number]> = []
    renderPanel({
      features: ['trim'],
      startFrame: 30,
      endFrame: 60,
      'onUpdate:startFrame': (value: number) => updates.push(['start', value]),
      'onUpdate:endFrame': (value: number) => updates.push(['end', value])
    } as Partial<PanelProps>)

    await userEvent.click(screen.getByTestId('toggle-trim_enabled'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset start frame' })
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset end frame' })
    )

    expect(updates).toContainEqual(['start', 0])
    expect(updates).toContainEqual(['end', 99])
  })

  it('disables the reset buttons at the trim extremes', async () => {
    renderPanel({ features: ['trim'], startFrame: 0, endFrame: 99 })

    await userEvent.click(screen.getByTestId('toggle-trim_enabled'))

    expect(
      screen.getByRole('button', { name: 'Reset start frame' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Reset end frame' })
    ).toBeDisabled()
  })

  it('disables the reset buttons while the filmstrip is still loading', async () => {
    renderPanel({
      features: ['trim'],
      startFrame: 30,
      endFrame: 60,
      loading: true
    })

    await userEvent.click(screen.getByTestId('toggle-trim_enabled'))

    expect(
      screen.getByRole('button', { name: 'Reset start frame' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Reset end frame' })
    ).toBeDisabled()
  })

  it('shows a loading overlay while the filmstrip loads', () => {
    renderPanel({ loading: true })

    expect(screen.getByTestId('video-preview-loading')).toBeTruthy()
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

  it('renders the source resolution', () => {
    renderPanel()

    expect(screen.getByText('1920 × 1080')).toBeTruthy()
  })
})
