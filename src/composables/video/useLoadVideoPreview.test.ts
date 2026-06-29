import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  useLoadVideoPreview,
  nodeHasLoadVideoPreview
} from './useLoadVideoPreview'

const { getNodeImageUrlsMock } = vi.hoisted(() => ({
  getNodeImageUrlsMock: vi.fn<(node: unknown) => string[] | undefined>(
    () => undefined
  )
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    nodeOutputs: {},
    getNodeImageUrls: getNodeImageUrlsMock
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: () => ''
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => `https://example.test${path}`
  }
}))

describe('useLoadVideoPreview', () => {
  it('falls back to the file widget value when node outputs are unavailable', () => {
    getNodeImageUrlsMock.mockReturnValue(undefined)

    const node = computed(() => ({
      widgets: [{ name: 'file', value: 'clip.mp4' }]
    }))

    const { videoUrl } = useLoadVideoPreview(node as never)

    expect(videoUrl.value).toBe(
      'https://example.test/view?filename=clip.mp4&subfolder=&type=input'
    )
  })

  it('prefers node output preview urls over the file widget fallback', () => {
    getNodeImageUrlsMock.mockReturnValue([
      'https://example.test/view?filename=from-output.mp4'
    ])

    const node = computed(() => ({
      widgets: [{ name: 'file', value: 'clip.mp4' }]
    }))

    const { videoUrl } = useLoadVideoPreview(node as never)

    expect(videoUrl.value).toBe(
      'https://example.test/view?filename=from-output.mp4'
    )
  })

  it('detects preview availability from the file widget fallback', () => {
    getNodeImageUrlsMock.mockReturnValue(undefined)

    expect(
      nodeHasLoadVideoPreview({
        widgets: [{ name: 'file', value: 'clip.mp4' }]
      } as never)
    ).toBe(true)
  })

  it('ignores remote widget placeholder values', () => {
    getNodeImageUrlsMock.mockReturnValue(undefined)

    const node = computed(() => ({
      widgets: [{ name: 'file', value: 'Loading...' }]
    }))

    const { videoUrl } = useLoadVideoPreview(node as never)

    expect(videoUrl.value).toBeUndefined()
    expect(
      nodeHasLoadVideoPreview({
        widgets: [{ name: 'file', value: 'Loading...' }]
      } as never)
    ).toBe(false)
  })
})
