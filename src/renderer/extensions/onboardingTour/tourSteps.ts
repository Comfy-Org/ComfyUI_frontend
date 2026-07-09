type TourStepKind =
  | 'reveal'
  | 'type'
  | 'connect'
  | 'run'
  | 'generating'
  | 'result'
  | 'done'

interface TourStepBase {
  kind: TourStepKind
  /** i18n key suffix under `onboardingTour.hint` for the coach-mark copy. */
  key: string
  /** Node type to spotlight; resolved to a live node id at runtime. */
  targetNodeType?: string
  /** When a template has duplicates of a type, pick the Nth (0-based). */
  targetNodeOccurrence?: number
  /** CSS selector for a DOM target (e.g. a toolbar button) instead of a node. */
  domTarget?: string
  /** Whether the step advances on its own action; talk-steps use Next. */
  auto?: boolean
}

interface RevealStep extends TourStepBase {
  kind: 'reveal'
}

interface DoneStep extends TourStepBase {
  kind: 'done'
}

interface TypeStep extends TourStepBase {
  kind: 'type'
  /** Widget name on the node whose value the user must fill in, if any. */
  widgetName?: string
}

/** Point at a DOM element (e.g. the Run button) and advance when it is clicked. */
interface RunStep extends TourStepBase {
  kind: 'run'
  domTarget: string
}

/** Waits, showing live progress, until the workflow finishes generating. */
interface GeneratingStep extends TourStepBase {
  kind: 'generating'
}

/** Celebrates the produced image with a CTA to explore more workflows. */
interface ResultStep extends TourStepBase {
  kind: 'result'
}

/**
 * The user must drag a link from `targetNodeType`'s output slot into the input
 * slot below. On tour start this exact link is pre-cleared so the drag is real.
 */
export interface ConnectStep extends TourStepBase {
  kind: 'connect'
  targetNodeType: string
  fromSlot: number
  toNodeType: string
  toNodeOccurrence?: number
  toSlot: number
}

export type TourStep =
  | RevealStep
  | TypeStep
  | ConnectStep
  | RunStep
  | GeneratingStep
  | ResultStep
  | DoneStep

export const TOUR_TEMPLATE_ID = 'flux_kontext_dev_basic'
export const TOUR_TEMPLATE_SOURCE = 'default'

/** The Image Edit (Flux.1 Kontext Dev) subgraph node — one box that does the edit. */
export const EDIT_ENGINE_TYPE = '654c828f-2572-47e8-ba85-8a832c89b30c'

/** Run button in the top bar; the cloud paywalled variant falls back to this list. */
const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'

/**
 * Beginner image-edit flow, sequenced for momentum → ownership → aha:
 * intro → wire it up → make it yours (prompt) → run → see your result.
 */
export const tourSteps: TourStep[] = [
  {
    kind: 'reveal',
    key: 'welcome',
    targetNodeType: 'LoadImage'
  },
  {
    kind: 'connect',
    key: 'connect',
    targetNodeType: 'LoadImage',
    fromSlot: 0,
    toNodeType: EDIT_ENGINE_TYPE,
    toSlot: 0,
    auto: true
  },
  {
    kind: 'type',
    key: 'prompt',
    targetNodeType: EDIT_ENGINE_TYPE,
    widgetName: 'text'
  },
  {
    kind: 'reveal',
    key: 'save',
    targetNodeType: 'SaveImage'
  },
  {
    kind: 'run',
    key: 'run',
    domTarget: RUN_BUTTON_SELECTOR,
    auto: true
  },
  {
    kind: 'generating',
    key: 'generating',
    targetNodeType: EDIT_ENGINE_TYPE,
    auto: true
  },
  {
    kind: 'result',
    key: 'result',
    targetNodeType: 'SaveImage'
  }
]
