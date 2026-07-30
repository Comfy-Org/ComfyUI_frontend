import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  clearCoachmarks,
  coachmarkElements
} from '@/platform/onboarding/coachmarkRegistry'
import { toNodeId } from '@/types/nodeId'

import { TOUR_ROLE_PINS } from '../roles/tourRolePins'
import type { RunState } from './firstRunTourDefinition'

const mocks = vi.hoisted(() => ({
  rootGraph: null as unknown,
  next: vi.fn(),
  showTemplates: vi.fn()
}))
vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return mocks.rootGraph
    }
  }
}))
vi.mock('./cameraFraming', () => ({ frameNode: vi.fn() }))
vi.mock('@/platform/onboarding/onboardingTourStore', () => ({
  useOnboardingTourStore: () => ({ next: mocks.next })
}))
vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: mocks.showTemplates })
}))

import { firstRunTourSteps } from './firstRunTourDefinition'

const TEMPLATE_ID = 'video_wan2_2_14B_i2v'

function pinnedGraph() {
  const graph = createTestRootGraph()
  for (const pin of Object.values(TOUR_ROLE_PINS[TEMPLATE_ID])) {
    const node = new LGraphNode(pin.type, pin.type)
    node.id = toNodeId(pin.id)
    graph.add(node)
    const element = document.createElement('div')
    element.setAttribute('data-node-id', String(pin.id))
    element.getBoundingClientRect = () => new DOMRect(0, 0, 80, 40)
    document.body.append(element)
  }
  return graph
}

describe('firstRunTourSteps', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clearCoachmarks()
    document.body.replaceChildren()
    mocks.rootGraph = null
    mocks.next.mockClear()
    mocks.showTemplates.mockClear()
  })

  it('walks upload, prompt, run, result and registers the node targets', async () => {
    mocks.rootGraph = pinnedGraph()
    const steps = await firstRunTourSteps(TEMPLATE_ID, ref<RunState>('idle'))
    expect(steps.map((step) => step.name)).toEqual([
      'upload',
      'prompt',
      'run',
      'result.video'
    ])
    for (const coachId of [
      'first-run-source',
      'first-run-prompt',
      'first-run-sink'
    ])
      expect(coachmarkElements(coachId)).toHaveLength(1)
  })

  it('gives an unsupported template no steps and no targets', async () => {
    mocks.rootGraph = pinnedGraph()
    const steps = await firstRunTourSteps('some_shared', ref<RunState>('idle'))
    expect(steps).toEqual([])
    expect(coachmarkElements('first-run-sink')).toHaveLength(0)
  })

  it('gives drifted pins no steps', async () => {
    mocks.rootGraph = createTestRootGraph()
    expect(await firstRunTourSteps(TEMPLATE_ID, ref<RunState>('idle'))).toEqual(
      []
    )
  })

  it('tracks the run through the result step name', async () => {
    mocks.rootGraph = pinnedGraph()
    const runState = ref<RunState>('idle')
    const steps = await firstRunTourSteps(TEMPLATE_ID, runState)
    const result = steps.at(-1)!
    runState.value = 'generating'
    expect(result.name).toBe('result.generating')
    expect(result.busy?.()).toBe(true)
    runState.value = 'failed'
    expect(result.name).toBe('result.failed')
    runState.value = 'succeeded'
    expect(result.name).toBe('result.video')
  })

  it('sends a finished user to the template library, a failed one just out', async () => {
    mocks.rootGraph = pinnedGraph()
    const runState = ref<RunState>('succeeded')
    const steps = await firstRunTourSteps(TEMPLATE_ID, runState)
    steps.at(-1)!.primaryAction!()
    expect(mocks.next).toHaveBeenCalledTimes(1)
    expect(mocks.showTemplates).toHaveBeenCalledWith('command')

    runState.value = 'failed'
    steps.at(-1)!.primaryAction!()
    expect(mocks.next).toHaveBeenCalledTimes(2)
    expect(mocks.showTemplates).toHaveBeenCalledTimes(1)
  })
})
