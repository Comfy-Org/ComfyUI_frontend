import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type * as VueUse from '@vueuse/core'

type TestDropZoneOptions = {
  dataTypes?: (types: readonly string[]) => boolean
  onDrop?: (files: File[] | null | undefined) => void
}

const vueUseMocks = vi.hoisted(() => ({
  dropZoneOptions: [] as TestDropZoneOptions[]
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  const { ref } = await import('vue')

  return {
    ...actual,
    useDropZone: vi.fn((_target: unknown, options: TestDropZoneOptions) => {
      vueUseMocks.dropZoneOptions.push(options)
      return { isOverDropZone: ref(false) }
    })
  }
})

import type { ThumbnailType } from '@/platform/workflow/sharing/types/comfyHubTypes'
import {
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB
} from '@/platform/workflow/sharing/utils/validateFileSize'

import ComfyHubThumbnailStep from './ComfyHubThumbnailStep.vue'

function createFile(name: string, type: string, size = 7): File {
  const file = new File(['content'], name, { type })
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: size
  })
  return file
}

function getDropZoneOptions(index: number): TestDropZoneOptions {
  const options = vueUseMocks.dropZoneOptions[index]
  if (!options) {
    throw new Error(`Missing drop zone options at index ${index}`)
  }
  return options
}

function getDropDataTypes(
  index: number
): (types: readonly string[]) => boolean {
  const dataTypes = getDropZoneOptions(index).dataTypes
  if (!dataTypes) {
    throw new Error(`Missing dataTypes handler at index ${index}`)
  }
  return dataTypes
}

function getDropHandler(
  index: number
): (files: File[] | null | undefined) => void {
  const onDrop = getDropZoneOptions(index).onDrop
  if (!onDrop) {
    throw new Error(`Missing drop handler at index ${index}`)
  }
  return onDrop
}

function renderStep(
  props: Record<string, unknown> = {},
  callbacks: Record<string, ReturnType<typeof vi.fn>> = {}
) {
  return render(ComfyHubThumbnailStep, {
    props: { thumbnailType: 'image' as ThumbnailType, ...props, ...callbacks },
    global: {
      plugins: [i18n],
      stubs: {
        ToggleGroup: {
          template:
            '<div><button data-testid="type-image" @click="$emit(\'update:modelValue\', \'image\')" /><button data-testid="type-video" @click="$emit(\'update:modelValue\', \'video\')" /><button data-testid="type-comparison" @click="$emit(\'update:modelValue\', \'imageComparison\')" /><button data-testid="type-invalid" @click="$emit(\'update:modelValue\', \'audio\')" /><slot /></div>'
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

function getFileInput(name: string | RegExp) {
  const labelContent = [
    ...screen.queryAllByText(name),
    ...screen.queryAllByAltText(name)
    // eslint-disable-next-line testing-library/no-node-access
  ].find((element) => element.closest('label'))
  // eslint-disable-next-line testing-library/no-node-access
  const label = labelContent?.closest('label')
  // eslint-disable-next-line testing-library/no-node-access
  const input = label?.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Missing file input for ${String(name)}`)
  }
  return input
}

describe('ComfyHubThumbnailStep', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vueUseMocks.dropZoneOptions.length = 0
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`)
    })
  })

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

  it('shows the upload prompt when the restored image URL is empty', () => {
    renderStep({
      thumbnailType: 'image',
      thumbnailUrl: null,
      existingThumbnailType: 'image'
    })

    expect(screen.queryByRole('img')).toBeNull()
    expect(
      screen.getByText('comfyHubPublish.uploadPromptClickToBrowse')
    ).toBeInTheDocument()
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
    renderStep({
      thumbnailType: 'imageComparison',
      thumbnailUrl: 'https://cdn.example.com/before.png',
      comparisonAfterUrl: 'https://cdn.example.com/after.png',
      existingThumbnailType: 'imageComparison'
    })

    const srcs = screen.getAllByRole('img').map((el) => el.getAttribute('src'))
    expect(srcs).toContain('https://cdn.example.com/before.png')
    expect(srcs).toContain('https://cdn.example.com/after.png')
  })

  it('shows comparison prompts when restored comparison URLs are empty', () => {
    renderStep({
      thumbnailType: 'imageComparison',
      thumbnailUrl: null,
      comparisonAfterUrl: null,
      existingThumbnailType: 'imageComparison'
    })

    expect(
      screen.getByText('comfyHubPublish.uploadComparisonBeforePrompt')
    ).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubPublish.uploadComparisonAfterPrompt')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('clear-button')).toBeNull()
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

  it('does not show a clear button when the active thumbnail mode is empty', () => {
    renderStep()

    expect(screen.queryByTestId('clear-button')).toBeNull()
  })

  it('shows video-mode upload copy', () => {
    renderStep({
      thumbnailType: 'video'
    })

    expect(screen.getByText('comfyHubPublish.uploadVideo')).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubPublish.uploadPromptDropVideo')
    ).toBeInTheDocument()
  })

  it('shows comparison upload prompts before images are selected', () => {
    renderStep({
      thumbnailType: 'imageComparison'
    })

    expect(
      screen.getByText('comfyHubPublish.uploadComparison')
    ).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubPublish.uploadComparisonBeforePrompt')
    ).toBeInTheDocument()
    expect(
      screen.getByText('comfyHubPublish.uploadComparisonAfterPrompt')
    ).toBeInTheDocument()
  })

  it('renders selected image files from object URLs', () => {
    renderStep({
      thumbnailType: 'image',
      thumbnailFile: createFile('selected.png', 'image/png')
    })

    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:selected.png')
  })

  it('renders selected video files as a video preview', () => {
    renderStep({
      thumbnailType: 'video',
      thumbnailFile: createFile('selected.mp4', 'video/mp4')
    })

    expect(
      screen.getByLabelText('comfyHubPublish.videoPreview')
    ).toHaveAttribute('src', 'blob:selected.mp4')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('ignores invalid thumbnail type updates', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailType = vi.fn()
    const onUpdateThumbnailFile = vi.fn()
    renderStep(
      {},
      {
        'onUpdate:thumbnailType': onUpdateThumbnailType,
        'onUpdate:thumbnailFile': onUpdateThumbnailFile
      }
    )

    await user.click(screen.getByTestId('type-invalid'))

    expect(onUpdateThumbnailType).not.toHaveBeenCalled()
    expect(onUpdateThumbnailFile).not.toHaveBeenCalled()
  })

  it('selects an image thumbnail file and clears the restored URL', async () => {
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
    const file = createFile('thumb.png', 'image/png')

    await user.upload(getFileInput('comfyHubPublish.thumbnailPreview'), file)

    expect(onUpdateThumbnailFile).toHaveBeenCalledWith(file)
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
  })

  it('ignores an empty image thumbnail file selection', () => {
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {},
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )

    getFileInput('comfyHubPublish.uploadPromptClickToBrowse').dispatchEvent(
      new Event('change', { bubbles: true })
    )

    expect(onUpdateThumbnailFile).not.toHaveBeenCalled()
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
  })

  it('selects a video thumbnail file in video mode', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {
        thumbnailType: 'video'
      },
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )
    const file = createFile('clip.mp4', 'video/mp4')

    await user.upload(
      getFileInput('comfyHubPublish.uploadPromptClickToBrowse'),
      file
    )

    expect(onUpdateThumbnailFile).toHaveBeenCalledWith(file)
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
  })

  it('accepts only image drops for image thumbnails', () => {
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {},
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )
    const acceptsSingleDrop = getDropDataTypes(0)

    expect(acceptsSingleDrop(['image/png'])).toBe(true)
    expect(acceptsSingleDrop(['video/mp4'])).toBe(false)

    getDropHandler(0)([createFile('dropped.png', 'image/png')])
    getDropHandler(0)([])

    expect(onUpdateThumbnailFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dropped.png' })
    )
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
    expect(onUpdateThumbnailFile).toHaveBeenCalledTimes(1)
  })

  it('accepts video-mode drops for videos and animated images', () => {
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {
        thumbnailType: 'video'
      },
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )
    const acceptsSingleDrop = getDropDataTypes(0)

    expect(acceptsSingleDrop(['video/mp4'])).toBe(true)
    expect(acceptsSingleDrop(['image/gif'])).toBe(true)
    expect(acceptsSingleDrop(['image/webp'])).toBe(true)
    expect(acceptsSingleDrop(['image/png'])).toBe(false)

    getDropHandler(0)([createFile('clip.mp4', 'video/mp4')])

    expect(onUpdateThumbnailFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'clip.mp4' })
    )
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
  })

  it('ignores oversized image thumbnail files', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {},
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )

    await user.upload(
      getFileInput('comfyHubPublish.uploadPromptClickToBrowse'),
      createFile(
        'too-large.png',
        'image/png',
        MAX_IMAGE_SIZE_MB * 1024 * 1024 + 1
      )
    )

    expect(onUpdateThumbnailFile).not.toHaveBeenCalled()
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
  })

  it('ignores oversized video thumbnail files', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailFile = vi.fn()
    const onUpdateThumbnailUrl = vi.fn()
    renderStep(
      {
        thumbnailType: 'video'
      },
      {
        'onUpdate:thumbnailFile': onUpdateThumbnailFile,
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl
      }
    )

    await user.upload(
      getFileInput('comfyHubPublish.uploadPromptClickToBrowse'),
      createFile(
        'too-large.mp4',
        'video/mp4',
        MAX_VIDEO_SIZE_MB * 1024 * 1024 + 1
      )
    )

    expect(onUpdateThumbnailFile).not.toHaveBeenCalled()
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
  })

  it('selects comparison files independently by slot', async () => {
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
    const before = createFile('before.png', 'image/png')
    const after = createFile('after.png', 'image/png')

    await user.upload(
      getFileInput('comfyHubPublish.uploadComparisonBeforePrompt'),
      before
    )
    await user.upload(
      getFileInput('comfyHubPublish.uploadComparisonAfterPrompt'),
      after
    )

    expect(onUpdateComparisonBeforeFile).toHaveBeenCalledWith(before)
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonAfterFile).toHaveBeenCalledWith(after)
    expect(onUpdateComparisonAfterUrl).toHaveBeenCalledWith(null)
  })

  it('ignores an empty comparison file selection', () => {
    const onUpdateThumbnailUrl = vi.fn()
    const onUpdateComparisonBeforeFile = vi.fn()
    renderStep(
      {
        thumbnailType: 'imageComparison'
      },
      {
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl,
        'onUpdate:comparisonBeforeFile': onUpdateComparisonBeforeFile
      }
    )

    getFileInput('comfyHubPublish.uploadComparisonBeforePrompt').dispatchEvent(
      new Event('change', { bubbles: true })
    )

    expect(onUpdateComparisonBeforeFile).not.toHaveBeenCalled()
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
  })

  it('selects comparison images from drop handlers', () => {
    const onUpdateThumbnailUrl = vi.fn()
    const onUpdateComparisonAfterUrl = vi.fn()
    const onUpdateComparisonBeforeFile = vi.fn()
    const onUpdateComparisonAfterFile = vi.fn()
    renderStep(
      {
        thumbnailType: 'imageComparison'
      },
      {
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl,
        'onUpdate:comparisonAfterUrl': onUpdateComparisonAfterUrl,
        'onUpdate:comparisonBeforeFile': onUpdateComparisonBeforeFile,
        'onUpdate:comparisonAfterFile': onUpdateComparisonAfterFile
      }
    )

    expect(getDropDataTypes(1)(['image/png'])).toBe(true)
    expect(getDropDataTypes(1)(['video/mp4'])).toBe(false)

    getDropHandler(1)([createFile('before.png', 'image/png')])
    getDropHandler(2)([createFile('after.png', 'image/png')])
    getDropHandler(2)(null)

    expect(onUpdateComparisonBeforeFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'before.png' })
    )
    expect(onUpdateThumbnailUrl).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonAfterFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'after.png' })
    )
    expect(onUpdateComparisonAfterUrl).toHaveBeenCalledWith(null)
    expect(onUpdateComparisonAfterFile).toHaveBeenCalledTimes(1)
  })

  it('ignores oversized comparison files', async () => {
    const user = userEvent.setup()
    const onUpdateThumbnailUrl = vi.fn()
    const onUpdateComparisonBeforeFile = vi.fn()
    renderStep(
      {
        thumbnailType: 'imageComparison'
      },
      {
        'onUpdate:thumbnailUrl': onUpdateThumbnailUrl,
        'onUpdate:comparisonBeforeFile': onUpdateComparisonBeforeFile
      }
    )

    await user.upload(
      getFileInput('comfyHubPublish.uploadComparisonBeforePrompt'),
      createFile(
        'too-large.png',
        'image/png',
        MAX_IMAGE_SIZE_MB * 1024 * 1024 + 1
      )
    )

    expect(onUpdateComparisonBeforeFile).not.toHaveBeenCalled()
    expect(onUpdateThumbnailUrl).not.toHaveBeenCalled()
  })
})
