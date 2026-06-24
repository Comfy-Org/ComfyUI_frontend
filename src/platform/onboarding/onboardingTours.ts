import { hasNoSavedWorkflows, isNewUser } from './coachmarkGates'
import type { CoachGate } from './coachmarkGates'

export type EntryPath = 'blankCanvas' | 'appMode'

type CoachPlacement =
  | 'left'
  | 'right'
  | 'center'
  | 'bottom'
  | 'topRight'
  /** Left of the target, vertically centred on it (clamps to the viewport edge). */
  | 'leftCenter'
  /** Sits on whichever horizontal side of the target has more room. */
  | 'auto'

/**
 * Every element a tour can point at, written as `data-coach-id` literals on
 * the real components. The e2e drift guard asserts each id still resolves.
 */
const COACH_IDS = {
  canvas: 'canvas',
  runButton: 'run-button',
  appRunButton: 'app-run-button',
  templatesButton: 'templates-button',
  templatesDialog: 'templates-dialog',
  inputsList: 'inputs-list',
  outputs: 'outputs',
  assetsButton: 'assets-button',
  assetsPanel: 'assets-panel'
} as const

export type CoachId = (typeof COACH_IDS)[keyof typeof COACH_IDS]

/** Builds a selector for one coach id, or a candidate list (first visible wins). */
export function coachTarget(id: CoachId | CoachId[]): string {
  const ids = Array.isArray(id) ? id : [id]
  return ids.map((coachId) => `[data-coach-id="${coachId}"]`).join(', ')
}

export interface CoachStep {
  /** Element to spotlight. A list spotlights the first visible candidate. Omitted for a centered card with no target. */
  coachId?: CoachId | CoachId[]
  titleKey: string
  bodyKey: string
  placement: CoachPlacement
  /** Per-step relevance gate; omitted means always shown. */
  when?: CoachGate
  /** The user advances by clicking the spotlighted element, not Next. */
  advanceOnTargetClick?: boolean
  /** The user advances when the spotlighted element leaves the DOM (e.g. closing a dialog). */
  advanceOnTargetClose?: boolean
  /** Target mounts later (e.g. a dialog); wait for it instead of dropping the step. */
  deferTarget?: boolean
  /** Computes the spotlight rect instead of measuring the element (e.g. the canvas pane). */
  rectOverride?: () => DOMRect | null
  /** Stronger card shadow for when the card sits over another surface. */
  elevated?: boolean
  /** Overrides the primary button label (defaults to Next / Done). */
  primaryLabelKey?: string
  /** Overrides the secondary (Skip) button label. */
  skipLabelKey?: string
  /** Enables Nodes 2.0 before advancing. */
  enablesNodes2?: boolean
  /** Loads this core workflow template before advancing (e.g. the tutorial's app). */
  loadTemplate?: string
  /**
   * Renders a full-screen, non-closable landing dialog (image + overview)
   * instead of a spotlight, e.g. the opening step of a section's tour.
   */
  landing?: boolean
  /** Image shown on the landing dialog's left panel. */
  image?: string
}

/** Prepended when Nodes 2.0 is off — the canvas guidance assumes the Vue renderer. */
export const NODES_2_GATE_STEP: CoachStep = {
  titleKey: 'onboardingCoachmarks.enableNodes2.title',
  bodyKey: 'onboardingCoachmarks.enableNodes2.body',
  placement: 'center',
  primaryLabelKey: 'onboardingCoachmarks.enableNodes2.action',
  enablesNodes2: true
}

/** Breathing room the spotlight glow adds around its rect. */
export const SPOTLIGHT_PAD = 8

/** A step is relevant unless its gate fails; a throwing gate is treated as a fail. */
export async function passesGate(step: CoachStep): Promise<boolean> {
  if (!step.when) return true
  try {
    return await step.when()
  } catch {
    return false
  }
}

/**
 * Resolves which of a tour's steps actually run: drops steps whose target isn't
 * mounted (unless deferred), then applies each step's relevance gate unless the
 * caller is replaying the tour past its gates.
 */
export async function resolveSteps(
  steps: CoachStep[],
  options: {
    bypassGates: boolean
    isMounted: (id: CoachId | CoachId[]) => boolean
  }
): Promise<CoachStep[]> {
  const candidates = steps.filter(
    (s) => !s.coachId || s.deferTarget || options.isMounted(s.coachId)
  )
  if (options.bypassGates) return candidates
  const verdicts = await Promise.all(candidates.map(passesGate))
  return candidates.filter((_, i) => verdicts[i])
}

const WORKFLOW_TABS = '[data-testid="topbar-workflow-tabs"]'

/**
 * `#graph-canvas` spans the full viewport (sidebar/topbar float above it), so
 * spotlight the center splitter pane instead — top extended to the tab bar,
 * edges clamped so the whole ring stays on screen.
 */
function visibleCanvasRect(): DOMRect | null {
  const pane = document.querySelector(coachTarget(COACH_IDS.canvas))
  if (!pane) return null
  const rect = pane.getBoundingClientRect()
  const tabs = document.querySelector(WORKFLOW_TABS)?.getBoundingClientRect()
  const edgeInset = SPOTLIGHT_PAD + 6
  const top = tabs ? tabs.bottom + SPOTLIGHT_PAD : rect.top
  const left = Math.max(rect.left, edgeInset)
  const right = Math.min(rect.right, window.innerWidth - edgeInset)
  const bottom = Math.min(rect.bottom, window.innerHeight - edgeInset)
  return new DOMRect(left, top, right - left, bottom - top)
}

export const TOURS: Record<EntryPath, CoachStep[]> = {
  blankCanvas: [
    {
      coachId: COACH_IDS.canvas,
      titleKey: 'onboardingCoachmarks.blankCanvas.canvas.title',
      bodyKey: 'onboardingCoachmarks.blankCanvas.canvas.body',
      placement: 'center',
      rectOverride: visibleCanvasRect,
      when: isNewUser
    },
    {
      coachId: COACH_IDS.templatesButton,
      titleKey: 'onboardingCoachmarks.blankCanvas.templates.title',
      bodyKey: 'onboardingCoachmarks.blankCanvas.templates.body',
      placement: 'right',
      when: hasNoSavedWorkflows,
      advanceOnTargetClick: true
    },
    {
      coachId: COACH_IDS.templatesDialog,
      titleKey: 'onboardingCoachmarks.blankCanvas.templatesDialog.title',
      bodyKey: 'onboardingCoachmarks.blankCanvas.templatesDialog.body',
      placement: 'topRight',
      when: hasNoSavedWorkflows,
      deferTarget: true,
      elevated: true,
      advanceOnTargetClose: true
    },
    {
      // A workflow template stays in the graph (run-button); an app template
      // switches to app mode (app-run-button). Spotlight whichever is visible.
      coachId: [COACH_IDS.runButton, COACH_IDS.appRunButton],
      titleKey: 'onboardingCoachmarks.blankCanvas.run.title',
      bodyKey: 'onboardingCoachmarks.blankCanvas.run.body',
      placement: 'bottom',
      when: hasNoSavedWorkflows,
      deferTarget: true
    }
  ],
  appMode: [
    {
      landing: true,
      titleKey: 'onboardingCoachmarks.appMode.landing.title',
      bodyKey: 'onboardingCoachmarks.appMode.landing.body',
      placement: 'center',
      primaryLabelKey: 'onboardingCoachmarks.appMode.landing.start',
      skipLabelKey: 'onboardingCoachmarks.appMode.landing.skip',
      loadTemplate: 'template_contact_sheet-step_1.app'
    },
    {
      coachId: COACH_IDS.inputsList,
      titleKey: 'onboardingCoachmarks.appMode.inputs.title',
      bodyKey: 'onboardingCoachmarks.appMode.inputs.body',
      image: '/assets/images/default-template.png',
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
      advanceOnTargetClick: true
    },
    {
      // The panel mounts when the button above is clicked.
      coachId: COACH_IDS.assetsPanel,
      titleKey: 'onboardingCoachmarks.appMode.assets.title',
      bodyKey: 'onboardingCoachmarks.appMode.assets.body',
      placement: 'right',
      deferTarget: true
    }
  ]
}
