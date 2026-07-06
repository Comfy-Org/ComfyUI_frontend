export type EntryPath = 'appMode'

/** Setting holding the tours the user has completed or dismissed. */
export const TOUR_SEEN_SETTING = 'Comfy.OnboardingCoachmarks.Seen'

export type CoachPlacement =
  | 'left'
  | 'right'
  | 'center'
  | 'bottom'
  /** Left of the target, vertically centred on it (clamps to the viewport edge). */
  | 'leftCenter'
  /** Sits on whichever horizontal side of the target has more room. */
  | 'auto'

/** Every element a tour can point at; the e2e drift guard asserts each resolves. */
export const COACH_IDS = {
  appRunButton: 'app-run-button',
  inputsList: 'inputs-list',
  outputs: 'outputs',
  assetsButton: 'assets-button',
  assetsPanel: 'assets-panel'
} as const

export type CoachId = (typeof COACH_IDS)[keyof typeof COACH_IDS]

export interface CoachStep {
  /**
   * Derives the step's translation keys:
   * `onboardingCoachmarks.<tour>.<name>.title|body`, plus optional
   * `primary`/`skip` button-label overrides.
   */
  name: string
  /** Element to spotlight (the first laid-out registered candidate wins). */
  coachId?: CoachId
  placement: CoachPlacement
  /** The user advances by clicking the spotlighted element, not Next. */
  advanceOnTargetClick?: boolean
  /** Drop this step at tour start when this target is already mounted. */
  skipIfMounted?: CoachId
  /** Target mounts later (e.g. a dialog); wait for it instead of dropping the step. */
  deferTarget?: boolean
  /** Renders the landing dialog instead of a spotlight. */
  landing?: boolean
  image?: string
}

/**
 * Fixes the running step set (and so the step count) at tour start: drops
 * `skipIfMounted` matches and steps whose own target isn't mounted, keeping
 * targetless and deferred steps.
 */
export function resolveSteps(
  steps: CoachStep[],
  isMounted: (id: CoachId) => boolean
): CoachStep[] {
  return steps.filter((s) => {
    if (s.skipIfMounted && isMounted(s.skipIfMounted)) return false
    return !s.coachId || s.deferTarget || isMounted(s.coachId)
  })
}

export const TOURS: Record<EntryPath, CoachStep[]> = {
  appMode: [
    {
      name: 'landing',
      landing: true,
      placement: 'center',
      image: '/assets/images/app-mode-landing.png'
    },
    {
      name: 'inputs',
      coachId: COACH_IDS.inputsList,
      placement: 'auto',
      deferTarget: true
    },
    {
      name: 'run',
      coachId: COACH_IDS.appRunButton,
      placement: 'auto',
      deferTarget: true
    },
    {
      name: 'outputs',
      coachId: COACH_IDS.outputs,
      placement: 'leftCenter',
      deferTarget: true
    },
    {
      name: 'assetsButton',
      coachId: COACH_IDS.assetsButton,
      placement: 'right',
      deferTarget: true,
      advanceOnTargetClick: true,
      skipIfMounted: COACH_IDS.assetsPanel
    },
    {
      name: 'assets',
      coachId: COACH_IDS.assetsPanel,
      placement: 'auto',
      deferTarget: true
    }
  ]
}
