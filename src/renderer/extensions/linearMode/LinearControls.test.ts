import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeError } from '@/schemas/apiSchema'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import { LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID } from '@/renderer/extensions/linearMode/linearRunErrorWarningIds'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { toNodeId } from '@/types/nodeId'

const billingMock = vi.hoisted(() => ({
  canRunWorkflows: true
}))

const overlayMock = vi.hoisted(() => ({
  overlayMessage: 'KSampler is missing a required input: model',
  overlayTitle: 'Required input missing'
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canRunWorkflows: billingMock.canRunWorkflows
  })
}))

vi.mock('@/components/error/useErrorOverlayState', () => ({
  useErrorOverlayState: () => ({
    overlayMessage: overlayMock.overlayMessage,
    overlayTitle: overlayMock.overlayTitle
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      linearMode: {
        error: {
          goto: 'Show errors in graph'
        },
        mobileNoWorkflow: 'No workflow',
        runCount: 'Run count',
        viewJob: 'View job'
      },
      menu: {
        run: 'Run'
      },
      menuLabels: {
        publish: 'Publish'
      },
      queue: {
        jobAddedToQueue: 'Job added to queue',
        jobQueueing: 'Queueing'
      }
    }
  }
})

const nodeErrors: Record<string, NodeError> = {
  '1': {
    class_type: 'TestNode',
    dependent_outputs: [],
    errors: [
      {
        type: 'required_input_missing',
        message: 'Missing input',
        details: '',
        extra_info: { input_name: 'prompt' }
      }
    ]
  }
}

function renderControls({
  hasError = false,
  canRunWorkflows = true,
  mobile = false
}: {
  hasError?: boolean
  canRunWorkflows?: boolean
  mobile?: boolean
} = {}) {
  billingMock.canRunWorkflows = canRunWorkflows

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false
  })
  setActivePinia(pinia)

  useAppModeStore().selectedOutputs = [toNodeId(1)]
  if (hasError) {
    useExecutionErrorStore().recordNodeErrors(nodeErrors)
  }

  const toastTarget = document.createElement('div')

  return render(LinearControls, {
    props: { mobile, toastTo: toastTarget },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        AppModeWidgetList: true,
        Loader: true,
        PartnerNodesList: true,
        Popover: {
          template: '<div><slot name="button" /><slot /></div>'
        },
        ScrubableNumberInput: true,
        SubscribeToRunButton: true
      }
    }
  })
}

describe('LinearControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    billingMock.canRunWorkflows = true
    overlayMock.overlayMessage = 'KSampler is missing a required input: model'
    overlayMock.overlayTitle = 'Required input missing'
  })

  it.for([
    { label: 'desktop', mobile: false },
    { label: 'mobile', mobile: true }
  ])('shows a workflow error warning in $label controls', ({ mobile }) => {
    renderControls({ hasError: true, mobile })

    const warning = screen.getByRole('status')
    expect(
      within(warning).getByText('Required input missing')
    ).toBeInTheDocument()
    expect(
      within(warning).getByText('KSampler is missing a required input: model')
    ).toBeInTheDocument()
    expect(
      within(warning).getByRole('button', { name: 'Show errors in graph' })
    ).toBeInTheDocument()
    expect(within(warning).queryByLabelText('Close')).not.toBeInTheDocument()
    const runButton = screen.getByRole('button', { name: 'Run' })
    expect(runButton).toHaveAttribute(
      'aria-describedby',
      LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID
    )
    const description = screen.getByTestId(
      'linear-validation-warning-description'
    )
    expect(description).toHaveAttribute(
      'id',
      LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID
    )
    expect(description).toHaveTextContent('Required input missing')
    expect(description).toHaveTextContent(
      'KSampler is missing a required input: model'
    )
    expect(description).not.toHaveTextContent('Show errors in graph')
  })

  it.for([
    { label: 'desktop', mobile: false },
    { label: 'mobile', mobile: true }
  ])(
    'does not show the workflow error warning in $label controls without graph errors',
    ({ mobile }) => {
      renderControls({ mobile })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Show errors in graph' })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Run' })).not.toHaveAttribute(
        'aria-describedby'
      )
    }
  )

  it.for([
    { label: 'desktop', mobile: false },
    { label: 'mobile', mobile: true }
  ])(
    'does not show the workflow error warning in $label controls without an active subscription',
    ({ mobile }) => {
      renderControls({
        hasError: true,
        canRunWorkflows: false,
        mobile
      })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    }
  )

  it('does not show the warning when the error copy is empty', () => {
    overlayMock.overlayMessage = ''

    renderControls({ hasError: true })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).not.toHaveAttribute(
      'aria-describedby'
    )
  })
})
