import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import ComfyHubThumbnailStep from './ComfyHubThumbnailStep.vue'

type ThumbnailStepProps = ComponentProps<typeof ComfyHubThumbnailStep>

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

vi.mock('@/platform/workflow/sharing/composables/useSliderFromMouse', () => ({
  useSliderFromMouse: () => ({ value: 50 })
}))

vi.mock('@/platform/workflow/sharing/utils/validateFileSize', () => ({
  isFileTooLarge: () => false,
  MAX_IMAGE_SIZE_MB: 25,
  MAX_VIDEO_SIZE_MB: 100
}))

function renderStep(
  props: Partial<ThumbnailStepProps> = {},
  callbacks: Partial<ThumbnailStepProps> = {}
) {
  return render(ComfyHubThumbnailStep, {
    props: { ...props, ...callbacks },
    global: {
      plugins: [i18n]
    }
  })
}

describe('ComfyHubThumbnailStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('prefilled URL preview', () => {
    it('renders an <img> using thumbnailUrl when no file is selected', () => {
      renderStep({ thumbnailUrl: 'https://cdn.example.com/thumb.png' })

      const img = screen.getByAltText('comfyHubPublish.thumbnailPreview')
      expect(img).toBeInTheDocument()
      expect(img.getAttribute('src')).toBe('https://cdn.example.com/thumb.png')
      expect(
        screen.queryByLabelText('comfyHubPublish.videoPreview')
      ).not.toBeInTheDocument()
    })

    it('renders a <video> when thumbnailType is video and URL has a video extension', () => {
      renderStep({
        thumbnailType: 'video',
        thumbnailUrl: 'https://cdn.example.com/clip.mp4?token=abc'
      })

      const video = screen.getByLabelText('comfyHubPublish.videoPreview')
      expect(video.tagName.toLowerCase()).toBe('video')
      expect(video.getAttribute('src')).toBe(
        'https://cdn.example.com/clip.mp4?token=abc'
      )
    })

    it('renders an <img> for video mode when URL points at an image (e.g. gif)', () => {
      renderStep({
        thumbnailType: 'video',
        thumbnailUrl: 'https://cdn.example.com/anim.gif'
      })

      expect(
        screen.getByAltText('comfyHubPublish.thumbnailPreview')
      ).toBeInTheDocument()
      expect(
        screen.queryByLabelText('comfyHubPublish.videoPreview')
      ).not.toBeInTheDocument()
    })

    it('renders both comparison previews when both URLs are provided', () => {
      renderStep({
        thumbnailType: 'imageComparison',
        comparisonBeforeUrl: 'https://cdn.example.com/before.png',
        comparisonAfterUrl: 'https://cdn.example.com/after.png'
      })

      const beforeImgs = screen.getAllByAltText(
        'comfyHubPublish.uploadComparisonBeforePrompt'
      )
      const afterImgs = screen.getAllByAltText(
        'comfyHubPublish.uploadComparisonAfterPrompt'
      )
      expect(
        beforeImgs.some(
          (el) =>
            el.getAttribute('src') === 'https://cdn.example.com/before.png'
        )
      ).toBe(true)
      expect(
        afterImgs.some(
          (el) => el.getAttribute('src') === 'https://cdn.example.com/after.png'
        )
      ).toBe(true)
    })

    it('shows upload prompt when no thumbnail file or URL is set', () => {
      renderStep()

      expect(
        screen.queryByAltText('comfyHubPublish.thumbnailPreview')
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('comfyHubPublish.uploadPromptClickToBrowse')
      ).toBeInTheDocument()
    })
  })

  describe('clear emits', () => {
    it('emits clear (image mode) when the user clicks Clear with a prefilled URL', async () => {
      const onClear = vi.fn()
      renderStep(
        { thumbnailUrl: 'https://cdn.example.com/thumb.png' },
        { onClear }
      )

      await userEvent.click(screen.getByRole('button', { name: 'g.clear' }))

      expect(onClear).toHaveBeenCalledOnce()
    })

    it('emits clear (comparison mode) when at least one comparison URL is set', async () => {
      const onClear = vi.fn()
      renderStep(
        {
          thumbnailType: 'imageComparison',
          comparisonBeforeUrl: 'https://cdn.example.com/before.png'
        },
        { onClear }
      )

      await userEvent.click(screen.getByRole('button', { name: 'g.clear' }))

      expect(onClear).toHaveBeenCalledOnce()
    })

    it('hides Clear when there is no thumbnail content', () => {
      renderStep()
      expect(
        screen.queryByRole('button', { name: 'g.clear' })
      ).not.toBeInTheDocument()
    })
  })
})
