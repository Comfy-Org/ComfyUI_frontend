import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import {
  clearCoachmarks,
  targetMounted
} from '@/platform/onboarding/coachmarkRegistry'
import { FIRST_RUN_COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { toNodeId } from '@/types/nodeId'

import { TOUR_ROLE_PINS } from '../roles/tourRolePins'
import type { RolePin } from '../roles/tourRolePins'
import type * as CanvasCoachTarget from './canvasCoachTarget'
import {
  firstRunTourSteps,
  releaseFirstRunTargets
} from './firstRunTourDefinition'
import type { RunState } from './firstRunTourDefinition'

const FROM_IMAGE = 'image_qwen_image_edit_2509'
const FROM_TEXT = 'image_z_image_turbo'
const VIDEO = 'video_ltx2_i2v_distilled'
const NO_PROMPT = 'templates-image_to_real'

const runState = ref<RunState>('idle')
const framings: { glide?: boolean }[] = []

const disposals = vi.hoisted(() => ({ spy: vi.fn() }))
vi.mock('./canvasCoachTarget', async (importOriginal) => {
  const actual = await importOriginal<typeof CanvasCoachTarget>()
  return {
    canvasNodeTarget: (...args: Parameters<typeof actual.canvasNodeTarget>) => {
      const target = actual.canvasNodeTarget(...args)
      return {
        ...target,
        dispose: () => {
          disposals.spy()
          target.dispose?.()
        }
      }
    }
  }
})

vi.mock('./cameraFraming', () => ({
  frameNode: (_id: unknown, _signal: AbortSignal, options = {}) => {
    framings.push(options)
    return Promise.resolve()
  }
}))

async function buildSteps(templateId: keyof typeof TOUR_ROLE_PINS | string) {
  const { steps } = await firstRunTourSteps(templateId, runState)
  return steps
}

function buildResolution(templateId: keyof typeof TOUR_ROLE_PINS | string) {
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
            ds: new DragAndScale(document.createElement('canvas')),
            canvas: { getBoundingClientRect: () => new DOMRect(0, 0, 800, 600) }
          }
        : undefined
    }
  }
}))

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
  layoutStore.initializeFromLiteGraph(graph.nodes)
  useCanvasStore().currentGraph = graph
  return graph
}

describe('firstRunTourSteps', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    disposals.spy.mockClear()
  })

  afterEach(() => {
    releaseFirstRunTargets()
    clearCoachmarks()
    document.body.replaceChildren()
    appState.graph = undefined
    runState.value = 'idle'
    framings.length = 0
  })

  it('gives a template the tour does not support no steps', async () => {
    loadTemplate(FROM_IMAGE)

    await expect(
      buildResolution('some_shared_workflow'),
      'an unsupported template needs pins, which is a different fix from drift'
    ).resolves.toEqual({ steps: [], reason: 'no_roles' })
  })

  it('gives no steps when every pin has drifted and only Run is left', async () => {
    appState.graph = new LGraph()

    await expect(
      buildResolution(FROM_IMAGE),
      'a lone "click Run" step is not worth taking over the screen for'
    ).resolves.toEqual({ steps: [], reason: 'run_only' })
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
    { templateId: NO_PROMPT, names: ['upload.other', 'run', 'result.image'] }
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

    runState.value = 'failed'
    expect(
      result?.name,
      'a run that produced nothing must not be announced as a result'
    ).toBe('result.failed')

    runState.value = 'idle'
    expect(result?.name).toBe('result.image')
  })

  it('lets only interactive steps take pointer input', async () => {
    loadTemplate(FROM_IMAGE)

    const interactive = (await buildSteps(FROM_IMAGE))
      .filter((step) => step.kind === 'spotlight' && step.interactive)
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

  it('releases what each target watches, not just its registration', async () => {
    loadTemplate(FROM_IMAGE)
    const steps = await buildSteps(FROM_IMAGE)
    const onCanvas = steps.filter(
      (s) =>
        s.kind === 'spotlight' &&
        s.coachId &&
        s.coachId !== FIRST_RUN_COACH_IDS.runButton
    )
    expect(onCanvas.length).toBeGreaterThan(0)

    releaseFirstRunTargets()

    expect(
      disposals.spy,
      'unregistering only hides a target; its observers run until it is disposed'
    ).toHaveBeenCalledTimes(onCanvas.length)
  })

  it('releases the previous target set when it builds the tour again', async () => {
    loadTemplate(FROM_IMAGE)
    const steps = await buildSteps(FROM_IMAGE)
    const onCanvas = steps.filter(
      (s) =>
        s.kind === 'spotlight' &&
        s.coachId &&
        s.coachId !== FIRST_RUN_COACH_IDS.runButton
    )

    await buildSteps(FROM_IMAGE)

    expect(
      disposals.spy,
      'a stale target left registered competes with the live one for the same id'
    ).toHaveBeenCalledTimes(onCanvas.length)
  })
})
