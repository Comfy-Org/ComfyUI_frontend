import { createTestingPinia } from '@pinia/testing'
import type { TestingPinia } from '@pinia/testing'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

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

vi.mock('@/composables/canvas/useFocusNode', () => ({
  useFocusNode: vi.fn(() => ({
    focusNode: vi.fn()
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

const SAMPLER_NODE = { id: '1', title: 'SamplerNode' }
const LOADER_NODE = { id: '2', title: 'LoaderNode' }

function seedTwoErrorGroups(pinia: TestingPinia) {
  const executionErrorStore = useExecutionErrorStore(pinia)
  executionErrorStore.lastNodeErrors = fromAny<
    typeof executionErrorStore.lastNodeErrors,
    unknown
  >({
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
        { type: 'weird_error', message: 'Something odd happened', details: '' }
      ]
    }
  })
}

function renderList(pinia: TestingPinia) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: { untitled: 'Untitled' },
        rightSidePanel: {
          noErrors: 'No errors',
          noneSearchDesc: 'No results found',
          errorsDetected: 'Error detected | Errors detected',
          selectedNodeErrors:
            '{node} — {count} error | {node} — {count} errors',
          selectedNodesErrors:
            '{nodes} nodes selected — {count} error | {nodes} nodes selected — {count} errors',
          resolveBeforeRun: 'Resolve before running the workflow',
          expand: 'Expand',
          collapse: 'Collapse',
          infoFor: 'Info for {item}',
          locateNodeFor: 'Locate {item}'
        }
      }
    }
  })

  const user = userEvent.setup()
  render(ErrorGroupList, {
    global: {
      plugins: [PrimeVue, i18n, pinia],
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
    vi.clearAllMocks()
    vi.mocked(isLGraphNode).mockReturnValue(true)
    vi.mocked(getNodeByExecutionId).mockImplementation((_, nodeId) =>
      fromAny<LGraphNode, unknown>(
        String(nodeId) === '1' ? SAMPLER_NODE : LOADER_NODE
      )
    )
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

  it('applies emphasis for a selection that predates mount', async () => {
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
      expect(
        screen.queryByTestId('selection-context-strip')
      ).not.toBeInTheDocument()
    })
    expect(isSectionExpanded(loaderSection)).toBe(false)
    expect(isSectionExpanded(getSectionByTitle('Missing connection'))).toBe(
      true
    )
  })

  it('shows the node title and error count in the context strip', async () => {
    const pinia = createPinia()
    seedTwoErrorGroups(pinia)
    renderList(pinia)
    const canvasStore = useCanvasStore(pinia)

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE])

    const strip = await screen.findByTestId('selection-context-strip')
    expect(strip).toHaveTextContent('SamplerNode — 1 error')

    canvasStore.selectedItems = fromAny<
      typeof canvasStore.selectedItems,
      unknown
    >([SAMPLER_NODE, LOADER_NODE])
    await waitFor(() => {
      expect(strip).toHaveTextContent('2 nodes selected — 2 errors')
    })
  })
})
