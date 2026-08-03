import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useI18n: () => ({ t: (key: string) => key })
  }
})

import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'

import ComfyHubThumbnailStep from './ComfyHubThumbnailStep.vue'

function renderStep(
  props: Record<string, unknown> = {},
  callbacks: Record<string, ReturnType<typeof vi.fn>> = {}
) {
  return render(ComfyHubThumbnailStep, {
    props: { thumbnailType: 'image' as ThumbnailType, ...props, ...callbacks },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ToggleGroup: {
          template:
            '<div><button data-testid="type-image" @click="$emit(\'update:modelValue\', \'image\')" /><button data-testid="type-video" @click="$emit(\'update:modelValue\', \'video\')" /><button data-testid="type-comparison" @click="$emit(\'update:modelValue\', \'imageComparison\')" /><slot /></div>'
        },
        ToggleGroupItem: { template: '<div><slot /></div>', props: ['value'] },
        Button: {
          template:
            '<button data-testid="clear-button" @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('ComfyHubThumbnailStep', () => {
  it('shows the existing image thumbnail on the image tab', () => {
    renderStep({
      thumbnailType: 'image',
      thumbnailUrl: 'https://cdn.example.com/thumb.png',
      existingThumbnailType: 'image'
    })

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/thumb.png'
    )
  })

  it('does not show an existing image thumbnail on the video tab', () => {
    renderStep({
      thumbnailType: 'video',
      thumbnailUrl: 'https://cdn.example.com/thumb.png',
      existingThumbnailType: 'image'
    })

    // The image must not leak into the video tab as a preview; the upload
    // prompt stays visible instead.
    expect(screen.queryByRole('img')).toBeNull()
    expect(
      screen.getByText('comfyHubPublish.uploadPromptClickToBrowse')
    ).toBeTruthy()
  })

  it('keeps the existing thumbnail URL when the type changes', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailUrl = vi.fn()
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailType = vi.fn()
    renderStep(
      {
        thumbnailType: 'image',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        existingThumbnailType: 'image'
      },
      {
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl,
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailType': onUpdateThumbnailType
      }
    )

    await user.click(screen.getByTestId('type-video'))

    expect(onUpdateThumbnailType).toHaveBeenCalledWith('video')
    // The uploaded file is cleared, but the existing URL is preserved so
    // toggling back restores the preview.
    expect(onUpdateThumbnailFile).toHaveBeenCalledWith(null)
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
  })

  it('keeps restored comparison URLs when switching away from the comparison type', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailUrl = vi.fn()
    const onUpdateComparisonAfterUrl = vi.fn()
    const onUpdateComparisonBeforeFile = vi.fn()
    const onUpdateComparisonAfterFile = vi.fn()
    const onUpdateThumbnailType = vi.fn()
    renderStep(
      {
        thumbnailType: 'imageComparison',
        thumbnailUrl: 'https://cdn.example.com/before.png',
        comparisonAfterUrl: 'https://cdn.example.com/after.png',
        existingThumbnailType: 'imageComparison'
      },
      {
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl,
        'onUpdate:comparisonAfterUrl': onUpdateComparisonAfterUrl,
        'onUpdate:comparisonBeforeFile': onUpdateComparisonBeforeFile,
        'onUpdate:comparisonAfterFile': onUpdateComparisonAfterFile,
        'onUpdate:thumbnailType': onUpdateThumbnailType
      }
    )

    await user.click(screen.getByTestId('type-image'))

    expect(onUpdateThumbnailType).toHaveBeenCalledWith('image')
    // Comparison file inputs reset, but the restored before/after URLs stay
    // inert so switching back restores the previews.
    expect(onUpdateComparisonBeforeFile).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonAfterFile).toHaveBeenCalledWith(null)
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
    expect(onUpdateComparisonAfterUrl).not.toHaveBeenCalled()
  })

  it('renders a restored GIF thumbnail as an image, not a video', () => {
    const { container } = renderStep({
      thumbnailType: 'video',
      thumbnailUrl: 'https://cdn.example.com/anim.gif',
      existingThumbnailType: 'video'
    })

    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/anim.gif'
    )
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('video')).toBeNull()
  })

  it('renders a restored mp4 thumbnail as a video', () => {
    const { container } = renderStep({
      thumbnailType: 'video',
      thumbnailUrl: 'https://cdn.example.com/clip.mp4',
      existingThumbnailType: 'video'
    })

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    const video = container.querySelector('video')
    expect(video?.getAttribute('src')).toBe('https://cdn.example.com/clip.mp4')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders a restored extensionless video-mode thumbnail as a video', () => {
    const { container } = renderStep({
      thumbnailType: 'video',
      thumbnailUrl: 'https://cdn.example.com/assets/object-key',
      existingThumbnailType: 'video'
    })

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('video')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders a restored video-mode thumbnail with a query string as a video', () => {
    const { container } = renderStep({
      thumbnailType: 'video',
      thumbnailUrl: 'https://cdn.example.com/clip?token=abc123',
      existingThumbnailType: 'video'
    })

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('video')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('restores both comparison images on the comparison tab', () => {
    const { container } = renderStep({
      thumbnailType: 'imageComparison',
      thumbnailUrl: 'https://cdn.example.com/before.png',
      comparisonAfterUrl: 'https://cdn.example.com/after.png',
      existingThumbnailType: 'imageComparison'
    })

    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    const srcs = Array.from(container.querySelectorAll('img')).map((el) =>
      el.getAttribute('src')
    )
    expect(srcs).toContain('https://cdn.example.com/before.png')
    expect(srcs).toContain('https://cdn.example.com/after.png')
  })

  it('clears a restored image thumbnail when removed', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {
        thumbnailType: 'image',
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        existingThumbnailType: 'image'
      },
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )

    await user.click(screen.getByTestId('clear-button'))

    expect(onUpdateThumbnailFile).toHaveBeenCalledWith(null)
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
  })

  it('clears both restored comparison images when removed', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailUrl = vi.fn()
    const onUpdateComparisonAfterUrl = vi.fn()
    const onUpdateComparisonBeforeFile = vi.fn()
    const onUpdateComparisonAfterFile = vi.fn()
    renderStep(
      {
        thumbnailType: 'imageComparison',
        thumbnailUrl: 'https://cdn.example.com/before.png',
        comparisonAfterUrl: 'https://cdn.example.com/after.png',
        existingThumbnailType: 'imageComparison'
      },
      {
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl,
        'onUpdate:comparisonAfterUrl': onUpdateComparisonAfterUrl,
        'onUpdate:comparisonBeforeFile': onUpdateComparisonBeforeFile,
        'onUpdate:comparisonAfterFile': onUpdateComparisonAfterFile
      }
    )

    await user.click(screen.getByTestId('clear-button'))

    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonAfterUrl).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonBeforeFile).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonAfterFile).toHaveBeenCalledWith(null)
  })
})
