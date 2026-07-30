/** Every tour, including ones whose steps a consumer registers at runtime. */
export const ENTRY_PATHS = ['appMode', 'firstRun'] as const

export type EntryPath = (typeof ENTRY_PATHS)[number]

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
  assetsPanel: 'assets-panel'
} as const

/**
 * Graph-view anchors for the first-run tour. Kept out of {@link COACH_IDS}
 * because the drift guard iterates that map and asserts each id resolves in
 * App mode, where none of these exist.
 */
export const FIRST_RUN_COACH_IDS = {
  runButton: 'first-run-run-button',
  source: 'first-run-source',
  prompt: 'first-run-prompt',
  sink: 'first-run-sink'
} as const

export type CoachId =
  | (typeof COACH_IDS)[keyof typeof COACH_IDS]
  | (typeof FIRST_RUN_COACH_IDS)[keyof typeof FIRST_RUN_COACH_IDS]

export interface CoachStep {
  /**
   * Derives the step's translation keys:
   * `onboardingCoachmarks.<tour>.<name>.title|body`, plus optional
   * `primary`/`skip` button-label overrides. Read inside a reactive effect, so
   * a getter here re-resolves the copy as the step's subject changes.
   */
  name: string
  /** Element to spotlight (the first laid-out registered candidate wins). */
  coachId?: CoachId
  placement: CoachPlacement
  /** Open this sidebar tab when the step starts (e.g. to reveal its target). */
  openSidebarTab?: string
  /** Target mounts later (e.g. a dialog); wait for it instead of dropping the step. */
  deferTarget?: boolean
  /** Renders the landing dialog instead of a spotlight. */
  landing?: boolean
  image?: string
  /** Lets pointer input through the scrim's holes and releases the focus trap. */
  interactive?: boolean
  /** Draws a pointer glyph on the card edge facing the target. */
  cursor?: boolean
  /**
   * Offers no primary action: the only way past this step is doing the thing it
   * asks for in the app, and the consumer advances once that happens.
   */
  selfAdvancing?: boolean
  /** Runs when the step is shown; the signal aborts on leaving the step. */
  onEnter?: (signal: AbortSignal) => void | Promise<void>
}

/** A tour's steps: a fixed list, or a resolver that builds them at start. */
export type TourDefinition = CoachStep[] | (() => Promise<CoachStep[]>)

/**
 * Fixes the running step set (and so the step count) at tour start: drops steps
 * whose own target isn't mounted, keeping targetless and deferred steps.
 */
export function resolveSteps(
  steps: CoachStep[],
  isMounted: (id: CoachId) => boolean
): CoachStep[] {
  return steps.filter(
    (s) => !s.coachId || s.deferTarget || isMounted(s.coachId)
  )
}

const TOURS: Partial<Record<EntryPath, TourDefinition>> = {
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
      name: 'assets',
      coachId: COACH_IDS.assetsPanel,
      placement: 'auto',
      deferTarget: true,
      openSidebarTab: 'assets'
    }
  ]
}

/**
 * Registers a tour whose steps are built by a higher layer — the layer rules
 * forbid this one from importing them. Re-registering replaces the definition.
 */
export function registerTour(entry: EntryPath, definition: TourDefinition) {
  TOURS[entry] = definition
}

export function tourDefinition(entry: EntryPath): TourDefinition | undefined {
  return TOURS[entry]
}
