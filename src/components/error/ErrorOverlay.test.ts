import { createPinia, setActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import ErrorOverlay from './ErrorOverlay.vue'
import { asNodeId } from '@/lib/litegraph/src/litegraph'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import type { NodeError } from '@/schemas/apiSchema'
import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'

const mockAllErrorGroups = vi.hoisted(() => ({ value: [] as ErrorGroup[] }))

vi.mock('@/components/rightSidePanel/errors/useErrorGroups', () => ({
  useErrorGroups: () => ({ allErrorGroups: mockAllErrorGroups })
}))

vi.mock('@/composables/graph/useNodeErrorFlagSync', () => ({
  useNodeErrorFlagSync: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    isGraphReady: false,
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: vi.fn((id: string) => id),
  getActiveGraphNodeIds: vi.fn(() => new Set()),
  getExecutionIdByNode: vi.fn(),
  getNodeByExecutionId: vi.fn()
}))

const mockOpenPanel = vi.hoisted(() => vi.fn())
vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({ openPanel: mockOpenPanel })
}))

const mockCanvasStore = vi.hoisted(() => ({
  linearMode: false,
  canvas: null,
  currentGraph: null,
  updateSelectedItems: vi.fn()
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          close: 'Close',
          dismiss: 'Dismiss'
        },
        errorOverlay: {
          errorCount: '{count} ERROR | {count} ERRORS',
          multipleErrorCount: '{count} error found | {count} errors found',
          multipleErrorsMessage: 'Resolve them before running the workflow.',
          viewDetails: 'View details'
        },
        linearMode: {
          error: {
            goto: 'Show errors in graph'
          }
        }
      }
    }
  })
}

function makeNodeError(messages: string[]): NodeError {
  return {
    class_type: 'KSampler',
    dependent_outputs: [],
    errors: messages.map((message) => ({
      type: 'execution_error',
      message,
      details: 'details'
    }))
  }
}

function renderOverlay(props: { appMode?: boolean } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  return render(ErrorOverlay, {
    props,
    global: {
      plugins: [pinia, createTestI18n()],
      stubs: {
        Button: {
          template: '<button v-bind="$attrs"><slot /></button>'
        }
      }
    }
  })
}

describe('ErrorOverlay', () => {
  beforeEach(() => {
    mockAllErrorGroups.value = []
    mockOpenPanel.mockClear()
    mockCanvasStore.linearMode = false
    mockCanvasStore.canvas = null
    mockCanvasStore.currentGraph = null
    mockCanvasStore.updateSelectedItems.mockClear()
  })

  it('renders a single overlay message without list markup', async () => {
    renderOverlay()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      [asNodeId('1')]: makeNodeError(['Only error'])
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'Only error' }]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByRole('status')).toHaveTextContent('Only error')
    expect(screen.getByRole('status')).not.toHaveTextContent('1 ERROR')
    expect(screen.getByTestId('error-overlay-see-errors')).toHaveTextContent(
      'View details'
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('keeps the app mode button label', async () => {
    renderOverlay({ appMode: true })

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.lastNodeErrors = {
      [asNodeId('1')]: makeNodeError(['Only error'])
    }
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        priority: 0,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'Only error' }]
          }
        ]
      }
    ]
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('error-overlay-see-errors')).toHaveTextContent(
      'Show errors in graph'
    )
  })
})
