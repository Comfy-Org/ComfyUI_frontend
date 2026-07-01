export type EntryPath = 'appMode'

export type CoachPlacement =
  | 'left'
  | 'right'
  | 'center'
  | 'bottom'
  /** Left of the target, vertically centred on it (clamps to the viewport edge). */
  | 'leftCenter'
  /** Sits on whichever horizontal side of the target has more room. */
  | 'auto'

/**
 * Every element a tour can point at, written as `data-coach-id` literals on
 * the real components. The e2e drift guard asserts each id still resolves.
 */
export const COACH_IDS = {
  appRunButton: 'app-run-button',
  inputsList: 'inputs-list',
  outputs: 'outputs',
  assetsButton: 'assets-button',
  assetsPanel: 'assets-panel'
} as const

export type CoachId = (typeof COACH_IDS)[keyof typeof COACH_IDS]

export interface CoachStep {
  /** Element to spotlight. A list spotlights the first visible candidate. Omitted for a centered card with no target. */
  coachId?: CoachId | CoachId[]
  titleKey: string
  bodyKey: string
  placement: CoachPlacement
  /** The user advances by clicking the spotlighted element, not Next. */
  advanceOnTargetClick?: boolean
  /** Drop this step at tour start when this target is already mounted (e.g. it opens a panel that's already open). */
  skipIfMounted?: CoachId | CoachId[]
  /** Target mounts later (e.g. a dialog); wait for it instead of dropping the step. */
  deferTarget?: boolean
  /** Overrides the primary button label (defaults to Next / Done). */
  primaryLabelKey?: string
  /** Overrides the secondary (Skip) button label. */
  skipLabelKey?: string
  /**
   * Renders a full-screen, non-closable landing dialog (image + overview)
   * instead of a spotlight, e.g. the opening step of a section's tour.
   */
  landing?: boolean
  /** Image shown on the landing dialog's left panel. */
  image?: string
}

/**
 * Resolves which of a tour's steps actually run, fixing the set (and so the step
 * count) at tour start: drops steps whose `skipIfMounted` target is already
 * mounted (their goal is already met) and steps whose own target isn't mounted,
 * keeping targetless and deferred steps.
 */
export function resolveSteps(
  steps: CoachStep[],
  isMounted: (id: CoachId | CoachId[]) => boolean
): CoachStep[] {
  return steps.filter((s) => {
    if (s.skipIfMounted && isMounted(s.skipIfMounted)) return false
    return !s.coachId || s.deferTarget || isMounted(s.coachId)
  })
}

export const TOURS: Record<EntryPath, CoachStep[]> = {
  appMode: [
    {
      landing: true,
      titleKey: 'onboardingCoachmarks.appMode.landing.title',
      bodyKey: 'onboardingCoachmarks.appMode.landing.body',
      placement: 'center',
      primaryLabelKey: 'onboardingCoachmarks.appMode.landing.start',
      skipLabelKey: 'onboardingCoachmarks.appMode.landing.skip'
    },
    {
      coachId: COACH_IDS.inputsList,
      titleKey: 'onboardingCoachmarks.appMode.inputs.title',
      bodyKey: 'onboardingCoachmarks.appMode.inputs.body',
      placement: 'auto',
      deferTarget: true
    },
    {
      coachId: COACH_IDS.appRunButton,
      titleKey: 'onboardingCoachmarks.appMode.run.title',
      bodyKey: 'onboardingCoachmarks.appMode.run.body',
      placement: 'auto',
      deferTarget: true
    },
    {
      coachId: COACH_IDS.outputs,
      titleKey: 'onboardingCoachmarks.appMode.outputs.title',
      bodyKey: 'onboardingCoachmarks.appMode.outputs.body',
      placement: 'leftCenter',
      deferTarget: true
    },
    {
      coachId: COACH_IDS.assetsButton,
      titleKey: 'onboardingCoachmarks.appMode.assetsButton.title',
      bodyKey: 'onboardingCoachmarks.appMode.assetsButton.body',
      placement: 'right',
      deferTarget: true,
      advanceOnTargetClick: true,
      skipIfMounted: COACH_IDS.assetsPanel
    },
    {
      // The panel mounts when the button above is clicked.
      coachId: COACH_IDS.assetsPanel,
      titleKey: 'onboardingCoachmarks.appMode.assets.title',
      bodyKey: 'onboardingCoachmarks.appMode.assets.body',
      placement: 'auto',
      deferTarget: true
    }
  ]
}
