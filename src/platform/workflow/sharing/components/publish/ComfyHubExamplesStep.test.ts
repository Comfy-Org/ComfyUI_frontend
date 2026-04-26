import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExampleImage } from '@/platform/workflow/sharing/types/comfyHubTypes'

import ComfyHubExamplesStep from './ComfyHubExamplesStep.vue'

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: vi.fn(() => vi.fn()),
  dropTargetForElements: vi.fn(() => vi.fn()),
  monitorForElements: vi.fn(() => vi.fn())
}))

function createImages(count: number): ExampleImage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `img-${i}`,
    url: `blob:http://localhost/img-${i}`
  }))
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

describe('ComfyHubExamplesStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
