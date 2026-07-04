import { fromPartial } from '@total-typescript/shoehorn'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReorderableExampleImage from './ReorderableExampleImage.vue'
import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'

type DragPreviewOptions = {
  nativeSetDragImage: DataTransfer['setDragImage']
  render: (args: { container: HTMLElement }) => void
}

type DragSource = {
  data: {
    imageId?: string
    instanceId?: symbol
    type?: string
  }
}

type DraggableOptions = {
  getInitialData: () => DragSource['data']
  onGenerateDragPreview: (args: {
    nativeSetDragImage: DataTransfer['setDragImage']
  }) => void
  onDragStart: () => void
  onDrop: () => void
}

type DroppableOptions = {
  getData: () => { imageId: string }
  canDrop: (args: { source: DragSource }) => boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: () => void
}

const pragmatic = vi.hoisted(() => {
  const captured = {
    draggable: undefined as DraggableOptions | undefined,
    droppable: undefined as DroppableOptions | undefined,
    preview: undefined as DragPreviewOptions | undefined
  }

  return {
    captured,
    setCustomNativeDragPreview: vi.fn((options: DragPreviewOptions) => {
      captured.preview = options
    })
  }
})

vi.mock(
  '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview',
  () => ({
    setCustomNativeDragPreview: pragmatic.setCustomNativeDragPreview
  })
)

vi.mock('@/composables/usePragmaticDragAndDrop', () => ({
  usePragmaticDraggable: vi.fn(
    (_target: () => HTMLElement, options: DraggableOptions) => {
      pragmatic.captured.draggable = options
    }
  ),
  usePragmaticDroppable: vi.fn(
    (_target: () => HTMLElement, options: DroppableOptions) => {
      pragmatic.captured.droppable = options
    }
  )
}))

function createFileList(files: File[]): FileList {
  return fromPartial<FileList>(
    Object.assign(files, {
      item: (index: number) => files[index] ?? null
    })
  )
}

function renderImage(overrides: Partial<ExampleImage> = {}) {
  const instanceId = Symbol('grid')
  const image: ExampleImage = {
    id: 'image-1',
    url: 'blob:image-1',
    file: new File(['image'], 'image.png', { type: 'image/png' }),
    ...overrides
  }

  const result = render(ReorderableExampleImage, {
    props: {
      image,
      index: 1,
      total: 3,
      instanceId
    },
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, number>) =>
          params && params.total
            ? `${key}:${params.index}/${params.total}`
            : params
              ? `${key}:${params.index}`
              : key
      },
      stubs: {
        Button: {
          template:
            '<button data-testid="remove-button" @click="$emit(\'click\')"><slot /></button>',
          emits: ['click']
        }
      }
    }
  })

  return { ...result, image, instanceId }
}

function draggableOptions() {
  const options = pragmatic.captured.draggable
  if (!options) throw new Error('draggable options were not registered')
  return options
}

function droppableOptions() {
  const options = pragmatic.captured.droppable
  if (!options) throw new Error('droppable options were not registered')
  return options
}

describe('ReorderableExampleImage', () => {
  beforeEach(() => {
    pragmatic.captured.draggable = undefined
    pragmatic.captured.droppable = undefined
    pragmatic.captured.preview = undefined
    pragmatic.setCustomNativeDragPreview.mockClear()
  })

  it('labels the image position for assistive technology', () => {
    renderImage()

    expect(
      screen.getByRole('listitem', {
        name: 'comfyHubPublish.exampleImagePosition:2/3'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByAltText('comfyHubPublish.exampleImage:2')
    ).toHaveAttribute('src', 'blob:image-1')
  })

  it('emits move for shifted arrow keys', async () => {
    const { emitted } = renderImage()

    screen.getByRole('listitem').focus()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')

    expect(emitted('move')).toEqual([['image-1', 1]])
  })

  it('focuses siblings for unshifted arrow keys', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    renderImage()
    const sibling = document.createElement('button')
    screen.getByRole('listitem').after(sibling)

    screen.getByRole('listitem').focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(focus).toHaveBeenCalledWith({ focusVisible: true })
    expect(sibling).toHaveFocus()
    focus.mockRestore()
  })

  it('emits remove from keyboard and focuses the next sibling', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const { emitted } = renderImage()
    const sibling = document.createElement('button')
    screen.getByRole('listitem').after(sibling)

    screen.getByRole('listitem').focus()
    await userEvent.keyboard('{Delete}')

    expect(emitted('remove')).toEqual([['image-1']])
    expect(sibling).toHaveFocus()
    focus.mockRestore()
  })

  it('emits remove from the remove button', async () => {
    const { emitted } = renderImage()

    await userEvent.click(screen.getByTestId('remove-button'))

    expect(emitted('remove')).toEqual([['image-1']])
  })

  it('emits inserted files from file drops', async () => {
    const { emitted } = renderImage()
    const files = createFileList([
      new File(['image'], 'dropped.png', { type: 'image/png' })
    ])

    await fireEvent.drop(screen.getByRole('listitem'), {
      dataTransfer: { files }
    })

    expect(emitted('insertFiles')).toEqual([[1, files]])
  })

  it('ignores drops without files', async () => {
    const { emitted } = renderImage()

    await fireEvent.drop(screen.getByRole('listitem'), {
      dataTransfer: { files: createFileList([]) }
    })

    expect(emitted('insertFiles')).toBeUndefined()
  })

  it('registers drag data and a cloned preview image', () => {
    const { instanceId } = renderImage()
    const draggable = draggableOptions()

    expect(draggable.getInitialData()).toEqual({
      type: 'example-image',
      imageId: 'image-1',
      instanceId
    })

    const nativeSetDragImage = vi.fn()
    draggable.onGenerateDragPreview({ nativeSetDragImage })
    const container = document.createElement('div')
    pragmatic.captured.preview?.render({ container })

    expect(pragmatic.setCustomNativeDragPreview).toHaveBeenCalledWith({
      nativeSetDragImage,
      render: expect.any(Function)
    })
    expect(within(container).getByRole('img')).toHaveAttribute(
      'src',
      'blob:image-1'
    )
  })

  it('accepts drops from other images in the same grid instance only', () => {
    const { instanceId } = renderImage()
    const droppable = droppableOptions()

    expect(droppable.getData()).toEqual({ imageId: 'image-1' })
    expect(
      droppable.canDrop({
        source: {
          data: {
            type: 'example-image',
            imageId: 'image-2',
            instanceId
          }
        }
      })
    ).toBe(true)
    expect(
      droppable.canDrop({
        source: {
          data: {
            type: 'example-image',
            imageId: 'image-1',
            instanceId
          }
        }
      })
    ).toBe(false)
    expect(
      droppable.canDrop({
        source: {
          data: {
            type: 'example-image',
            imageId: 'image-2',
            instanceId: Symbol('other')
          }
        }
      })
    ).toBe(false)
    expect(
      droppable.canDrop({
        source: {
          data: {
            type: 'other',
            imageId: 'image-2',
            instanceId
          }
        }
      })
    ).toBe(false)
  })

  it('handles drag lifecycle callbacks without changing emitted actions', () => {
    const { emitted } = renderImage()
    const draggable = draggableOptions()
    const droppable = droppableOptions()

    draggable.onDragStart()
    draggable.onDrop()
    droppable.onDragEnter()
    droppable.onDragLeave()
    droppable.onDrop()

    expect(emitted('remove')).toBeUndefined()
    expect(emitted('move')).toBeUndefined()
    expect(emitted('insertFiles')).toBeUndefined()
  })
})
