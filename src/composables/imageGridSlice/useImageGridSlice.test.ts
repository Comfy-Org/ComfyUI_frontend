import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { useImageGridSlice } from './useImageGridSlice'

const mockWidgets: IBaseWidget[] = []
const mockIsInputConnected = vi.fn(() => false)
const mockGetInputNode = vi.fn(() => null as unknown)
const mockGetNodeImageUrls = vi.fn(() => undefined as string[] | undefined)

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    getNodeImageUrls: mockGetNodeImageUrls,
    nodeOutputs: {},
    nodePreviewImages: {}
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: {
        getNodeById: vi.fn(() => ({
          get widgets() {
            return mockWidgets
          },
          isInputConnected: mockIsInputConnected,
          getInputNode: mockGetInputNode
        }))
      }
    }
  }
}))

function makeWidget(name: string, value: unknown): IBaseWidget {
  return { name, value } as unknown as IBaseWidget
}

type Result = ReturnType<typeof useImageGridSlice>

function mount(nodeId = 'node-1') {
  let result!: Result
  const Wrapper = defineComponent({
    setup() {
      result = useImageGridSlice(nodeId)
      return {}
    },
    render: () => null
  })
  render(Wrapper)
  return result
}

describe('useImageGridSlice', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockWidgets.length = 0
    mockIsInputConnected.mockReturnValue(false)
    mockGetInputNode.mockReturnValue(null)
    mockGetNodeImageUrls.mockReturnValue(undefined)
  })

  it('derives split line fractions from rows and columns widgets', () => {
    mockWidgets.push(makeWidget('rows', 3), makeWidget('columns', 4))

    const result = mount()

    expect(result.rows.value).toBe(3)
    expect(result.columns.value).toBe(4)
    expect(result.horizontalLines.value).toEqual([1 / 3, 2 / 3])
    expect(result.verticalLines.value).toEqual([1 / 4, 2 / 4, 3 / 4])
  })

  it('produces no split lines for a 1x1 grid', () => {
    mockWidgets.push(makeWidget('rows', 1), makeWidget('columns', 1))

    const result = mount()

    expect(result.horizontalLines.value).toEqual([])
    expect(result.verticalLines.value).toEqual([])
  })

  it('clamps grid counts to the supported range', () => {
    mockWidgets.push(makeWidget('rows', 99), makeWidget('columns', 0))

    const result = mount()

    expect(result.rows.value).toBe(16)
    expect(result.columns.value).toBe(1)
  })

  it('resolves the input image url from the upstream node output', () => {
    mockIsInputConnected.mockReturnValue(true)
    const upstream = {}
    mockGetInputNode.mockReturnValue(upstream)
    mockGetNodeImageUrls.mockReturnValue(['http://localhost/view?img=1'])

    const result = mount()

    expect(result.isImageInputConnected.value).toBe(true)
    expect(result.inputImageUrl.value).toBe('http://localhost/view?img=1')
  })

  it('leaves the preview empty when no upstream node is connected', () => {
    const result = mount()

    expect(result.isImageInputConnected.value).toBe(false)
    expect(result.inputImageUrl.value).toBeNull()
  })
})
