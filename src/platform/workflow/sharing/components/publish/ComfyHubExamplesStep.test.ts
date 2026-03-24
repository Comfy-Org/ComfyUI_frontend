import { mount } from '@vue/test-utils'
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

function mountStep(images: ExampleImage[]) {
  return mount(ComfyHubExamplesStep, {
    props: { exampleImages: images },
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
    const wrapper = mountStep(createImages(3))
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(3)
  })

  it('emits reordered array when moving image left via keyboard', async () => {
    const wrapper = mountStep(createImages(3))

    const tiles = wrapper.findAll('[role="listitem"]')
    await tiles[1].trigger('keydown', { key: 'ArrowLeft', shiftKey: true })

    const emitted = wrapper.emitted('update:exampleImages')
    expect(emitted).toBeTruthy()
    const reordered = emitted![0][0] as ExampleImage[]
    expect(reordered.map((img) => img.id)).toEqual(['img-1', 'img-0', 'img-2'])
  })

  it('emits reordered array when moving image right via keyboard', async () => {
    const wrapper = mountStep(createImages(3))

    const tiles = wrapper.findAll('[role="listitem"]')
    await tiles[1].trigger('keydown', { key: 'ArrowRight', shiftKey: true })

    const emitted = wrapper.emitted('update:exampleImages')
    expect(emitted).toBeTruthy()
    const reordered = emitted![0][0] as ExampleImage[]
    expect(reordered.map((img) => img.id)).toEqual(['img-0', 'img-2', 'img-1'])
  })

  it('does not emit when moving first image left (boundary)', async () => {
    const wrapper = mountStep(createImages(3))

    const tiles = wrapper.findAll('[role="listitem"]')
    await tiles[0].trigger('keydown', { key: 'ArrowLeft', shiftKey: true })

    expect(wrapper.emitted('update:exampleImages')).toBeFalsy()
  })

  it('does not emit when moving last image right (boundary)', async () => {
    const wrapper = mountStep(createImages(3))

    const tiles = wrapper.findAll('[role="listitem"]')
    await tiles[2].trigger('keydown', { key: 'ArrowRight', shiftKey: true })

    expect(wrapper.emitted('update:exampleImages')).toBeFalsy()
  })

  it('emits filtered array when removing an image', async () => {
    const wrapper = mountStep(createImages(2))

    const removeBtn = wrapper.find(
      'button[aria-label="comfyHubPublish.removeExampleImage"]'
    )
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    const emitted = wrapper.emitted('update:exampleImages')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toHaveLength(1)
  })
})
