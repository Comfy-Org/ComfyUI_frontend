import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ErrorGroup } from '@/platform/workflowErrors/panel/types'
import type {
  MissingPackGroup,
  SwapNodeGroup
} from '@/platform/workflowErrors/panel/useErrorGroups'
import type { MissingMediaGroup } from '@/platform/workflowErrors/missingMedia/types'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import '@/scripts/changeTracker'
import type { NodeError } from '@comfyorg/api-client/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import { AskAgentPortKey } from '@/platform/workflowErrors/askAgentPort'
import type { AskAgentPort } from '@/platform/workflowErrors/askAgentPort'

import ErrorOverlay from './ErrorOverlay.vue'

const askAgentMock = {
  canAskAgent: ref(true),
  askAgentAboutIssues: vi.fn<AskAgentPort['askAgentAboutIssues']>()
}

const mockErrorGroups = vi.hoisted(() => ({
  allErrorGroups: { value: [] as ErrorGroup[] },
  missingPackGroups: { value: [] as MissingPackGroup[] },
  missingModelGroups: { value: [] as MissingModelGroup[] },
  missingMediaGroups: { value: [] as MissingMediaGroup[] },
  swapNodeGroups: { value: [] as SwapNodeGroup[] }
}))

const mockAllErrorGroups = mockErrorGroups.allErrorGroups

vi.mock<unknown>(
  import('@/platform/workflowErrors/panel/useErrorGroups'),
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
      plugins: [createTestI18n()],
      provide: { [AskAgentPortKey]: askAgentMock }
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
    const { emitted } = renderOverlay()

    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      '1': makeNodeError(['Only error'])
    })
    executionErrorStore.showErrorOverlay()
    await nextTick()

    expect(screen.getByRole('status')).toHaveTextContent('Only error')
    expect(screen.getByRole('status')).not.toHaveTextContent('1 ERROR')
    expect(screen.getByTestId('error-overlay-icon')).toHaveClass('size-5')
    expect(screen.getByTestId('error-overlay-message-spacer')).toHaveClass(
      'size-5'
    )
    expect(screen.getByTestId('error-overlay-see-errors')).toHaveTextContent(
      'View details'
    )
    expect(screen.getByTestId('error-overlay-dismiss')).toHaveAccessibleName(
      'Close'
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View details' }))
    expect(emitted('viewErrors')).toEqual([[['execution:KSampler']]])
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

  it('labels the toast chip with the toast title, not the group title', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'missing_media',
        severity: 'missing',
        groupKey: 'missing_media',
        displayTitle: 'Missing Inputs',
        toastTitle: 'Media input missing',
        toastMessage: 'Load image is missing a required media file.',
        count: 1,
        priority: 0,
        blockedLastRun: false
      }
    ]
    mockErrorGroups.missingMediaGroups.value = [
      {
        mediaType: 'image',
        items: [
          {
            name: 'portrait.png',
            mediaType: 'image',
            representative: {
              nodeId: '3',
              nodeType: 'LoadImage',
              widgetName: 'image',
              mediaType: 'image',
              name: 'portrait.png',
              isMissing: true
            },
            referencingNodes: [
              { nodeId: '3', nodeType: 'LoadImage', widgetName: 'image' }
            ]
          }
        ]
      }
    ]
    renderOverlay()
    useExecutionErrorStore().showErrorOverlay()
    await nextTick()

    const askAgent = screen.getByTestId('error-overlay-ask-agent')
    askAgent.click()
    await nextTick()

    const [context] = askAgentMock.askAgentAboutIssues.mock.calls.at(-1)!
    expect(context.label).toBe('Media input missing')
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

  it('shows a filled error icon for an execution failure', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        severity: 'error',
        groupKey: 'execution:KSampler',
        displayTitle: 'Execution failed',
        count: 1,
        priority: 0,
        blockedLastRun: false,
        cards: [{ id: '1', title: 'KSampler', errors: [{ message: 'boom' }] }]
      }
    ]
    renderOverlay()
    useExecutionErrorStore().showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('error-overlay-icon').className).toContain(
      'icon-[comfy--circle-alert-filled]'
    )
  })

  it('shows a filled warning icon for a missing input', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'missing_media',
        severity: 'missing',
        groupKey: 'missing_media',
        displayTitle: 'Missing Inputs',
        count: 1,
        priority: 0,
        blockedLastRun: false
      }
    ]
    renderOverlay()
    useExecutionErrorStore().showErrorOverlay()
    await nextTick()

    expect(screen.getByTestId('error-overlay-icon')).toHaveClass(
      'icon-[comfy--triangle-alert-filled]',
      'text-warning-background',
      'size-5'
    )
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

  it('scopes view details to the toast groups', async () => {
    mockAllErrorGroups.value = [
      {
        type: 'execution',
        severity: 'error',
        groupKey: 'execution:missing_connection',
        displayTitle: 'Missing connection',
        count: 1,
        priority: 0,
        blockedLastRun: false,
        cards: [
          {
            id: '1',
            title: 'KSampler',
            errors: [{ message: 'Required input is missing' }]
          }
        ]
      },
      {
        type: 'missing_node',
        severity: 'missing',
        groupKey: 'missing_node',
        displayTitle: 'Missing nodes',
        count: 1,
        priority: 1,
        blockedLastRun: false
      }
    ]
    const { emitted } = renderOverlay()
    useExecutionErrorStore().showErrorOverlay()
    await nextTick()

    await userEvent
      .setup()
      .click(screen.getByTestId('error-overlay-see-errors'))

    expect(emitted('viewErrors')).toEqual([
      [['execution:missing_connection', 'missing_node']]
    ])
  })
})
