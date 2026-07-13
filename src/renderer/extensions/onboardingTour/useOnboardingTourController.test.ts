import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

import type { PromptRole, ResolvedRoles, TourStep } from './tourSequence'

const activeState = {} as ComfyWorkflowJSON

const promptRole: PromptRole = {
  subgraphNodeId: toNodeId(10),
  innerNodeId: toNodeId(27),
  widgetName: 'text',
  portFallback: 'prompt'
}

const imageEditRoles: ResolvedRoles = {
  source: { nodeId: toNodeId(1) },
  prompt: promptRole,
  engine: { nodeId: toNodeId(3) },
  sink: { nodeId: toNodeId(9) },
  mediaKind: 'image'
}

const mocks = vi.hoisted(() => ({
  isCloud: true,
  isSubscriptionEnabled: vi.fn(() => true),
  isNewUser: vi.fn<() => boolean | null>(() => true),
  onboardingTourEnabled: true,
  tutorialCompleted: false as boolean,
  focusPromptTarget: vi.fn(async () => true),
  activeWorkflowState: {} as ComfyWorkflowJSON | null,
  storeStart: vi.fn(),
  storeAdvance: vi.fn(),
  storeEnd: vi.fn(),
  steps: [] as TourStep[],
  stepIndex: { value: 0 },
  phase: { value: 'active' as 'idle' | 'active' },
  promptPortFallback: { value: false },
  resolvedRoles: { value: null as ResolvedRoles | null },
  telemetry: {
    trackOnboardingTourStarted: vi.fn(),
    trackOnboardingTourStepViewed: vi.fn(),
    trackOnboardingTourSkipped: vi.fn(),
    trackOnboardingTourCompleted: vi.fn(),
    trackOnboardingTourRunTriggered: vi.fn(),
    trackOnboardingTourUpgradeShown: vi.fn()
  },
  hasFunds: true as boolean,
  showSubscriptionDialog: vi.fn(),
  storeArmNudge: vi.fn(),
  storeShowNudge: vi.fn(),
  storeSetPromptEntered: vi.fn(),
  storeCaptureResultMedia: vi.fn(),
  settingSet: vi.fn()
}))

const apiListeners = vi.hoisted(() => new Map<string, (e: Event) => void>())
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: (type: string, cb: (e: Event) => void) =>
      apiListeners.set(type, cb),
    removeEventListener: (type: string) => apiListeners.delete(type)
  }
}))

function emitExecutionSuccess() {
  apiListeners.get('execution_success')?.(new CustomEvent('execution_success'))
}

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isSubscriptionEnabled: mocks.isSubscriptionEnabled
  })
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({ isNewUser: mocks.isNewUser })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get onboardingTourEnabled() {
        return mocks.onboardingTourEnabled
      }
    }
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.TutorialCompleted' ? mocks.tutorialCompleted : undefined,
    set: mocks.settingSet
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscription: {
      get value() {
        return { hasFunds: mocks.hasFunds }
      }
    },
    showSubscriptionDialog: mocks.showSubscriptionDialog
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      get activeState() {
        return mocks.activeWorkflowState
      }
    }
  })
}))

vi.mock('./subgraphNavigation', () => ({
  focusPromptTarget: mocks.focusPromptTarget,
  restoreView: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => mocks.telemetry
}))

vi.mock('./onboardingTourStore', () => ({
  useOnboardingTourStore: () => ({
    start: mocks.storeStart,
    advance: mocks.storeAdvance,
    back: vi.fn(),
    end: mocks.storeEnd,
    armNudge: mocks.storeArmNudge,
    showNudge: mocks.storeShowNudge,
    setPromptEntered: mocks.storeSetPromptEntered,
    captureResultMedia: mocks.storeCaptureResultMedia,
    get phase() {
      return mocks.phase.value
    },
    get steps() {
      return mocks.steps
    },
    get stepIndex() {
      return mocks.stepIndex.value
    },
    get currentStep() {
      return mocks.steps[mocks.stepIndex.value] ?? null
    },
    get totalSteps() {
      return mocks.steps.length
    },
    get resolvedRoles() {
      return mocks.resolvedRoles.value
    },
    get promptPortFallback() {
      return mocks.promptPortFallback.value
    },
    set promptPortFallback(v: boolean) {
      mocks.promptPortFallback.value = v
    }
  })
}))

import { useOnboardingTourController } from './useOnboardingTourController'

describe('useOnboardingTourController.shouldStartTour', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.tutorialCompleted = false
    mocks.activeWorkflowState = activeState
    mocks.focusPromptTarget.mockResolvedValue(true)
    mocks.steps = []
    mocks.stepIndex.value = 0
    mocks.promptPortFallback.value = false
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts when every condition holds', () => {
    expect(useOnboardingTourController().shouldStartTour()).toBe(true)
  })

  it('does not start off the Cloud build', () => {
    mocks.isCloud = false
    expect(useOnboardingTourController().shouldStartTour()).toBe(false)
  })

  it('does not start when subscription mode is off', () => {
    mocks.isSubscriptionEnabled.mockReturnValue(false)
    expect(useOnboardingTourController().shouldStartTour()).toBe(false)
  })

  it('does not start for a returning user', () => {
    mocks.isNewUser.mockReturnValue(false)
    expect(useOnboardingTourController().shouldStartTour()).toBe(false)
  })

  it('does not start before the new-user verdict is known', () => {
    mocks.isNewUser.mockReturnValue(null)
    expect(useOnboardingTourController().shouldStartTour()).toBe(false)
  })

  it('does not start when the feature flag is off', () => {
    mocks.onboardingTourEnabled = false
    expect(useOnboardingTourController().shouldStartTour()).toBe(false)
  })

  it('still starts when the tutorial flag is already set but the user is new', () => {
    mocks.tutorialCompleted = true
    mocks.isNewUser.mockReturnValue(true)
    expect(useOnboardingTourController().shouldStartTour()).toBe(true)
  })
})

describe('useOnboardingTourController.start', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.tutorialCompleted = false
    mocks.activeWorkflowState = activeState
    mocks.focusPromptTarget.mockResolvedValue(true)
    mocks.storeStart.mockReset()
    mocks.storeEnd.mockReset()
    mocks.storeAdvance.mockReset()
    mocks.focusPromptTarget.mockClear()
    mocks.steps = []
    mocks.stepIndex.value = 0
    mocks.phase.value = 'active'
    mocks.promptPortFallback.value = false
    mocks.resolvedRoles.value = imageEditRoles
    mocks.hasFunds = true
    mocks.showSubscriptionDialog.mockReset()
    mocks.storeArmNudge.mockReset()
    mocks.storeShowNudge.mockReset()
    mocks.settingSet.mockReset()
    mocks.telemetry.trackOnboardingTourRunTriggered.mockReset()
    mocks.telemetry.trackOnboardingTourUpgradeShown.mockReset()
    apiListeners.clear()
  })

  afterEach(() => {
    useOnboardingTourController().end('skip')
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not start the store when gating fails', async () => {
    mocks.isNewUser.mockReturnValue(false)

    await useOnboardingTourController().start()

    expect(mocks.storeStart).not.toHaveBeenCalled()
  })

  it('serializes the active workflow and starts the store', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start('image_z_image_turbo')

    expect(mocks.storeStart).toHaveBeenCalledWith(
      activeState,
      'image_z_image_turbo'
    )
    expect(mocks.telemetry.trackOnboardingTourStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'image_z_image_turbo',
        shape: 'image-edit'
      })
    )
  })

  it('reports the resolved shape (t2i has no source image)', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.resolvedRoles.value = { ...imageEditRoles, source: null }

    await useOnboardingTourController().start()

    expect(mocks.telemetry.trackOnboardingTourStarted).toHaveBeenCalledWith(
      expect.objectContaining({ shape: 't2i' })
    )
  })

  it('defaults the entry to getting_started when none is passed', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start('image_z_image_turbo')

    expect(mocks.telemetry.trackOnboardingTourStarted).toHaveBeenCalledWith(
      expect.objectContaining({ entry: 'getting_started' })
    )
  })

  it('threads the template_url entry for a ?template= arrival', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start(
      'image_z_image_turbo',
      'template_url'
    )

    expect(mocks.telemetry.trackOnboardingTourStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'image_z_image_turbo',
        entry: 'template_url'
      })
    )
  })

  it('threads the share_url entry with no template id for a ?share= arrival', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.resolvedRoles.value = { ...imageEditRoles, prompt: null, sink: null }

    await useOnboardingTourController().start(undefined, 'share_url')

    expect(mocks.storeStart).toHaveBeenCalledWith(activeState, undefined)
    expect(mocks.telemetry.trackOnboardingTourStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: undefined,
        shape: 'other',
        entry: 'share_url'
      })
    )
  })

  it('ends the tour when no active workflow is present', async () => {
    mocks.activeWorkflowState = null

    await useOnboardingTourController().start()

    expect(mocks.storeStart).not.toHaveBeenCalled()
    expect(mocks.storeEnd).toHaveBeenCalled()
  })

  it('reports completion when the tour finishes', () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    useOnboardingTourController().end('done')

    expect(mocks.telemetry.trackOnboardingTourCompleted).toHaveBeenCalled()
  })

  it('focuses the prompt when the first step is a prompt step', async () => {
    mocks.steps = [{ kind: 'prompt', nodeId: null, prompt: promptRole }]

    await useOnboardingTourController().start()

    expect(mocks.focusPromptTarget).toHaveBeenCalledWith(promptRole)
    expect(mocks.promptPortFallback.value).toBe(false)
  })

  it('spotlights the port when prompt focus fails', async () => {
    mocks.steps = [{ kind: 'prompt', nodeId: null, prompt: promptRole }]
    mocks.focusPromptTarget.mockResolvedValue(false)

    await useOnboardingTourController().start()

    expect(mocks.promptPortFallback.value).toBe(true)
  })

  it('advances a stalled informational step after the grace period', async () => {
    vi.useFakeTimers()
    // Upload → Prompt: the upload step needs no action, so a stalled user is
    // nudged onward. (Prompt → Run is NOT auto-advanced — see the Run test.)
    mocks.steps = [
      { kind: 'upload', nodeId: toNodeId(1) },
      { kind: 'prompt', nodeId: null, prompt: promptRole }
    ]

    await useOnboardingTourController().start()
    expect(mocks.storeAdvance).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(8000)

    expect(mocks.storeAdvance).toHaveBeenCalled()
  })

  it('does not arm a grace timer on the last step', async () => {
    vi.useFakeTimers()
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start()
    await vi.advanceTimersByTimeAsync(8000)

    expect(mocks.storeAdvance).not.toHaveBeenCalled()
  })

  it('gates a no-funds user at the Run step: upgrade modal, nudge, end', async () => {
    mocks.hasFunds = false
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start('image_z_image_turbo')

    expect(mocks.showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'out_of_credits'
    })
    expect(
      mocks.telemetry.trackOnboardingTourUpgradeShown
    ).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: 'image_z_image_turbo' })
    )
    expect(mocks.storeArmNudge).toHaveBeenCalledOnce()
    expect(mocks.storeEnd).toHaveBeenCalled()
    expect(
      mocks.telemetry.trackOnboardingTourRunTriggered
    ).not.toHaveBeenCalled()
  })

  it('gates via store.end without writing completion itself', async () => {
    mocks.hasFunds = false
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start()

    // Once-only rests on the load seam's Comfy.TutorialCompleted write; the
    // controller ends the tour but never touches the setting itself.
    expect(mocks.storeEnd).toHaveBeenCalled()
    expect(mocks.settingSet).not.toHaveBeenCalled()
  })

  it('lets a funded user reach the Run step without reporting a run yet', async () => {
    mocks.hasFunds = true
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start()

    expect(mocks.showSubscriptionDialog).not.toHaveBeenCalled()
    expect(mocks.storeEnd).not.toHaveBeenCalled()
    // Merely arriving at the Run step is not a run — telemetry waits for a real
    // execution so the grace timer can't fabricate an activation event.
    expect(
      mocks.telemetry.trackOnboardingTourRunTriggered
    ).not.toHaveBeenCalled()
  })

  it('reports the run only when an execution actually succeeds', async () => {
    mocks.hasFunds = true
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start()
    expect(
      mocks.telemetry.trackOnboardingTourRunTriggered
    ).not.toHaveBeenCalled()

    emitExecutionSuccess()

    expect(mocks.storeCaptureResultMedia).toHaveBeenCalledOnce()
    expect(
      mocks.telemetry.trackOnboardingTourRunTriggered
    ).toHaveBeenCalledOnce()
  })

  it('reports the run at most once across repeated successes', async () => {
    mocks.hasFunds = true
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useOnboardingTourController().start()
    emitExecutionSuccess()
    emitExecutionSuccess()

    expect(
      mocks.telemetry.trackOnboardingTourRunTriggered
    ).toHaveBeenCalledOnce()
  })

  it('does not auto-advance from the prompt step into the Run step', async () => {
    vi.useFakeTimers()
    mocks.steps = [
      { kind: 'prompt', nodeId: null, prompt: promptRole },
      { kind: 'run', nodeId: null }
    ]

    await useOnboardingTourController().start()
    await vi.advanceTimersByTimeAsync(8000)

    // The user must click Run themselves; the grace timer never skips them past it.
    expect(mocks.storeAdvance).not.toHaveBeenCalled()
  })

  it('only gates when the funds check reaches the Run step', async () => {
    mocks.hasFunds = false
    mocks.steps = [
      { kind: 'prompt', nodeId: null, prompt: promptRole },
      { kind: 'run', nodeId: null }
    ]

    await useOnboardingTourController().start()

    // First step is Prompt, not Run — no gate yet.
    expect(mocks.showSubscriptionDialog).not.toHaveBeenCalled()
  })
})

describe('useOnboardingTourController post-run nudge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.activeWorkflowState = activeState
    mocks.focusPromptTarget.mockResolvedValue(true)
    mocks.storeStart.mockReset()
    mocks.storeShowNudge.mockReset()
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.stepIndex.value = 0
    mocks.phase.value = 'active'
    mocks.hasFunds = true
    apiListeners.clear()
  })

  afterEach(() => {
    useOnboardingTourController().end('skip')
    vi.clearAllMocks()
  })

  it('surfaces the nudge on the first successful run after the tour starts', async () => {
    await useOnboardingTourController().start('image_z_image_turbo')

    emitExecutionSuccess()

    expect(mocks.storeShowNudge).toHaveBeenCalledOnce()
  })

  it('surfaces the nudge only once even across repeated successes', async () => {
    await useOnboardingTourController().start('image_z_image_turbo')

    emitExecutionSuccess()
    emitExecutionSuccess()

    expect(mocks.storeShowNudge).toHaveBeenCalledOnce()
  })

  it('does not surface the nudge before any tour has started', () => {
    // The shared controller registers its listener on init; a stray success
    // with no active tour must not pop the nudge.
    emitExecutionSuccess()

    expect(mocks.storeShowNudge).not.toHaveBeenCalled()
  })
})
