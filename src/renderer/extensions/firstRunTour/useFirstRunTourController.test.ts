import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OnboardingTourStage } from '@/platform/telemetry/types'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

import type * as CanvasSpotlightAdapter from './canvasSpotlightAdapter'
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
  isDesktop: true,
  tutorialCompleted: false as boolean,
  resolveTourRoles: vi.fn(),
  restoreView: vi.fn(),
  nodesPresent: vi.fn(() => true),
  canvasTransformValid: vi.fn(() => true),
  activeWorkflowState: {} as ComfyWorkflowJSON | null,
  storePrepare: vi.fn(),
  storeEnd: vi.fn(),
  engineStartTour: vi.fn(),
  engineNext: vi.fn(),
  engineBack: vi.fn(),
  engineSkip: vi.fn(),
  steps: [] as TourStep[],
  stepIndex: { value: 0 },
  engineActiveTour: { value: null as string | null },
  resolvedRoles: { value: null as ResolvedRoles | null },
  telemetry: {
    trackOnboardingTour: vi.fn()
  },
  hasFunds: true as boolean,
  showSubscriptionDialog: vi.fn(),
  storeShowNudge: vi.fn(),
  storeCaptureResultMedia: vi.fn()
}))

const upgradeModalOpen = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return ref(false)
})

/** Captures the api-bus handlers the controller registers so tests can dispatch a specific run outcome. */
type ApiEventHandler = (event: CustomEvent) => void
const apiEventHandlers = vi.hoisted(() => new Map<string, ApiEventHandler>())
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((event: string, handler: ApiEventHandler) => {
      apiEventHandlers.set(event, handler)
    }),
    removeEventListener: vi.fn((event: string) => {
      apiEventHandlers.delete(event)
    })
  }
}))

function emitExecution(event: string) {
  apiEventHandlers.get(event)?.(new CustomEvent(event, { detail: {} }))
}

/** Simulate a run finishing successfully. */
async function runJob() {
  emitExecution('execution_success')
  await nextTick()
}

/** Simulate a run ending with a non-success outcome. */
async function failJob(event: 'execution_error' | 'execution_interrupted') {
  emitExecution(event)
  await nextTick()
}

/** Click the toolbar Run button (the Run step's advance trigger). */
function clickRunButton() {
  const button = document.createElement('button')
  button.setAttribute('data-testid', 'queue-button')
  document.body.append(button)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  button.remove()
}

/** Click an element that is not the Run button (must not advance the step). */
function clickElsewhere() {
  const el = document.createElement('div')
  document.body.append(el)
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  el.remove()
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

vi.mock('@/composables/useDesktopLayout', () => ({
  useDesktopLayout: () => ({
    get value() {
      return mocks.isDesktop
    }
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.TutorialCompleted' ? mocks.tutorialCompleted : undefined,
    set: vi.fn()
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

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    isDialogOpen: () => upgradeModalOpen.value
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
  restoreView: mocks.restoreView
}))

vi.mock('./roleResolution', () => ({
  resolveTourRoles: mocks.resolveTourRoles
}))

vi.mock('./canvasSpotlightAdapter', async (importOriginal) => ({
  ...(await importOriginal<typeof CanvasSpotlightAdapter>()),
  nodesPresent: mocks.nodesPresent,
  canvasTransformValid: mocks.canvasTransformValid
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => mocks.telemetry
}))

vi.mock('./firstRunTourStore', () => ({
  FIRST_RUN_TOUR: 'firstRun',
  isUpgradeModalOpen: () => upgradeModalOpen.value,
  useFirstRunTourStore: () => ({
    prepare: mocks.storePrepare,
    end: mocks.storeEnd,
    showNudge: mocks.storeShowNudge,
    captureResultMedia: mocks.storeCaptureResultMedia,
    runFinished: false,
    get isActive() {
      return mocks.engineActiveTour.value === 'firstRun'
    },
    get stepIndex() {
      return mocks.stepIndex.value
    },
    get steps() {
      return mocks.steps
    },
    get currentStep() {
      return mocks.steps[mocks.stepIndex.value] ?? null
    },
    get totalSteps() {
      return mocks.steps.length
    },
    get resolvedRoles() {
      return mocks.resolvedRoles.value
    }
  })
}))

// The coachmark engine sequences both tours; here it drives the shared step index.
vi.mock('@/platform/onboarding/onboardingTourStore', () => ({
  useOnboardingTourStore: () => ({
    startTour: (...args: unknown[]) => {
      mocks.engineStartTour(...args)
      mocks.engineActiveTour.value = 'firstRun'
      mocks.stepIndex.value = 0
    },
    next: () => {
      mocks.engineNext()
      mocks.stepIndex.value += 1
    },
    back: () => {
      mocks.engineBack()
      if (mocks.stepIndex.value > 0) mocks.stepIndex.value -= 1
    },
    skip: () => {
      mocks.engineSkip()
      mocks.engineActiveTour.value = null
    },
    get activeTour() {
      return mocks.engineActiveTour.value
    },
    get countedStepIdx() {
      return mocks.stepIndex.value
    }
  })
}))

import { useFirstRunTourController } from './useFirstRunTourController'

/** The metadata reported for one stage of the shared onboarding-tour event. */
function tourReports(stage: OnboardingTourStage) {
  return mocks.telemetry.trackOnboardingTour.mock.calls
    .filter(([reported]) => reported === stage)
    .map(([, metadata]) => metadata)
}

describe('useFirstRunTourController.shouldStartTour', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.isDesktop = true
    mocks.tutorialCompleted = false
    mocks.activeWorkflowState = activeState
    mocks.steps = []
    mocks.stepIndex.value = 0
    mocks.engineActiveTour.value = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts when every condition holds', () => {
    expect(useFirstRunTourController().shouldStartTour()).toBe(true)
  })

  it('does not start off the Cloud build', () => {
    mocks.isCloud = false
    expect(useFirstRunTourController().shouldStartTour()).toBe(false)
  })

  it('does not start when subscription mode is off', () => {
    mocks.isSubscriptionEnabled.mockReturnValue(false)
    expect(useFirstRunTourController().shouldStartTour()).toBe(false)
  })

  it('does not start for a returning user', () => {
    mocks.isNewUser.mockReturnValue(false)
    expect(useFirstRunTourController().shouldStartTour()).toBe(false)
  })

  it('does not start before the new-user verdict is known', () => {
    mocks.isNewUser.mockReturnValue(null)
    expect(useFirstRunTourController().shouldStartTour()).toBe(false)
  })

  it('does not start when the feature flag is off', () => {
    mocks.onboardingTourEnabled = false
    expect(useFirstRunTourController().shouldStartTour()).toBe(false)
  })

  it('does not start on a narrow (mobile) viewport', () => {
    mocks.isDesktop = false
    expect(useFirstRunTourController().shouldStartTour()).toBe(false)
  })

  it('still starts when the tutorial flag is already set but the user is new', () => {
    mocks.tutorialCompleted = true
    mocks.isNewUser.mockReturnValue(true)
    expect(useFirstRunTourController().shouldStartTour()).toBe(true)
  })
})

describe('useFirstRunTourController.start', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.isDesktop = true
    mocks.tutorialCompleted = false
    mocks.activeWorkflowState = activeState
    mocks.storePrepare.mockReset()
    mocks.storeEnd.mockReset()
    mocks.engineNext.mockReset()
    mocks.steps = []
    mocks.stepIndex.value = 0
    mocks.engineActiveTour.value = null
    mocks.resolvedRoles.value = imageEditRoles
    mocks.hasFunds = true
    mocks.showSubscriptionDialog.mockReset()
    upgradeModalOpen.value = false
    mocks.storeShowNudge.mockReset()
    mocks.telemetry.trackOnboardingTour.mockReset()
    mocks.storeCaptureResultMedia.mockReset()
    apiEventHandlers.clear()
  })

  afterEach(() => {
    useFirstRunTourController().end('skip')
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not start the store when gating fails', async () => {
    mocks.isNewUser.mockReturnValue(false)

    await useFirstRunTourController().start()

    expect(mocks.storePrepare).not.toHaveBeenCalled()
  })

  it('serializes the active workflow and starts the store', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start('image_z_image_turbo')

    expect(mocks.storePrepare).toHaveBeenCalledWith(
      activeState,
      'image_z_image_turbo'
    )
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({
        tour: 'firstRun',
        template_id: 'image_z_image_turbo',
        shape: 'image-edit'
      })
    )
  })

  it('reports the resolved shape (t2i has no source image)', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.resolvedRoles.value = { ...imageEditRoles, source: null }

    await useFirstRunTourController().start()

    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({ shape: 't2i' })
    )
  })

  it('defaults the entry to getting_started when none is passed', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start('image_z_image_turbo')

    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({ entry: 'getting_started' })
    )
  })

  it('threads the template_url entry for a ?template= arrival', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start(
      'image_z_image_turbo',
      'template_url'
    )

    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({
        template_id: 'image_z_image_turbo',
        entry: 'template_url'
      })
    )
  })

  it('threads the share_url entry with no template id for a ?share= arrival', async () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.resolvedRoles.value = { ...imageEditRoles, prompt: null, sink: null }

    await useFirstRunTourController().start(undefined, 'share_url')

    expect(mocks.storePrepare).toHaveBeenCalledWith(activeState, undefined)
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({
        template_id: undefined,
        shape: 'other',
        entry: 'share_url'
      })
    )
  })

  it('ends the tour when no active workflow is present', async () => {
    mocks.activeWorkflowState = null

    await useFirstRunTourController().start()

    expect(mocks.storePrepare).not.toHaveBeenCalled()
    expect(mocks.storeEnd).toHaveBeenCalled()
  })

  it('reports completion when the tour finishes', () => {
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.engineActiveTour.value = 'firstRun'

    useFirstRunTourController().end('done')

    expect(tourReports('completed')).toHaveLength(1)
  })

  it('reports the step the user skipped on', async () => {
    mocks.steps = [
      { kind: 'upload', nodeId: toNodeId(1) },
      { kind: 'run', nodeId: null }
    ]

    const controller = useFirstRunTourController()
    await controller.start('image_z_image_turbo')
    controller.end('skip')

    expect(tourReports('skipped')).toEqual([
      {
        tour: 'firstRun',
        template_id: 'image_z_image_turbo',
        step_key: 'upload',
        step_number: 1,
        step_count: 2
      }
    ])
  })

  it('reports no skip when the tour has no current step', () => {
    mocks.steps = []
    mocks.engineActiveTour.value = 'firstRun'

    useFirstRunTourController().end('skip')

    expect(tourReports('skipped')).toHaveLength(0)
  })

  it('reports each step as it is shown', async () => {
    mocks.steps = [
      { kind: 'upload', nodeId: toNodeId(1) },
      { kind: 'run', nodeId: null }
    ]

    const controller = useFirstRunTourController()
    await controller.start('image_z_image_turbo')

    expect(tourReports('step_shown')).toEqual([
      {
        tour: 'firstRun',
        template_id: 'image_z_image_turbo',
        step_key: 'upload',
        step_number: 1,
        step_count: 2
      }
    ])
  })

  it('restores the root view on the prompt step so a manually opened subgraph cannot strand it', async () => {
    mocks.steps = [{ kind: 'prompt', nodeId: null, prompt: promptRole }]

    await useFirstRunTourController().start()

    expect(mocks.restoreView).toHaveBeenCalled()
  })

  it('never auto-advances a step — the user always drives Next', async () => {
    vi.useFakeTimers()
    // Even a purely informational step (upload) must not advance on its own.
    mocks.steps = [
      { kind: 'upload', nodeId: toNodeId(1) },
      { kind: 'prompt', nodeId: null, prompt: promptRole }
    ]

    await useFirstRunTourController().start()
    await vi.advanceTimersByTimeAsync(60000)

    expect(mocks.engineNext).not.toHaveBeenCalled()
  })

  it('gates a no-funds user when they click Run: upgrade modal, nudge, end', async () => {
    mocks.hasFunds = false
    mocks.steps = [{ kind: 'run', nodeId: null }]
    // The gate opens the real upgrade modal, so the paywall watcher fires too;
    // ending must stay one-shot across both paths.
    mocks.showSubscriptionDialog.mockImplementation(() => {
      upgradeModalOpen.value = true
    })

    await useFirstRunTourController().start('image_z_image_turbo')

    // Arriving at the Run step must not paywall the user on its own.
    expect(mocks.showSubscriptionDialog).not.toHaveBeenCalled()

    clickRunButton()
    await nextTick()

    expect(mocks.showSubscriptionDialog).toHaveBeenCalledWith({
      reason: 'out_of_credits'
    })
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'upgrade_shown',
      expect.objectContaining({ template_id: 'image_z_image_turbo' })
    )
    expect(mocks.storeShowNudge).toHaveBeenCalledOnce()
    expect(mocks.storeEnd).toHaveBeenCalledOnce()
    expect(tourReports('completed')).toHaveLength(1)
    expect(tourReports('run_triggered')).toHaveLength(0)
  })

  it('gates via store.end when the user cannot fund a run', async () => {
    mocks.hasFunds = false
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start()
    clickRunButton()

    expect(mocks.storeEnd).toHaveBeenCalled()
  })

  it('does not advance past Run when the click is gated', async () => {
    mocks.hasFunds = false
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9) }
    ]

    await useFirstRunTourController().start()
    clickRunButton()

    expect(mocks.engineNext).not.toHaveBeenCalled()
  })

  it('lets a funded user reach the Run step without reporting a run yet', async () => {
    mocks.hasFunds = true
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start()

    expect(mocks.showSubscriptionDialog).not.toHaveBeenCalled()
    expect(mocks.storeEnd).not.toHaveBeenCalled()
    // Merely arriving at the Run step is not a run — telemetry waits for a real
    // execution so nothing can fabricate an activation event.
    expect(tourReports('run_triggered')).toHaveLength(0)
  })

  it('ends the tour when the upgrade modal opens mid-run so it never hangs', async () => {
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    expect(mocks.storeEnd).not.toHaveBeenCalled()

    // A no-subscription run is blocked by the paywall before it queues, so no
    // execution event fires; the opening modal must end the tour on its own.
    upgradeModalOpen.value = true
    await nextTick()

    expect(mocks.storeEnd).toHaveBeenCalled()
    expect(mocks.storeShowNudge).toHaveBeenCalled()
  })

  it('reports the run only when a run actually completes', async () => {
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    // Merely starting the tour reports nothing — the run must finish first.
    expect(tourReports('run_triggered')).toHaveLength(0)

    await runJob()

    expect(mocks.storeCaptureResultMedia).toHaveBeenCalledOnce()
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'run_triggered',
      expect.objectContaining({ status: 'success' })
    )
  })

  it('captures the media when the run reports after the click advanced to Result', async () => {
    // Production ordering: the Run click advances synchronously, so the execution
    // event lands while Result is current. `advance` is a spy, so move it by hand.
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    mocks.stepIndex.value = 1
    await runJob()

    expect(mocks.storeCaptureResultMedia).toHaveBeenCalledOnce()
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'run_triggered',
      expect.objectContaining({ status: 'success' })
    )
  })

  it('ignores execution events that arrive before the Run step', async () => {
    // A run kicked off from an earlier step must not resolve the Result or report.
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'prompt', nodeId: null },
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    mocks.stepIndex.value = 0
    await runJob()

    expect(mocks.storeCaptureResultMedia).not.toHaveBeenCalled()
    expect(tourReports('run_triggered')).toHaveLength(0)
  })

  it('reports the run at most once across repeated runs', async () => {
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    await runJob()
    await runJob()

    expect(tourReports('run_triggered')).toHaveLength(1)
  })

  it('reports the true status and skips media capture when a run errors', async () => {
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    await failJob('execution_error')

    expect(mocks.storeCaptureResultMedia).not.toHaveBeenCalled()
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'run_triggered',
      expect.objectContaining({ status: 'error' })
    )
  })

  it('reports the true status and skips media capture when a run is interrupted', async () => {
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    await failJob('execution_interrupted')

    expect(mocks.storeCaptureResultMedia).not.toHaveBeenCalled()
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'run_triggered',
      expect.objectContaining({ status: 'interrupted' })
    )
  })

  it('completes the tour when a run finishes on the terminal Run step', async () => {
    // No sink resolved → Run is the last step; a finished run must fire Completed.
    mocks.hasFunds = true
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start('image_z_image_turbo')
    await runJob()

    expect(tourReports('completed')).toHaveLength(1)
  })

  it('does not click-advance the terminal Run step out from under the run outcome', async () => {
    mocks.hasFunds = true
    mocks.steps = [{ kind: 'run', nodeId: null }]

    await useFirstRunTourController().start('image_z_image_turbo')
    clickRunButton()
    await runJob()

    expect(mocks.engineNext).not.toHaveBeenCalled()
    expect(tourReports('completed')).toHaveLength(1)
    expect(mocks.storeShowNudge).toHaveBeenCalledOnce()
    expect(apiEventHandlers.size).toBe(0)
  })

  it('does not complete on run when a Result step follows', async () => {
    mocks.hasFunds = true
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start('image_z_image_turbo')
    await runJob()

    expect(tourReports('completed')).toHaveLength(0)
  })

  it('advances off the Run step the instant the Run button is clicked', async () => {
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    expect(mocks.engineNext).not.toHaveBeenCalled()

    clickRunButton()

    // The click alone advances — no waiting for the run to finish.
    expect(mocks.engineNext).toHaveBeenCalledOnce()
  })

  it('does not advance when a click misses the Run button', async () => {
    // The listener must discriminate on the selector, not advance on any click.
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    clickElsewhere()

    expect(mocks.engineNext).not.toHaveBeenCalled()
  })

  it('captures the media when the run finishes (not the step advance)', async () => {
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    await useFirstRunTourController().start()
    await runJob()

    expect(mocks.storeCaptureResultMedia).toHaveBeenCalledOnce()
  })

  it('still advances after the launching component unmounts', async () => {
    // start() runs inside the Getting Started screen's setup, which unmounts right
    // after; the Run-click listener must survive that teardown.
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]

    const launchingScope = effectScope()
    await launchingScope.run(async () => {
      await useFirstRunTourController().start()
    })
    launchingScope.stop() // the Getting Started screen unmounts

    clickRunButton()

    expect(mocks.engineNext).toHaveBeenCalledOnce()
  })

  it('does not advance on the Result step when a run completes', async () => {
    // Started already on Result: no Run-click listener is bound, so a completing
    // run resolves media but never advances the step.
    mocks.steps = [
      { kind: 'run', nodeId: null },
      { kind: 'result', nodeId: toNodeId(9), mediaKind: 'image' }
    ]
    mocks.stepIndex.value = 1

    await useFirstRunTourController().start()
    await runJob()

    expect(mocks.engineNext).not.toHaveBeenCalled()
  })

  it('only gates when the funds check reaches the Run step', async () => {
    mocks.hasFunds = false
    mocks.steps = [
      { kind: 'prompt', nodeId: null, prompt: promptRole },
      { kind: 'run', nodeId: null }
    ]

    await useFirstRunTourController().start()

    // First step is Prompt, not Run — no gate yet.
    expect(mocks.showSubscriptionDialog).not.toHaveBeenCalled()
  })
})

describe('useFirstRunTourController post-run nudge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.activeWorkflowState = activeState
    mocks.storePrepare.mockReset()
    mocks.storeShowNudge.mockReset()
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.stepIndex.value = 0
    mocks.engineActiveTour.value = null
    mocks.hasFunds = true
    apiEventHandlers.clear()
  })

  afterEach(() => {
    useFirstRunTourController().end('skip')
    vi.clearAllMocks()
  })

  it('surfaces the nudge on the first completed run after the tour starts', async () => {
    await useFirstRunTourController().start('image_z_image_turbo')

    await runJob()

    expect(mocks.storeShowNudge).toHaveBeenCalledOnce()
  })

  it('surfaces the nudge only once even across repeated runs', async () => {
    await useFirstRunTourController().start('image_z_image_turbo')

    await runJob()
    await runJob()

    expect(mocks.storeShowNudge).toHaveBeenCalledOnce()
  })

  it('does not surface the nudge before any tour has started', async () => {
    // No tour is live, so no run watcher is registered; a stray job completion
    // must not pop the nudge.
    await runJob()

    expect(mocks.storeShowNudge).not.toHaveBeenCalled()
  })
})

describe('useFirstRunTourController.beginTour', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mocks.isCloud = true
    mocks.isSubscriptionEnabled.mockReturnValue(true)
    mocks.isNewUser.mockReturnValue(true)
    mocks.onboardingTourEnabled = true
    mocks.activeWorkflowState = activeState
    mocks.resolveTourRoles.mockReturnValue(imageEditRoles)
    mocks.nodesPresent.mockReturnValue(true)
    mocks.canvasTransformValid.mockReturnValue(true)
    mocks.storePrepare.mockReset()
    mocks.steps = [{ kind: 'run', nodeId: null }]
    mocks.stepIndex.value = 0
    mocks.engineActiveTour.value = null
    mocks.resolvedRoles.value = imageEditRoles
    mocks.hasFunds = true
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    apiEventHandlers.clear()
  })

  afterEach(() => {
    useFirstRunTourController().end('skip')
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('starts the tour once the live graph holds the resolved nodes', async () => {
    const started = await useFirstRunTourController().beginTour({
      templateId: 'image_z_image_turbo'
    })

    expect(started).toBe(true)
    expect(mocks.storePrepare).toHaveBeenCalledWith(
      activeState,
      'image_z_image_turbo'
    )
    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({
        template_id: 'image_z_image_turbo',
        entry: 'getting_started'
      })
    )
  })

  it('threads the share_url entry through when launched from a URL', async () => {
    await useFirstRunTourController().beginTour({ entry: 'share_url' })

    expect(mocks.telemetry.trackOnboardingTour).toHaveBeenCalledWith(
      'started',
      expect.objectContaining({ entry: 'share_url' })
    )
  })

  it('does not start when gating fails', async () => {
    mocks.isNewUser.mockReturnValue(false)

    const started = await useFirstRunTourController().beginTour({
      templateId: 'x'
    })

    expect(started).toBe(false)
    expect(mocks.storePrepare).not.toHaveBeenCalled()
  })

  it('does not start a second tour while one is already active', async () => {
    mocks.engineActiveTour.value = 'firstRun'

    const started = await useFirstRunTourController().beginTour({
      templateId: 'x'
    })

    expect(started).toBe(false)
    expect(mocks.storePrepare).not.toHaveBeenCalled()
  })

  it('starts degraded rather than trapping when the graph never becomes ready', async () => {
    vi.useFakeTimers()
    mocks.nodesPresent.mockReturnValue(false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const pending = useFirstRunTourController().beginTour({ templateId: 'x' })
    await vi.runAllTimersAsync()
    await pending

    expect(mocks.storePrepare).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
