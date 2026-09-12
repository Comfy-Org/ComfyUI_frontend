import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import DropZone from './DropZone.vue'

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: { openMaskEditor: 'Open mask editor' },
      mediaAsset: { actions: { zoom: 'Zoom' } },
      g: { playPause: 'Play/Pause' }
    }
  }
})

type DropIndicator = InstanceType<typeof DropZone>['$props']['dropIndicator']

function renderDropZone(dropIndicator: DropIndicator) {
  return render(DropZone, {
    props: {
      onDragOver: () => false,
      onDragDrop: () => false,
      dropIndicator
    },
    global: {
      plugins: [i18n],
      components: { Button },
      stubs: { ImageLightbox: true, TieredMenu: true, Slider: true }
    }
  })
}

describe('DropZone', () => {
  it('renders an image and the zoom/mask-edit actions for an image indicator', () => {
    const onMaskEdit = vi.fn()
    renderDropZone({
      mediaType: 'image',
      mediaUrl: 'http://localhost/image.png',
      label: 'Selected image',
      onMaskEdit
    })

    const img = screen.getByTestId('drop-zone-media')
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('alt', 'Selected image')
    expect(img).toHaveAttribute('src', 'http://localhost/image.png')
    expect(
      screen.getByRole('button', { name: 'Open mask editor' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom' })).toBeInTheDocument()
  })

  it('renders a native video player for a video indicator, without the image-only actions', () => {
    renderDropZone({
      mediaType: 'video',
      mediaUrl: 'http://localhost/clip.mp4',
      label: 'Selected video'
    })

    const video = screen.getByTestId('drop-zone-media')
    expect(video.tagName).toBe('VIDEO')
    expect(video).toHaveAttribute('src', 'http://localhost/clip.mp4')
    expect(video).toHaveAttribute('controls')
    expect(
      screen.queryByRole('button', { name: 'Zoom' })
    ).not.toBeInTheDocument()
  })

  it('renders the audio player for an audio indicator, without the image-only actions', () => {
    renderDropZone({
      mediaType: 'audio',
      mediaUrl: 'http://localhost/voice.mp3',
      label: 'Selected audio'
    })

    expect(screen.getByTestId('drop-zone-media')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Play/Pause' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Zoom' })
    ).not.toBeInTheDocument()
  })

  it('does not nest the video preview inside a <button>', () => {
    const onClick = vi.fn()
    renderDropZone({
      mediaType: 'video',
      mediaUrl: 'http://localhost/clip.mp4',
      onClick
    })

    expect(screen.getByTestId('drop-zone-indicator').tagName).toBe('DIV')
  })

  it('does not nest the audio preview inside a <button>', () => {
    const onClick = vi.fn()
    renderDropZone({
      mediaType: 'audio',
      mediaUrl: 'http://localhost/voice.mp3',
      onClick
    })

    expect(screen.getByTestId('drop-zone-indicator').tagName).toBe('DIV')
  })

  it('opens the upload dialog when clicking the empty placeholder', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderDropZone({
      mediaType: 'video',
      label: 'Click to browse or drag a video',
      iconClass: 'icon-[lucide--video]',
      onClick
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Click to browse or drag a video'
      })
    )

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
