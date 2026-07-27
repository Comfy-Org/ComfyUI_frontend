import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  clearCoachmarks,
  targetMounted
} from '@/platform/onboarding/coachmarkRegistry'
import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { toNodeId } from '@/types/nodeId'

import { TOUR_ROLE_PINS } from '../roles/tourRolePins'
import type { RolePin } from '../roles/tourRolePins'
import {
  firstRunTourSteps,
  releaseFirstRunTargets
} from './firstRunTourDefinition'
import type { RunState } from './firstRunTourDefinition'

const FROM_IMAGE = 'image_qwen_image_edit_2509'
const FROM_TEXT = 'image_z_image_turbo'
const VIDEO = 'gsc_advanced_3_1'
const NO_PROMPT = 'gsc_advanced_3_2'

const runState = ref<RunState>('idle')
const framings: { glide?: boolean }[] = []

vi.mock('./cameraFraming', () => ({
  frameNode: (_id: unknown, _signal: AbortSignal, options = {}) => {
    framings.push(options)
    return Promise.resolve()
  }
}))

function buildSteps(templateId: keyof typeof TOUR_ROLE_PINS | string) {
  return firstRunTourSteps(templateId, runState)
}

const appState = vi.hoisted(() => ({ graph: undefined as LGraph | undefined }))
vi.mock('@/scripts/app', () => ({
  app: {
    get rootGraph() {
      return appState.graph
    },
    get canvas() {
      return appState.graph
        ? {
            graph: appState.graph,
            ds: { offset: [0, 0], scale: 1 },
            canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 800, 600) }
          }
        : undefined
    }
  }
}))

/** A live graph holding the template's pinned nodes, measured as the renderer would. */
function loadTemplate(templateId: keyof typeof TOUR_ROLE_PINS): LGraph {
  const graph = new LGraph()
  const { source, prompt, sink } = TOUR_ROLE_PINS[templateId]
  for (const pin of [source, prompt, sink].filter(
    (candidate): candidate is RolePin => candidate !== undefined
  )) {
    const node = new LGraphNode(pin.type, pin.type)
    node.id = toNodeId(pin.id)
    node.pos = [pin.id, pin.id]
    node.size = [120, 80]
    graph.add(node)
    node.updateArea()
  }
  appState.graph = graph
  return graph
}

describe('firstRunTourSteps', () => {
  afterEach(() => {
    releaseFirstRunTargets()
    clearCoachmarks()
    appState.graph = undefined
    runState.value = 'idle'
    framings.length = 0
  })

  it('gives a template the tour does not support no steps', async () => {
    loadTemplate(FROM_IMAGE)

    await expect(buildSteps('some_shared_workflow')).resolves.toEqual([])
  })

  it('gives no steps when every pin has drifted and only Run is left', async () => {
    appState.graph = new LGraph()

    await expect(
      buildSteps(FROM_IMAGE),
      'a lone "click Run" step is not worth taking over the screen for'
    ).resolves.toEqual([])
  })

  it.for<{ templateId: keyof typeof TOUR_ROLE_PINS; names: string[] }>([
    {
      templateId: FROM_IMAGE,
      names: ['upload.image-edit', 'prompt.image-edit', 'run', 'result.image']
    },
    { templateId: FROM_TEXT, names: ['prompt.t2i', 'run', 'result.image'] },
    {
      templateId: VIDEO,
      names: ['upload.i2v', 'prompt.i2v', 'run', 'result.video']
    },
    { templateId: NO_PROMPT, names: ['upload.other', 'run', 'result.video'] }
  ])(
    'names $templateId steps for what the workflow does',
    async ({ templateId, names }) => {
      loadTemplate(templateId)

      const steps = await buildSteps(templateId)

      expect(steps.map((step) => step.name)).toEqual(names)
    }
  )

  it('frames the opening step without waiting out a glide it has no room for', async () => {
    loadTemplate(FROM_IMAGE)
    const [first, second] = await buildSteps(FROM_IMAGE)

    await first.onEnter?.(new AbortController().signal)
    expect(
      framings,
      'the opening card has nowhere to travel from, so the camera must not stall for it'
    ).toEqual([{ glide: false }])

    void second.onEnter?.(new AbortController().signal)
    expect(framings.at(-1)).toEqual({ glide: true })
  })

  it('reports the run through the Result step, which outlives it', async () => {
    loadTemplate(FROM_TEXT)
    const result = (await buildSteps(FROM_TEXT)).at(-1)

    runState.value = 'generating'
    expect(result?.name).toBe('result.generating')
    expect(result?.busy?.()).toBe(true)

    runState.value = 'failed'
    expect(
      result?.name,
      'a run that produced nothing must not be announced as a result'
    ).toBe('result.failed')
    expect(result?.busy?.()).toBe(false)

    runState.value = 'idle'
    expect(result?.name).toBe('result.image')
  })

  it('lets only interactive steps take pointer input', async () => {
    loadTemplate(FROM_IMAGE)

    const interactive = (await buildSteps(FROM_IMAGE))
      .filter((step) => step.interactive)
      .map((step) => step.name)

    expect(interactive).toEqual(['prompt.image-edit', 'run'])
  })

  it('registers each spotlit node so the engine can find it', async () => {
    loadTemplate(FROM_IMAGE)

    await buildSteps(FROM_IMAGE)
    expect(targetMounted(FIRST_RUN_COACH_IDS.source)).toBe(true)
    expect(targetMounted(FIRST_RUN_COACH_IDS.sink)).toBe(true)

    releaseFirstRunTargets()
    expect(
      targetMounted(FIRST_RUN_COACH_IDS.source),
      'a finished tour must not leave its targets behind'
    ).toBe(false)
  })
})
