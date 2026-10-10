import type { RetentionFlowResponse } from '@comfyorg/ingest-types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { BillingType } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import type { BillingRail } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import type { CancellationFlowDialogOptions } from './launchCancellationFlow'
import {
  launchCancellationFlow,
  recordRetentionFlowEvent
} from './launchCancellationFlow'

const mocks = vi.hoisted(
  (): {
    billingType: { value: BillingType }
    activeWorkspaceId: string | null
    isPersonal: boolean
    billingRail: BillingRail | null
  } => ({
    billingType: { value: 'workspace' },
    activeWorkspaceId: 'workspace-1',
    isPersonal: true,
    billingRail: 'stripe'
  })
)

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/i18n'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

const offer = {
  id: 'save_30_next_3_v1',
  percent_off: 30,
  duration_in_months: 3
}

function retentionFlow(
  overrides: Partial<RetentionFlowResponse> = {}
): RetentionFlowResponse {
  return {
    session_id: '00000000-0000-4000-8000-000000000001',
    expires_at: 2_000_000_000,
    subscription: {
      currency: 'usd',
      unit_amount: 2000,
      quantity: 1,
      period_end: 2_000_000_000
    },
    ...overrides
  }
}

function captureFlow() {
  const shown: CancellationFlowDialogOptions[] = []
  const showFlow = vi.fn((options: CancellationFlowDialogOptions) => {
    shown.push(options)
  })
  return { shown, showFlow }
}

beforeEach(() => {
  const billing = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue(billing)
  billing.type = computed(() => mocks.billingType.value)
  mocks.billingType.value = 'workspace'
  mocks.activeWorkspaceId = 'workspace-1'
  mocks.isPersonal = true
  mocks.billingRail = 'stripe'
  remoteConfig.value = { cancellation_survey_id: 'survey-1' }

  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspaceId',
    'get'
  ).mockImplementation(() => mocks.activeWorkspaceId)
  vi.spyOn(
    useTeamWorkspaceStore(),
    'isInPersonalWorkspace',
    'get'
  ).mockImplementation(() => mocks.isPersonal)
  vi.spyOn(
    useTeamWorkspaceStore(),
    'activeWorkspaceBillingRail',
    'get'
  ).mockImplementation(() => mocks.billingRail)
})

afterEach(() => {
  remoteConfig.value = {}
})

describe('launchCancellationFlow', () => {
  it.for([
    {
      name: 'legacy billing',
      billingType: 'legacy',
      isPersonal: true,
      billingRail: 'stripe'
    },
    {
      name: 'Metronome billing',
      billingType: 'workspace',
      isPersonal: true,
      billingRail: 'metronome'
    },
    {
      name: 'a team workspace',
      billingType: 'workspace',
      isPersonal: false,
      billingRail: 'stripe'
    }
  ] as const)(
    'opens the flow without a retention session for $name',
    async ({ billingType, isPersonal, billingRail }) => {
      mocks.billingType.value = billingType
      mocks.isPersonal = isPersonal
      mocks.billingRail = billingRail
      const { shown, showFlow } = captureFlow()

      await launchCancellationFlow({ cancelAt: '2026-11-12', showFlow })

      expect(workspaceApi.prepareRetentionFlow).not.toHaveBeenCalled()
      expect(shown).toEqual([
        {
          cancelAt: '2026-11-12',
          surveyId: 'survey-1',
          flow: null,
          workspaceId: 'workspace-1',
          isScopeCurrent: expect.any(Function)
        }
      ])
    }
  )

  it('keeps legacy cancellation available while workspace state initializes', async () => {
    mocks.billingType.value = 'legacy'
    mocks.activeWorkspaceId = null
    const { shown, showFlow } = captureFlow()

    await launchCancellationFlow({ showFlow })

    mocks.activeWorkspaceId = 'workspace-2'
    expect(shown[0].workspaceId).toBeNull()
    expect(shown[0].isScopeCurrent()).toBe(true)
  })

  it('binds the flow to its launch workspace', async () => {
    const { shown, showFlow } = captureFlow()

    await launchCancellationFlow({ showFlow })

    expect(shown[0].isScopeCurrent()).toBe(true)
    mocks.activeWorkspaceId = 'workspace-2'
    expect(shown[0].isScopeCurrent()).toBe(false)
  })

  it.for([
    { name: 'is not configured', config: {} },
    { name: 'is blank', config: { cancellation_survey_id: '' } }
  ])('skips the survey when its ID $name', async ({ config }) => {
    remoteConfig.value = config
    const { shown, showFlow } = captureFlow()

    await launchCancellationFlow({ showFlow })

    expect(shown[0].surveyId).toBeUndefined()
  })

  it.for([
    {
      name: 'offers are switched off',
      error: new WorkspaceApiError('off', 503),
      reported: false
    },
    {
      name: 'the plan is ineligible',
      error: new WorkspaceApiError('no', 422),
      reported: false
    },
    {
      name: 'billing-api fails',
      error: new WorkspaceApiError('boom', 500),
      reported: true
    },
    {
      name: 'the request is lost',
      error: new Error('Network Error'),
      reported: true
    }
  ])(
    'opens the flow without an offer when $name',
    async ({ error, reported }) => {
      vi.mocked(workspaceApi.prepareRetentionFlow).mockRejectedValue(error)
      const { shown, showFlow } = captureFlow()

      await launchCancellationFlow({ showFlow })

      expect(shown[0].flow).toBeNull()
      expect(workspaceApi.recordRetentionFlowEvent).not.toHaveBeenCalled()
      expect(vi.mocked(reportError).mock.calls.length > 0).toBe(reported)
    }
  )

  it.for([
    {
      name: 'an offer arm',
      flow: retentionFlow({ experiment_variant: offer.id, offer })
    },
    {
      name: 'the control arm',
      flow: retentionFlow({ experiment_variant: 'control' })
    },
    { name: 'a session outside the experiment', flow: retentionFlow() }
  ])(
    'hands over the session for $name, leaving the open to the dialog',
    async ({ flow }) => {
      vi.mocked(workspaceApi.prepareRetentionFlow).mockResolvedValue(flow)
      const { shown, showFlow } = captureFlow()

      await launchCancellationFlow({ showFlow })

      expect(workspaceApi.recordRetentionFlowEvent).not.toHaveBeenCalled()
      expect(shown[0].flow).toEqual(flow)
    }
  )

  it('prepares one session for repeated launches from the same workspace', async () => {
    vi.mocked(workspaceApi.prepareRetentionFlow).mockResolvedValue(
      retentionFlow({ experiment_variant: offer.id, offer })
    )
    const { showFlow } = captureFlow()

    await Promise.all([
      launchCancellationFlow({ showFlow }),
      launchCancellationFlow({ showFlow })
    ])
    await launchCancellationFlow({ showFlow })

    expect(workspaceApi.prepareRetentionFlow).toHaveBeenCalledTimes(2)
    expect(showFlow).toHaveBeenCalledTimes(2)
  })

  it('keeps a pending launch while another workspace launches', async () => {
    let resolvePrepare: (flow: RetentionFlowResponse) => void = () => {}
    vi.mocked(workspaceApi.prepareRetentionFlow).mockReturnValue(
      new Promise((resolve) => {
        resolvePrepare = resolve
      })
    )
    const { shown, showFlow } = captureFlow()

    const firstLaunch = launchCancellationFlow({ showFlow })
    mocks.activeWorkspaceId = 'workspace-2'
    mocks.isPersonal = false
    await launchCancellationFlow({ showFlow })
    mocks.activeWorkspaceId = 'workspace-1'
    mocks.isPersonal = true
    const relaunch = launchCancellationFlow({ showFlow })
    resolvePrepare(retentionFlow({ experiment_variant: offer.id, offer }))
    await Promise.all([firstLaunch, relaunch])

    expect(workspaceApi.prepareRetentionFlow).toHaveBeenCalledOnce()
    expect(shown.map(({ workspaceId }) => workspaceId)).toEqual([
      'workspace-2',
      'workspace-1'
    ])
  })

  it('stops when the active workspace changes during preparation', async () => {
    vi.mocked(workspaceApi.prepareRetentionFlow).mockImplementation(
      async () => {
        mocks.activeWorkspaceId = 'workspace-2'
        return retentionFlow({ experiment_variant: offer.id, offer })
      }
    )
    const { showFlow } = captureFlow()

    await launchCancellationFlow({ showFlow })

    expect(showFlow).not.toHaveBeenCalled()
    expect(workspaceApi.recordRetentionFlowEvent).not.toHaveBeenCalled()
  })

  it.for([
    { workspaceStillCurrent: true, level: 'error', toast: true },
    { workspaceStillCurrent: false, level: 'warning', toast: false }
  ])(
    'contains a flow that fails to open (workspace current: $workspaceStillCurrent)',
    async ({ workspaceStillCurrent, level, toast }) => {
      const error = new Error('dialog chunk unavailable')

      await expect(
        launchCancellationFlow({
          showFlow: vi.fn(async () => {
            if (!workspaceStillCurrent) mocks.activeWorkspaceId = 'workspace-2'
            throw error
          })
        })
      ).resolves.toBeUndefined()

      expect(reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          errorType: 'error_showing_cancellation_flow',
          level
        })
      )
      expect(useToast().toasts.length > 0).toBe(toast)
    }
  )
})

describe('recordRetentionFlowEvent', () => {
  it.for([
    {
      name: 'records an event',
      error: undefined,
      outcome: 'recorded',
      reported: false
    },
    {
      name: 'treats an expired session as expired',
      error: new WorkspaceApiError('stale', 409, 'RETENTION_SESSION_STALE'),
      outcome: 'expired',
      reported: false
    },
    {
      name: 'reports any other failure',
      error: new WorkspaceApiError('boom', 500),
      outcome: 'failed',
      reported: true
    }
  ])('$name', async ({ error, outcome, reported }) => {
    if (error)
      vi.mocked(workspaceApi.recordRetentionFlowEvent).mockRejectedValue(error)

    await expect(
      recordRetentionFlowEvent('session-1', 'offer_shown')
    ).resolves.toBe(outcome)
    expect(workspaceApi.recordRetentionFlowEvent).toHaveBeenCalledWith({
      session_id: 'session-1',
      event: 'offer_shown'
    })
    expect(vi.mocked(reportError).mock.calls.length > 0).toBe(reported)
  })
})
