import type { RectTarget } from '@/platform/onboarding/coachmarkRegistry'
import type { Ref } from 'vue'

import {
  registerCoachmark,
  unregisterCoachmark
} from '@/platform/onboarding/coachmarkRegistry'
import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'
import type { CoachId, CoachStep } from '@/platform/onboarding/onboardingTours'
import { app } from '@/scripts/app'

import { resolveTourRoles } from '../roles/resolveTourRoles'
import type { ResolvedRoles } from '../roles/resolveTourRoles'
import { sequenceBuilder } from '../roles/tourSequence'
import type { TourStep } from '../roles/tourSequence'
import { frameNode } from './cameraFraming'
import { canvasNodeTarget } from './canvasCoachTarget'

/** How far the run has got, which is all the Run step's copy has to report. */
export type RunState = 'idle' | 'generating' | 'succeeded' | 'failed'

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

/** Undoes the last registration; the tour holds one target set at a time. */
let releaseRegistered = () => {}

/** Drops the canvas targets a finished tour registered. */
export function releaseFirstRunTargets() {
  releaseRegistered()
  releaseRegistered = () => {}
}

function registerCanvasTargets(sequence: TourStep[]) {
  const registered: [CoachId, RectTarget][] = []
  for (const step of sequence) {
    if (step.kind === 'run') continue
    const id = COACH_ID[step.kind]
    const target = canvasNodeTarget(step.nodeId)
    registerCoachmark(id, target)
    registered.push([id, target])
  }
  releaseRegistered = () => {
    for (const [id, target] of registered) {
      unregisterCoachmark(id, target)
      target.dispose?.()
    }
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

interface StepContext {
  shape: TourShape
  runState: Readonly<Ref<RunState>>
}

/**
 * A step's variant is part of its name, so the engine resolves the copy from
 * `onboardingCoachmarks.firstRun.<name>` without knowing what a template is.
 */
function toCoachStep(
  step: TourStep,
  index: number,
  { shape, runState }: StepContext
): CoachStep {
  const common = {
    kind: 'spotlight' as const,
    coachId: COACH_ID[step.kind],
    deferTarget: true,
    cursor: true,
    interactive: step.kind === 'prompt' || step.kind === 'run'
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
        if (runState.value === 'generating') return 'result.generating'
        if (runState.value === 'failed') return 'result.failed'
        return `result.${step.mediaKind}`
      }
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
  runState: Readonly<Ref<RunState>>
): Promise<CoachStep[]> {
  releaseFirstRunTargets()
  const graph = app.rootGraph
  const roles = graph ? resolveTourRoles(graph, templateId) : null
  if (!roles) return []

  const sequence = sequenceBuilder(roles)
  if (sequence.every((step) => step.kind === 'run')) return []

  registerCanvasTargets(sequence)
  const context: StepContext = { shape: tourShape(roles), runState }
  return sequence.map((step, index) => toCoachStep(step, index, context))
}
