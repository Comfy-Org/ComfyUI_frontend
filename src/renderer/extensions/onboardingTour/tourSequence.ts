import type { CoachStep } from '@/platform/onboarding/onboardingTours'
import type {
  OnboardingTourShape,
  OnboardingTourStepKey
} from '@/platform/telemetry/types'
import type { NodeId } from '@/types/nodeId'

/**
 * The kind of media a resolved sink produces, used to pick the Result step's
 * renderer (image vs video player) and to shape telemetry.
 */
export type MediaKind = 'image' | 'video'

/**
 * How to reach the editable prompt widget. The widget is (in every known
 * template) nested inside a subgraph node, so the resolver returns the path to
 * it plus the subgraph's exposed `prompt` input port as a fallback spotlight
 * target when programmatic focus of the inner widget fails.
 */
export interface PromptRole {
  subgraphNodeId: NodeId
  innerNodeId: NodeId
  widgetName: string
  /** Name of the exposed input port on the collapsed subgraph node. */
  portFallback: string | null
}

/** A resolved graph node targeted by a tour step. */
export interface NodeRole {
  nodeId: NodeId
}

/**
 * The roles the resolver extracts from a loaded graph. Any role may be null
 * when it cannot be resolved; the sequence builder omits the corresponding
 * step rather than failing (graceful degradation).
 */
export interface ResolvedRoles {
  /** Top-level input image node (absent for text-to-image → Upload step skipped). */
  source: NodeRole | null
  prompt: PromptRole | null
  engine: NodeRole | null
  sink: NodeRole | null
  mediaKind: MediaKind
}

/** Step kinds are the telemetry step keys, so the two can never drift. */
type TourStepKind = OnboardingTourStepKey

/**
 * What the workflow does, derived from the roles that resolved. Drives both the
 * step copy (the prompt means something different in each) and telemetry tags.
 */
export function shapeOf(roles: ResolvedRoles): OnboardingTourShape {
  if (!roles.prompt || !roles.sink) return 'other'
  if (!roles.source) return 't2i'
  return roles.mediaKind === 'video' ? 'i2v' : 'image-edit'
}

export interface TourStep {
  kind: TourStepKind
  /** Spotlight target; null for Run, which points at the toolbar button. */
  nodeId: NodeId | null
  /** The subgraph-aware path to the editable prompt widget. */
  prompt?: PromptRole
  /** Picks the Result renderer. */
  mediaKind?: MediaKind
  /** Picks the Upload/Prompt copy. */
  shape?: OnboardingTourShape
}

/**
 * Turns resolved roles into the ordered step list by shape: an Upload step only
 * when a source image resolved, then always Prompt → Run → Result. A role that
 * failed to resolve omits its step instead of crashing.
 */
export function sequenceBuilder(roles: ResolvedRoles): TourStep[] {
  const steps: TourStep[] = []
  const shape = shapeOf(roles)

  if (roles.source) {
    steps.push({ kind: 'upload', nodeId: roles.source.nodeId, shape })
  }
  if (roles.prompt) {
    steps.push({ kind: 'prompt', nodeId: null, prompt: roles.prompt, shape })
  }
  steps.push({ kind: 'run', nodeId: null })
  if (roles.sink) {
    steps.push({
      kind: 'result',
      nodeId: roles.sink.nodeId,
      mediaKind: roles.mediaKind
    })
  }

  return steps
}

/** Targetless coach steps, so `resolveSteps` keeps all and indices stay 1:1 with `steps`. */
export function toCoachSteps(steps: TourStep[]): CoachStep[] {
  return steps.map(
    (step): CoachStep => ({ name: step.kind, placement: 'center' })
  )
}
