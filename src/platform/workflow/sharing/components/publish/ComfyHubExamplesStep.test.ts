import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'
import { MAX_IMAGE_SIZE_MB } from '@/platform/workflow/sharing/utils/validateFileSize'

import ComfyHubExamplesStep from './ComfyHubExamplesStep.vue'

type DragData = Record<string, unknown>

type DraggableOptions = {
  getInitialData?: () => DragData
}

type MonitorOptions = {
  canMonitor: (args: { source: { data: DragData } }) => boolean
  onDrop: (args: {
    source: { data: DragData }
    location: {
      current: {
        dropTargets: Array<{ data: DragData }>
      }
    }
  }) => void
}

const pragmatic = vi.hoisted(() => ({
  draggables: [] as DraggableOptions[],
  monitor: undefined as MonitorOptions | undefined,
  cleanupMonitor: vi.fn()
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: vi.fn((options: DraggableOptions) => {
    pragmatic.draggables.push(options)
    return vi.fn()
  }),
  dropTargetForElements: vi.fn(() => vi.fn()),
  monitorForElements: vi.fn((options: MonitorOptions) => {
    pragmatic.monitor = options
    return pragmatic.cleanupMonitor
  })
}))

function createImages(count: number): ExampleImage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `img-${i}`,
    url: `blob:http://localhost/img-${i}`
  }))
}

function createImageFile(name: string, size = 1): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' })
}

function createTextFile(name: string): File {
  return new File(['text'], name, { type: 'text/plain' })
}

function renderStep(
  images: ExampleImage[],
  callbacks: Record<string, ReturnType<typeof vi.fn>> = {}
) {
  return render(ComfyHubExamplesStep, {
    props: { exampleImages: images, ...callbacks },
    global: {
      mocks: { $t: (key: string) => key }
    }
  })
}

function getUploadInput() {
  const labelContent = screen.getByText('comfyHubPublish.uploadExampleImage')
  // eslint-disable-next-line testing-library/no-node-access
  const label = labelContent.closest('label')
  // eslint-disable-next-line testing-library/no-node-access
  const input = label?.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Missing file input')
  }
  return input
}

describe('ComfyHubExamplesStep', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia())
    vi.clearAllMocks()
    pragmatic.draggables = []
    pragmatic.monitor = undefined
    pragmatic.cleanupMonitor.mockClear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`)
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    })
  })

  it('renders all example images', () => {
    renderStep(createImages(3))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('emits reordered array when moving image left via keyboard', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(3), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    const tiles = screen.getAllByRole('listitem')
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(tiles[1], { key: 'ArrowLeft', shiftKey: true })

    expect(onUpdateExampleImages).toHaveBeenCalled()
    const reordered = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(reordered.map((img) => img.id)).toEqual(['img-1', 'img-0', 'img-2'])
  })

  it('emits reordered array when moving image right via keyboard', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(3), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    const tiles = screen.getAllByRole('listitem')
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(tiles[1], { key: 'ArrowRight', shiftKey: true })

    expect(onUpdateExampleImages).toHaveBeenCalled()
    const reordered = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(reordered.map((img) => img.id)).toEqual(['img-0', 'img-2', 'img-1'])
  })

  it('does not emit when moving first image left (boundary)', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(3), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    const tiles = screen.getAllByRole('listitem')
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(tiles[0], { key: 'ArrowLeft', shiftKey: true })

    expect(onUpdateExampleImages).not.toHaveBeenCalled()
  })

  it('does not emit when moving last image right (boundary)', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(3), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    const tiles = screen.getAllByRole('listitem')
    // eslint-disable-next-line testing-library/prefer-user-event
    await fireEvent.keyDown(tiles[2], { key: 'ArrowRight', shiftKey: true })

    expect(onUpdateExampleImages).not.toHaveBeenCalled()
  })

  it('emits filtered array when removing an image', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(2), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    const removeBtn = screen.getAllByRole('button', {
      name: 'comfyHubPublish.removeExampleImage'
    })[0]
    await userEvent.click(removeBtn)

    expect(onUpdateExampleImages).toHaveBeenCalled()
    expect(onUpdateExampleImages.mock.calls[0][0]).toHaveLength(1)
  })

  it('hides the upload tile when the example limit is reached', () => {
    renderStep(createImages(8))

    expect(
      screen.queryByRole('button', {
        name: 'comfyHubPublish.uploadExampleImage'
      })
    ).toBeNull()
  })

  it('prepends selected image files and filters invalid uploads', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(1), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    await userEvent.upload(getUploadInput(), [
      createImageFile('valid.png'),
      createTextFile('notes.txt'),
      createImageFile('too-large.png', MAX_IMAGE_SIZE_MB * 1024 * 1024 + 1)
    ])

    const updated = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(updated.map((image) => image.url)).toEqual([
      'blob:valid.png',
      'blob:http://localhost/img-0'
    ])
  })

  it('revokes overflow uploads when only one example slot remains', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(7), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    await fireEvent.drop(
      screen.getByRole('button', {
        name: 'comfyHubPublish.uploadExampleImage'
      }),
      {
        dataTransfer: {
          files: [createImageFile('first.png'), createImageFile('second.png')]
        }
      }
    )

    const updated = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(updated).toHaveLength(8)
    expect(updated[0].url).toBe('blob:first.png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second.png')
  })

  it('revokes object URLs when removing uploaded images', async () => {
    const onUpdateExampleImages = vi.fn()
    const uploaded = createImageFile('uploaded.png')
    renderStep(
      [
        {
          id: 'uploaded',
          url: 'blob:uploaded.png',
          file: uploaded
        }
      ],
      {
        'onUpdate:exampleImages': onUpdateExampleImages
      }
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: 'comfyHubPublish.removeExampleImage'
      })
    )

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:uploaded.png')
    expect(onUpdateExampleImages.mock.calls[0][0]).toEqual([])
  })

  it('monitors drags from its own image grid only', () => {
    renderStep(createImages(1))
    const monitor = pragmatic.monitor
    const dragData = pragmatic.draggables[0]?.getInitialData?.()
    if (!monitor || !dragData) {
      throw new Error('Missing drag monitor setup')
    }

    expect(monitor.canMonitor({ source: { data: dragData } })).toBe(true)
    expect(
      monitor.canMonitor({
        source: {
          data: {
            ...dragData,
            instanceId: Symbol('other-grid')
          }
        }
      })
    ).toBe(false)
  })

  it('reorders images when the drag monitor drops on another image', () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(3), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })
    const monitor = pragmatic.monitor
    const dragData = pragmatic.draggables[0]?.getInitialData?.()
    if (!monitor || !dragData) {
      throw new Error('Missing drag monitor setup')
    }

    monitor.onDrop({
      source: { data: dragData },
      location: {
        current: {
          dropTargets: [{ data: { imageId: 'img-2' } }]
        }
      }
    })

    const reordered = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(reordered.map((img) => img.id)).toEqual(['img-1', 'img-2', 'img-0'])
  })

  it('ignores monitor drops without a destination image', () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(2), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })
    const monitor = pragmatic.monitor
    const dragData = pragmatic.draggables[0]?.getInitialData?.()
    if (!monitor || !dragData) {
      throw new Error('Missing drag monitor setup')
    }

    monitor.onDrop({
      source: { data: dragData },
      location: { current: { dropTargets: [] } }
    })
    monitor.onDrop({
      source: { data: { ...dragData, imageId: 1 } },
      location: {
        current: {
          dropTargets: [{ data: { imageId: 'img-1' } }]
        }
      }
    })
    monitor.onDrop({
      source: { data: dragData },
      location: {
        current: {
          dropTargets: [{ data: { imageId: 1 } }]
        }
      }
    })

    expect(onUpdateExampleImages).not.toHaveBeenCalled()
  })

  it('inserts files from an image tile drop', async () => {
    const onUpdateExampleImages = vi.fn()
    renderStep(createImages(2), {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    await fireEvent.drop(screen.getAllByRole('listitem')[1], {
      dataTransfer: {
        files: [createImageFile('inserted.png')]
      }
    })

    const updated = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(updated.map((image) => image.url)).toEqual([
      'blob:http://localhost/img-0',
      'blob:inserted.png',
      'blob:http://localhost/img-1'
    ])
  })

  it('replaces existing images when inserting into a full grid', async () => {
    const onUpdateExampleImages = vi.fn()
    const original = createImages(8).map((image, index) => ({
      ...image,
      file: index === 1 ? createImageFile('old.png') : undefined
    }))
    renderStep(original, {
      'onUpdate:exampleImages': onUpdateExampleImages
    })

    await fireEvent.drop(screen.getAllByRole('listitem')[1], {
      dataTransfer: {
        files: [createImageFile('replacement.png')]
      }
    })

    const updated = onUpdateExampleImages.mock.calls[0][0] as ExampleImage[]
    expect(updated.map((image) => image.url).slice(0, 3)).toEqual([
      'blob:http://localhost/img-0',
      'blob:replacement.png',
      'blob:http://localhost/img-2'
    ])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:http://localhost/img-1'
    )
  })
})
