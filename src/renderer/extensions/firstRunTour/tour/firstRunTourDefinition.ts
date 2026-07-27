import type { VirtualElement } from '@floating-ui/vue'
import type { Ref } from 'vue'

import {
  registerCoachmark,
  unregisterCoachmark
} from '@/platform/onboarding/coachmarkRegistry'
import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'
import type { CoachId, CoachStep } from '@/platform/onboarding/onboardingTours'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

import { resolveTourRoles } from '../roles/resolveTourRoles'
import type { ResolvedRoles } from '../roles/resolveTourRoles'
import { sequenceBuilder } from '../roles/tourSequence'
import type { TourStep } from '../roles/tourSequence'
import { frameNode } from './cameraFraming'
import { canvasNodeRect, canvasNodeTarget } from './canvasCoachTarget'

/** How far the run has got, which is all the Run step's copy has to report. */
export type RunState = 'idle' | 'generating' | 'failed'

/**
 * What the workflow does. The Upload and Prompt steps mean something different
 * in each, so it selects their copy.
 */
type TourShape = 't2i' | 'i2v' | 'image-edit' | 'other'

const COACH_ID: Record<TourStep['kind'], CoachId> = {
  upload: FIRST_RUN_COACH_IDS.source,
  prompt: FIRST_RUN_COACH_IDS.prompt,
  run: FIRST_RUN_COACH_IDS.runButton,
  result: FIRST_RUN_COACH_IDS.sink
}

const registered: [CoachId, VirtualElement][] = []

/** Drops the canvas targets a finished tour registered. */
export function releaseFirstRunTargets() {
  for (const [id, target] of registered) unregisterCoachmark(id, target)
  registered.length = 0
}

function registerCanvasTargets(sequence: TourStep[]) {
  for (const step of sequence) {
    if (step.kind === 'run') continue
    const id = COACH_ID[step.kind]
    const target = canvasNodeTarget(step.nodeId)
    registerCoachmark(id, target)
    registered.push([id, target])
  }
}

function tourShape({
  source,
  promptHost,
  sink,
  mediaKind
}: ResolvedRoles): TourShape {
  if (!promptHost || !sink) return 'other'
  if (!source) return 't2i'
  return mediaKind === 'video' ? 'i2v' : 'image-edit'
}

/** Nodes an earlier step already introduced, which stay lit as the tour moves on. */
function revealedRects(nodeIds: NodeId[]): () => DOMRect[] {
  return () =>
    nodeIds.map(canvasNodeRect).filter((rect): rect is DOMRect => rect !== null)
}

interface StepContext {
  sequence: TourStep[]
  shape: TourShape
  runState: Ref<RunState>
}

/**
 * A step's variant is part of its name, so the engine resolves the copy from
 * `onboardingCoachmarks.firstRun.<name>` without knowing what a template is.
 */
function toCoachStep(
  step: TourStep,
  index: number,
  { sequence, shape, runState }: StepContext
): CoachStep {
  const revealed = sequence
    .slice(0, index)
    .map((earlier) => (earlier.kind === 'run' ? null : earlier.nodeId))
    .filter((nodeId): nodeId is NodeId => nodeId !== null)

  const common = {
    coachId: COACH_ID[step.kind],
    deferTarget: true,
    cursor: true,
    interactive: step.kind === 'prompt' || step.kind === 'run',
    ...(revealed.length && { maskRects: revealedRects(revealed) })
  }

  if (step.kind === 'run')
    return { ...common, name: 'run', placement: 'bottom', selfAdvancing: true }

  const framed = {
    ...common,
    placement: 'auto' as const,
    onEnter: (signal: AbortSignal) =>
      frameNode(step.nodeId, signal, { glide: index > 0 })
  }

  // The run outlives the step that starts it, so Result is where it reports.
  if (step.kind === 'result')
    return {
      ...framed,
      get name() {
        return runState.value === 'idle'
          ? `result.${step.mediaKind}`
          : `result.${runState.value}`
      },
      busy: () => runState.value === 'generating'
    }

  return { ...framed, name: `${step.kind}.${shape}` }
}

/**
 * Builds the first-run tour for a template. A template the tour does not
 * support, or one whose pins have all drifted, leaves nothing worth guiding
 * anyone through — "click Run" alone is not a tour — so it yields no steps and
 * the engine reports that it did not start.
 */
export async function firstRunTourSteps(
  templateId: string,
  runState: Ref<RunState>
): Promise<CoachStep[]> {
  releaseFirstRunTargets()
  const graph = app.rootGraph
  const roles = graph ? resolveTourRoles(graph, templateId) : null
  if (!roles) return []

  const sequence = sequenceBuilder(roles)
  if (sequence.every((step) => step.kind === 'run')) return []

  registerCanvasTargets(sequence)
  const context: StepContext = { sequence, shape: tourShape(roles), runState }
  return sequence.map((step, index) => toCoachStep(step, index, context))
}
