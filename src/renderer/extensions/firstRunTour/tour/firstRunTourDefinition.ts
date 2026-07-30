import type { Ref } from 'vue'

import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'

import {
  registerCoachmark,
  unregisterCoachmark
} from '@/platform/onboarding/coachmarkRegistry'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { COACH_IDS } from '@/platform/onboarding/onboardingTours'
import type { CoachId, CoachStep } from '@/platform/onboarding/onboardingTours'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

import { resolveTourRoles } from '../roles/resolveTourRoles'
import { frameNode } from './cameraFraming'

export type RunState = 'idle' | 'generating' | 'succeeded' | 'failed'

const NODE_COACH_IDS = {
  source: COACH_IDS.firstRunSource,
  prompt: COACH_IDS.firstRunPrompt,
  sink: COACH_IDS.firstRunSink
} as const

export const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'

const MOUNT_DEADLINE_MS = 8000

const registered = new Map<CoachId, HTMLElement>()
let generation = 0

export function releaseFirstRunTargets() {
  generation++
  for (const [coachId, element] of registered)
    unregisterCoachmark(coachId, element)
  registered.clear()
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function registerWhenMounted(coachId: CoachId, nodeId: NodeId) {
  const spawned = generation
  const selector = `.lg-node[data-node-id="${CSS.escape(String(nodeId))}"]`
  const deadline = performance.now() + MOUNT_DEADLINE_MS
  while (generation === spawned && performance.now() < deadline) {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) {
      const previous = registered.get(coachId)
      if (previous === element) return
      if (previous) unregisterCoachmark(coachId, previous)
      registered.set(coachId, element)
      registerCoachmark(coachId, element)
      return
    }
    await nextFrame()
  }
}

function nodeStep(name: string, coachId: CoachId, nodeId: NodeId): CoachStep {
  return {
    name,
    coachId,
    placement: 'auto',
    deferTarget: true,
    interactive: true,
    onEnter: (signal) => {
      void registerWhenMounted(coachId, nodeId)
      return frameNode(nodeId, signal)
    }
  }
}

export function firstRunTourSteps(
  templateId: string,
  runState: Readonly<Ref<RunState>>
): CoachStep[] {
  releaseFirstRunTargets()
  const graph = app.rootGraph
  const roles = graph ? resolveTourRoles(graph, templateId) : null
  if (!roles?.sink) return []
  void registerWhenMounted(NODE_COACH_IDS.sink, roles.sink)

  const steps: CoachStep[] = []
  if (roles.source) {
    void registerWhenMounted(NODE_COACH_IDS.source, roles.source)
    steps.push(nodeStep('upload', NODE_COACH_IDS.source, roles.source))
  }
  if (roles.promptHost) {
    void registerWhenMounted(NODE_COACH_IDS.prompt, roles.promptHost)
    steps.push(nodeStep('prompt', NODE_COACH_IDS.prompt, roles.promptHost))
  }
  steps.push({
    name: 'run',
    coachId: COACH_IDS.graphRunButton,
    placement: 'bottom',
    deferTarget: true,
    interactive: true,
    selfAdvancing: true,
    primaryAction: () =>
      document.querySelector<HTMLElement>(RUN_BUTTON_SELECTOR)?.click()
  })
  const sink = nodeStep('result', NODE_COACH_IDS.sink, roles.sink)
  steps.push({
    ...sink,
    get name() {
      if (runState.value === 'generating') return 'result.generating'
      if (runState.value === 'failed') return 'result.failed'
      return `result.${roles.mediaKind}`
    },
    busy: () => runState.value === 'generating',
    primaryAction: () => {
      const succeeded = runState.value === 'succeeded'
      useOnboardingTourStore().next()
      if (succeeded) useWorkflowTemplateSelectorDialog().show('command')
    }
  })
  return steps
}
