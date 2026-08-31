import { createTestingPinia } from '@pinia/testing'
import type { TestingPinia } from '@pinia/testing'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { isLGraphNode } from '@/utils/litegraphUtil'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { fromAny } from '@total-typescript/shoehorn'

import ErrorGroupList from './ErrorGroupList.vue'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: vi.fn(),
  getExecutionIdByNode: vi.fn(),
  getRootParentNode: vi.fn(() => null),
  forEachNode: vi.fn(),
  mapAllNodes: vi.fn(() => [])
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => false)
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: vi.fn(() => ({
    copyToClipboard: vi.fn()
  }))
}))

vi.mock('@/platform/missingModel/missingModelDownload', () => ({
  downloadModel: vi.fn(),
  fetchModelMetadata: vi.fn().mockResolvedValue({
    fileSize: null,
    gatedRepoUrl: null
  }),
  isModelDownloadable: vi.fn(() => true),
  toBrowsableUrl: vi.fn((url: string) => url)
}))

const ROOT_GRAPH = { isRootGraph: true }
const SUBGRAPH = { isRootGraph: false }
const SAMPLER_BOUNDS = [10, 20, 30, 40] as const
const LOADER_BOUNDS = [50, 60, 70, 80] as const
const SAMPLER_NODE = {
  id: '1',
  title: 'SamplerNode',
  graph: ROOT_GRAPH,
  boundingRect: SAMPLER_BOUNDS
}
const LOADER_NODE = {
  id: '2',
  title: 'LoaderNode',
  graph: ROOT_GRAPH,
  boundingRect: LOADER_BOUNDS
}

function seedTwoErrorGroups(pinia: TestingPinia) {
  const executionErrorStore = useExecutionErrorStore(pinia)
  executionErrorStore.recordNodeErrors({
    '1': {
      class_type: 'KSampler',
      dependent_outputs: [],
      errors: [
        {
          type: 'required_input_missing',
          message: 'Required input is missing',
          details: '',
          extra_info: { input_name: 'clip' }
        }
      ]
    },
    '2': {
      class_type: 'CLIPLoader',
      dependent_outputs: [],
      errors: [
        {
          type: 'weird_error',
          message: 'Something odd happened',
          details: ''
        }
      ]
    }
  })
}

function renderList(pinia: TestingPinia) {
  const user = userEvent.setup()
  render(ErrorGroupList, {
    global: {
      plugins: [PrimeVue, testI18n, pinia],
      stubs: {
        AsyncSearchInput: {
          template: '<input />'
        }
      }
    }
  })
  return { user }
}

function createPinia() {
  return createTestingPinia({ createSpy: vi.fn, stubActions: false })
}

function createCanvasFixture(pinia: TestingPinia, graph = ROOT_GRAPH) {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 900
  canvasElement.height = 700
  const canvas = {
    graph,
    subgraph: undefined,
    canvas: canvasElement,
    setGraph: vi.fn((nextGraph) => {
      canvas.graph = nextGraph
    }),
    animateToBounds: vi.fn()
  }
  useCanvasStore(pinia).canvas = fromAny(canvas)
  return canvas
}

function getSectionByTitle(title: string) {
  const sections = screen.getAllByTestId('error-group-execution')
  const section = sections.find((s) => within(s).queryByText(title))
  expect(section).toBeDefined()
  return section!
}

function isSectionExpanded(section: HTMLElement) {
  const [header] = within(section).getAllByRole('button', { hidden: true })
  return header.getAttribute('aria-expanded') === 'true'
}

describe('ErrorGroupList selection emphasis', () => {
  beforeEach(() => {
    vi.mocked(isLGraphNode).mockReturnValue(true)
    vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
      fromAny<LGraphNode, unknown>(
        String(nodeId) === '1'
          ? {
              ...SAMPLER_NODE,
              graph: ROOT_GRAPH,
              boundingRect: SAMPLER_BOUNDS
            }
          : {
              ...LOADER_NODE,
              graph: ROOT_GRAPH,
              boundingRect: LOADER_BOUNDS
            }
      )
    )
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
  })

  it('expands matched groups, collapses others, and restores on deselect', async () => {
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    renderList(pinia)
    const canvasStore = useCanvasStore(pinia)

    const samplerSection = getSectionByTitle('Missing connection')
    const loaderSection = getSectionByTitle('Validation failed')
    expect(isSectionExpanded(samplerSection)).toBe(true)
    expect(isSectionExpanded(loaderSection)).toBe(true)

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE])
    await waitFor(() => {
      expect(isSectionExpanded(loaderSection)).toBe(false)
    })
    expect(isSectionExpanded(samplerSection)).toBe(true)

    canvasStore.selectedItems = []
    await waitFor(() => {
      expect(isSectionExpanded(loaderSection)).toBe(true)
    })
    expect(isSectionExpanded(samplerSection)).toBe(true)
  })

  it('expands only matched groups for a selection that predates mount', async () => {
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    const canvasStore = useCanvasStore(pinia)
    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE])

    renderList(pinia)

    await waitFor(() => {
      expect(isSectionExpanded(getSectionByTitle('Validation failed'))).toBe(
        false
      )
    })
    expect(isSectionExpanded(getSectionByTitle('Missing connection'))).toBe(
      true
    )
  })

  it('leaves manual collapse state alone for selections without errors', async () => {
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    const { user } = renderList(pinia)
    const canvasStore = useCanvasStore(pinia)

    const loaderSection = getSectionByTitle('Validation failed')
    const [loaderHeader] = within(loaderSection).getAllByRole('button')
    await user.click(loaderHeader)
    expect(isSectionExpanded(loaderSection)).toBe(false)

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([{ id: '99', title: 'Unrelated' }])
    await waitFor(() => {
      // No emphasis: the strip falls back to the workflow summary
      expect(screen.getByTestId('selection-context-strip')).toHaveTextContent(
        '2 nodes — 2 errors'
      )
    })
    expect(isSectionExpanded(loaderSection)).toBe(false)
    expect(isSectionExpanded(getSectionByTitle('Missing connection'))).toBe(
      true
    )
  })

  it('always shows the strip: workflow summary by default, selection while emphasized', async () => {
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    renderList(pinia)
    const canvasStore = useCanvasStore(pinia)

    const strip = screen.getByTestId('selection-context-strip')
    expect(strip).toHaveTextContent('2 nodes — 2 errors')

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE])
    await waitFor(() => {
      expect(strip).toHaveTextContent('SamplerNode — 1 issue')
    })

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE, LOADER_NODE])
    await waitFor(() => {
      expect(strip).toHaveTextContent('2 nodes selected — 2 issues')
    })

    canvasStore.selectedItems = []
    await waitFor(() => {
      expect(strip).toHaveTextContent('2 nodes — 2 errors')
    })
  })

  it('labels a missing-only selection as an issue', async () => {
    const pinia = createPinia()
    useMissingModelStore(pinia).setMissingModels([
      {
        nodeId: '1',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        name: 'missing.safetensors',
        isMissing: true,
        isAssetSupported: false
      }
    ])
    renderList(pinia)
    const canvasStore = useCanvasStore(pinia)

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE])

    const strip = screen.getByTestId('selection-context-strip')
    await waitFor(() => {
      expect(strip).toHaveTextContent('SamplerNode — 1 issue')
    })
    expect(strip).not.toHaveTextContent(/\berrors?\b/i)
  })

  it('preserves special characters in execution item accessible names', () => {
    const nodeDisplayName = 'A & B <C>'
    vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
      fromAny<LGraphNode, unknown>(
        String(nodeId) === '1'
          ? { ...SAMPLER_NODE, title: nodeDisplayName }
          : LOADER_NODE
      )
    )
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)

    renderList(pinia)

    expect(
      screen.getByRole('button', { name: /Info for A & B <C>/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Locate A & B <C>/ })
    ).toBeInTheDocument()
    expect(screen.queryAllByLabelText(/&(?:amp|lt|gt);/)).toHaveLength(0)
  })

  it('locates an execution error through the real root-graph focus path', async () => {
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    const { user } = renderList(pinia)
    const canvas = createCanvasFixture(pinia, ROOT_GRAPH)

    await user.click(screen.getByRole('button', { name: 'SamplerNode - clip' }))

    expect(canvas.setGraph).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(canvas.animateToBounds).toHaveBeenCalledWith(SAMPLER_BOUNDS, {
        viewport: [0, 0, 900, 700]
      })
    })
  })

  it('locates an execution error through the real subgraph navigation path', async () => {
    vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
      fromAny<LGraphNode, unknown>(
        String(nodeId) === '2'
          ? {
              ...LOADER_NODE,
              graph: SUBGRAPH,
              boundingRect: LOADER_BOUNDS
            }
          : SAMPLER_NODE
      )
    )
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    const { user } = renderList(pinia)
    const canvas = createCanvasFixture(pinia, ROOT_GRAPH)

    await user.click(screen.getByRole('button', { name: 'LoaderNode' }))

    await waitFor(() => {
      expect(canvas.subgraph).toBe(SUBGRAPH)
      expect(canvas.setGraph).toHaveBeenCalledWith(SUBGRAPH)
      expect(canvas.animateToBounds).toHaveBeenCalledWith(LOADER_BOUNDS, {
        viewport: [0, 0, 900, 700]
      })
    })
  })
})
