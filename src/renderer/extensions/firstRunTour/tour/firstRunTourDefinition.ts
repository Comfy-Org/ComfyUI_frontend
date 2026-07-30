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

async function registerWhenMounted(coachId: CoachId, nodeId: NodeId) {
  const selector = `[data-node-id="${CSS.escape(String(nodeId))}"]`
  for (let attempt = 0; attempt < MOUNT_ATTEMPTS; attempt++) {
    const element = document.querySelector<HTMLElement>(selector)
    if (element) {
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
    onEnter: (signal) => frameNode(nodeId, signal)
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
      document
        .querySelector<HTMLElement>('[data-testid="queue-button"]')
        ?.click()
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
