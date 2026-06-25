import { createTestingPinia } from '@pinia/testing'
import { render, screen, within } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeError } from '@/schemas/apiSchema'
import LinearControls from '@/renderer/extensions/linearMode/LinearControls.vue'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const billingMock = vi.hoisted(() => ({
  isActiveSubscription: true
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: billingMock.isActiveSubscription
  })
}))

vi.mock('@/components/error/useErrorOverlayState', () => ({
  useErrorOverlayState: () => ({
    overlayMessage: 'KSampler is missing a required input: model',
    overlayTitle: 'Required input missing'
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
  isActiveSubscription = true,
  mobile = false
}: {
  hasError?: boolean
  isActiveSubscription?: boolean
  mobile?: boolean
} = {}) {
  billingMock.isActiveSubscription = isActiveSubscription

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false
  })
  setActivePinia(pinia)

  useAppModeStore().selectedOutputs = [1]
  if (hasError) {
    useExecutionErrorStore().lastNodeErrors = nodeErrors
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
    billingMock.isActiveSubscription = true
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
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute(
      'aria-describedby',
      'linear-run-error-warning'
    )
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
        isActiveSubscription: false,
        mobile
      })

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    }
  )
})
