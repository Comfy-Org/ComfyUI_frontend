import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'
import type {
  MissingPackGroup,
  SwapNodeGroup
} from '@/components/rightSidePanel/errors/useErrorGroups'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import '@/scripts/changeTracker'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeError } from '@/platform/remote/comfyui/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import ErrorOverlay from './ErrorOverlay.vue'

const askAgentMock = vi.hoisted(() => ({
  canAskAgent: undefined as unknown as { value: boolean },
  askAgentAboutIssues: vi.fn()
}))

vi.mock<unknown>(
  import('@/workbench/extensions/agent/composables/agent/useAskAgentAboutIssues'),
  async () => {
    const { ref } = await import('vue')
    askAgentMock.canAskAgent = ref(true)
    return {
      useAskAgentAboutIssues: () => ({
        canAskAgent: askAgentMock.canAskAgent,
        askAgentAboutIssues: askAgentMock.askAgentAboutIssues
      })
    }
  }
)

const mockErrorGroups = vi.hoisted(() => ({
  allErrorGroups: { value: [] as ErrorGroup[] },
  missingPackGroups: { value: [] as MissingPackGroup[] },
  missingModelGroups: { value: [] as MissingModelGroup[] },
  missingMediaGroups: { value: [] as MissingMediaGroup[] },
  swapNodeGroups: { value: [] as SwapNodeGroup[] }
}))

const mockAllErrorGroups = mockErrorGroups.allErrorGroups

vi.mock<unknown>(
  import('@/components/rightSidePanel/errors/useErrorGroups'),
  () => ({
    useErrorGroups: () => mockErrorGroups
  })
)

vi.mock(import('@/composables/graph/useNodeErrorFlagSync'), () => ({
  useNodeErrorFlagSync: vi.fn()
}))

vi.mock(import('@/scripts/app'))

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  executionIdToNodeLocatorId: vi.fn((id: string) => id),
  getActiveGraphNodeIds: vi.fn(() => new Set()),
  getExecutionIdByNode: vi.fn(),
  getNodeByExecutionId: vi.fn()
}))

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          close: 'Close',
          dismiss: 'Dismiss',
          error: 'Error',
          warning: 'Warning'
        },
        errorOverlay: {
          multipleIssueCount: '{count} issue found | {count} issues found',
          multipleIssuesMessage:
            'Resolve these issues before running the workflow.',
          viewDetails: 'View details',
          askAgent: 'Ask agent'
        },
        agent: {
          errorContext: {
            allLabel: 'All issues'
          }
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
  return render(ErrorOverlay, {
    props,
    global: {
      plugins: [createTestI18n()]
    }
  })
}

describe('ErrorOverlay', () => {
  beforeEach(() => {
    mockAllErrorGroups.value = []
    mockErrorGroups.missingPackGroups.value = []
    mockErrorGroups.missingModelGroups.value = []
    mockErrorGroups.missingMediaGroups.value = []
    mockErrorGroups.swapNodeGroups.value = []
    askAgentMock.canAskAgent.value = true
    askAgentMock.askAgentAboutIssues.mockClear()
    useCanvasStore().linearMode = false
    useCanvasStore().canvas = null
    useCanvasStore().currentGraph = null
  })

  it.for([
    {
      group: { type: 'missing_model', severity: 'missing' } as const,
      label: 'Warning'
    },
    {
      group: {
        type: 'execution' as const,
        severity: 'error' as const,
        cards: []
      },
      label: 'Error'
    }
  ])('announces $label with aggregate issue copy', ({ group, label }) => {
    mockAllErrorGroups.value = [
      {
        type: 'missing_media',
        severity: 'missing',
        groupKey: 'missing_media',
        displayTitle: 'Missing media',
        count: 1,
        priority: 0,
        blockedLastRun: false
      },
      {
        ...group,
        groupKey: group.type,
        displayTitle: 'Another issue',
        count: 1,
        priority: 0,
        blockedLastRun: false
      }
    ]
    useExecutionErrorStore().showErrorOverlay()
    renderOverlay()

    expect(screen.getByRole('status')).toHaveTextContent('2 issues found')
    expect(screen.getByRole('status')).toContainElement(screen.getByText(label))
  })

  it('renders a single overlay message without list markup', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        severity: 'error',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        count: 1,
        priority: 0,
        blockedLastRun: false,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'Only error' }]
          }
        ]
      }
    ]
    renderOverlay()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Only error'])
    })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByRole('status')).toHaveTextContent('Only error')
    expect(screen.getByRole('status')).not.toHaveTextContent('1 ERROR')
    expect(screen.getByTestId('error-overlay-see-errors')).toHaveTextContent(
      'View details'
    )
    expect(screen.getByTestId('error-overlay-dismiss')).toHaveAccessibleName(
      'Close'
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('hands the toast error to the agent without sending when enabled', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        severity: 'error',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        count: 1,
        priority: 0,
        blockedLastRun: false,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            graphNodeId: '1',
            errors: [{ message: 'Only error' }]
          }
        ]
      }
    ]
    renderOverlay()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({ '1': makeNodeError(['Only error']) })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    const askAgent = screen.getByTestId('error-overlay-ask-agent')
    expect(askAgent).toHaveTextContent('Ask agent')
    askAgent.click()
    await nextTick()

    expect(askAgentMock.askAgentAboutIssues).toHaveBeenCalledTimes(1)
    const [context] = askAgentMock.askAgentAboutIssues.mock.calls[0]
    expect(context).toMatchObject({
      scope: 'card',
      label: 'Execution failed',
      severity: 'error'
    })
    expect(context.problems[0]).toMatchObject({
      category: 'validation',
      message: 'Only error'
    })
  })

  it('omits the Ask agent toast action when the agent is unavailable', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        severity: 'error',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        count: 1,
        priority: 0,
        blockedLastRun: false,
        cards: [
          { id: '1', title: 'KSampler', errors: [{ message: 'Only error' }] }
        ]
      }
    ]
    askAgentMock.canAskAgent.value = false
    renderOverlay()
    useExecutionErrorStore().showErrorOverlay()
    await nextTick()

    expect(screen.queryByTestId('error-overlay-ask-agent')).toBeNull()
  })

  it('keeps the app mode button label', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        severity: 'error',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        count: 1,
        priority: 0,
        blockedLastRun: false,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'Only error' }]
          }
        ]
      }
    ]
    renderOverlay({ appMode: true })

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Only error'])
    })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('error-overlay-see-errors')).toHaveTextContent(
      'Show errors in graph'
    )
  })
})
