import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { app } from '@/scripts/app'

export type EntryPath = 'appMode' | 'graph'

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
  assetsPanel: 'assets-panel',

  nodeReference: 'node-reference',
  nodePrompt: 'node-prompt',
  graphRunButton: 'graph-run-button'
} as const

type CoachKey = keyof typeof COACH_IDS
export type CoachId = (typeof COACH_IDS)[CoachKey]

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
  /** Open this sidebar tab when the step starts (e.g. to reveal its target). */
  openSidebarTab?: string
  /** Target mounts later (e.g. a dialog); wait for it instead of dropping the step. */
  deferTarget?: boolean
  /** Renders the landing dialog instead of a spotlight. */
  landing?: boolean
  image?: string
}

export function isCoachKey(val: unknown): val is CoachKey {
  return typeof val === 'string' && val in COACH_IDS
}

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
      name: 'assets',
      coachId: COACH_IDS.assetsPanel,
      placement: 'auto',
      deferTarget: true,
      openSidebarTab: 'assets'
    }
  ],
  get graph(): CoachStep[] {
    const nodeKeys: CoachKey[] = ['nodeReference', 'nodePrompt']
    const { nodes } = app.graph
    const nodeSteps: [CoachKey, LGraphNode][] = nodeKeys.flatMap((key) => {
      const node = nodes.find((n) => n.properties.tourStep === key)
      return node ? [[key, node]] : []
    })

    const visible = new Set(app.canvas.visible_nodes.map((node) => node.id))
    if (!nodeSteps.map(([, node]) => node.id).every((id) => visible.has(id))) {
      app.canvas.selectItems(nodeSteps.map(([, node]) => node))
      app.canvas.fitViewToSelectionAnimated()
      app.canvas.selectItems([])
    }
    return [
      ...nodeSteps.map(([key]) => ({
        name: key,
        coachId: COACH_IDS[key],
        placement: 'auto' as const,
        deferTarget: true
      })),
      {
        name: 'run',
        coachId: COACH_IDS.graphRunButton,
        placement: 'auto' as const,
        deferTarget: true
      },
      {
        name: 'assets',
        coachId: COACH_IDS.assetsPanel,
        placement: 'auto' as const,
        deferTarget: true,
        openSidebarTab: 'assets'
      }
    ]
  }
}
