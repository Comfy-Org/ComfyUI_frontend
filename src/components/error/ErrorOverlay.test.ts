import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { ErrorGroup } from '@/components/rightSidePanel/errors/types'
import type {
  MissingPackGroup,
  SwapNodeGroup
} from '@/components/rightSidePanel/errors/useErrorGroups'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { OUT_OF_MEMORY_CATALOG_ID } from '@/platform/errorCatalog/catalogIds'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import '@/scripts/changeTracker'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openDeploySetupDialog'
import type { NodeError } from '@/platform/remote/comfyui/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

import ErrorOverlay from './ErrorOverlay.vue'

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

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/openOnCloud/openDeploySetupDialog'), () => ({
  openDeploySetupDialog: vi.fn(async () => {})
}))

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
          viewDetails: 'View details'
        },
        linearMode: {
          error: {
            goto: 'Show errors in graph'
          }
        },
        openOnCloud: {
          deploySetup: 'Deploy your setup to Comfy Cloud',
          outOfMemoryTooltip: 'Runs it on a GPU with more memory.'
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

function executionGroup(catalogId: string): ErrorGroup {
  return {
    type: 'execution',
    severity: 'error',
    groupKey: `execution:${catalogId}`,
    displayTitle: 'Generation failed',
    count: 1,
    priority: 0,
    blockedLastRun: false,
    cards: [
      {
        id: '1',
        title: 'KSampler',
        errors: [{ message: 'Not enough GPU memory.', catalogId }]
      }
    ]
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

  it.for([
    {
      error: 'an out-of-memory error on local',
      catalogId: OUT_OF_MEMORY_CATALOG_ID,
      offered: true
    },
    { error: 'any other error', catalogId: 'invalid_prompt', offered: false },
    {
      error: 'an out-of-memory error while the flag is off',
      catalogId: OUT_OF_MEMORY_CATALOG_ID,
      flag: false,
      offered: false
    },
    {
      error: 'an out-of-memory error on Comfy Cloud',
      catalogId: OUT_OF_MEMORY_CATALOG_ID,
      isCloud: true,
      offered: false
    }
  ])(
    'offers Deploy your setup to Comfy Cloud ($offered) for $error',
    ({ catalogId, flag = true, isCloud = false, offered }) => {
      distribution.isCloud = isCloud
      onTestFinished(() => {
        distribution.isCloud = false
      })
      vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = flag
      mockAllErrorGroups.value = [executionGroup(catalogId)]
      useExecutionErrorStore().showErrorOverlay()

      renderOverlay()

      expect(
        screen.queryByRole('button', {
          name: 'Deploy your setup to Comfy Cloud'
        }) !== null
      ).toBe(offered)
    }
  )

  it('opens the Deploy your setup dialog from an out-of-memory error', async () => {
    vi.mocked(useFeatureFlags().flags).openOnCloudEnabled = true
    mockAllErrorGroups.value = [executionGroup(OUT_OF_MEMORY_CATALOG_ID)]
    useExecutionErrorStore().showErrorOverlay()
    renderOverlay()

    await userEvent.click(
      screen.getByRole('button', { name: 'Deploy your setup to Comfy Cloud' })
    )

    expect(openDeploySetupDialog).toHaveBeenCalledOnce()
  })
})
