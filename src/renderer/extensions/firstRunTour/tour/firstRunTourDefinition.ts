import type { Ref } from 'vue'

import {
  registerCoachmark,
  unregisterCoachmark
} from '@/platform/onboarding/coachmarkRegistry'
import { COACH_IDS } from '@/platform/onboarding/onboardingTours'
import type { CoachId, CoachStep } from '@/platform/onboarding/onboardingTours'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

import { resolveTourRoles } from '../roles/resolveTourRoles'
import { frameNode } from './cameraFraming'

export type RunState = 'idle' | 'generating' | 'succeeded' | 'failed'

const NODE_COACH_IDS = {
  source: 'first-run-source',
  prompt: 'first-run-prompt',
  sink: 'first-run-sink'
} as const

const MOUNT_ATTEMPTS = 60

const registered = new Map<CoachId, HTMLElement>()

export function releaseFirstRunTargets() {
  for (const [coachId, element] of registered)
    unregisterCoachmark(coachId, element)
  registered.clear()
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function registerNodeTarget(
  coachId: CoachId,
  nodeId: NodeId
): Promise<boolean> {
  const selector = `[data-node-id="${CSS.escape(String(nodeId))}"]`
  for (let attempt = 0; attempt < MOUNT_ATTEMPTS; attempt++) {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) {
      registered.set(coachId, element)
      registerCoachmark(coachId, element)
      return true
    }
    await nextFrame()
  }
  return false
}

function nodeStep(name: string, coachId: CoachId, nodeId: NodeId): CoachStep {
  return {
    name,
    coachId,
    placement: 'auto',
    deferTarget: true,
    follow: true,
    onEnter: (signal) => frameNode(nodeId, signal)
  }
}

export async function firstRunTourSteps(
  templateId: string,
  runState: Readonly<Ref<RunState>>
): Promise<CoachStep[]> {
  releaseFirstRunTargets()
  const graph = app.rootGraph
  const roles = graph ? resolveTourRoles(graph, templateId) : null
  if (!roles?.sink) return []
  if (!(await registerNodeTarget(NODE_COACH_IDS.sink, roles.sink))) return []

  const steps: CoachStep[] = []
  if (
    roles.source &&
    (await registerNodeTarget(NODE_COACH_IDS.source, roles.source))
  )
    steps.push(nodeStep('upload', NODE_COACH_IDS.source, roles.source))
  if (
    roles.promptHost &&
    (await registerNodeTarget(NODE_COACH_IDS.prompt, roles.promptHost))
  )
    steps.push({
      ...nodeStep('prompt', NODE_COACH_IDS.prompt, roles.promptHost),
      interactive: true
    })
  steps.push({
    name: 'run',
    coachId: COACH_IDS.graphRunButton,
    placement: 'bottom',
    deferTarget: true,
    interactive: true,
    selfAdvancing: true
  })
  const sink = nodeStep('result', NODE_COACH_IDS.sink, roles.sink)
  steps.push({
    ...sink,
    get name() {
      if (runState.value === 'generating') return 'result.generating'
      if (runState.value === 'failed') return 'result.failed'
      return `result.${roles.mediaKind}`
    },
    busy: () => runState.value === 'generating'
  })
  return steps
}
