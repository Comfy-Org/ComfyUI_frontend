import { describe, expect, it } from 'vitest'

import { selectWorkflowRoute } from './selectWorkflowRoute'
import type {
  RunnableWorkflowRouteSelection,
  WorkflowRouteAvailability,
  WorkflowRouteCandidate
} from './selectWorkflowRoute'
import type { WorkflowPlan } from '../../schemas/workflowPlanSchema'

const readyAvailability = {
  status: 'ready'
} satisfies WorkflowRouteAvailability

function plan(overrides: Partial<WorkflowPlan> = {}): WorkflowPlan {
  return {
    version: 1,
    brief: 'Generate an image',
    summary: 'Image generation',
    intent: 'text-to-image',
    inputs: [],
    outputMediaType: 'image',
    qualityGoal: 'balanced',
    executionPreference: 'auto',
    constraints: [],
    structure: { kind: 'single' },
    clarification: { status: 'ready' },
    ...overrides
  }
}

function route(
  id: string,
  overrides: Partial<WorkflowRouteCandidate> = {}
): WorkflowRouteCandidate {
  return {
    id,
    title: id,
    intents: ['text-to-image'],
    inputCapacity: {},
    outputMediaType: 'image',
    supportedStructures: ['single'],
    supportedPipelineIntents: [],
    maxWorkUnits: 1,
    executionMode: 'local',
    isPaid: false,
    taskFitScore: 80,
    qualityScore: 80,
    speedScore: 80,
    availability: readyAvailability,
    ...overrides
  }
}

describe('selectWorkflowRoute', () => {
  it('waits for required user input before evaluating routes', () => {
    const selection = selectWorkflowRoute(
      plan({
        clarification: {
          status: 'needs-input',
          question: 'Which aspect ratio should the result use?'
        }
      }),
      [route('otherwise-ready')]
    )

    expect(selection).toEqual({ status: 'needs-input' })
  })

  it('selects the highest-quality route for a best-quality plan', () => {
    const selection = selectWorkflowRoute(plan({ qualityGoal: 'best' }), [
      route('fast', { qualityScore: 94, speedScore: 100 }),
      route('quality', { qualityScore: 95, speedScore: 0 })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'quality' }
    })
  })

  it('selects the fastest route for a draft plan with equal task fit', () => {
    const selection = selectWorkflowRoute(plan({ qualityGoal: 'draft' }), [
      route('slow', { qualityScore: 100, speedScore: 94 }),
      route('fast', { qualityScore: 0, speedScore: 95 })
    ])

    expect(selection).toMatchObject({ status: 'ready', route: { id: 'fast' } })
  })

  it('does not trade task suitability for a generic quality score', () => {
    const selection = selectWorkflowRoute(plan(), [
      route('specialist', { taskFitScore: 81, qualityScore: 1 }),
      route('generic', { taskFitScore: 80, qualityScore: 100 })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'specialist' }
    })
  })

  it('recommends setup for the best route instead of silently downgrading', () => {
    const selection = selectWorkflowRoute(plan({ qualityGoal: 'best' }), [
      route('installed-fallback', { qualityScore: 70 }),
      route('best-local', {
        qualityScore: 98,
        availability: {
          status: 'setup-required',
          missingModels: ['best-model.safetensors'],
          missingNodeTypes: ['BestSampler']
        }
      })
    ])

    expect(selection).toMatchObject({
      status: 'setup-required',
      route: { id: 'best-local' },
      fallback: {
        status: 'ready',
        route: { id: 'installed-fallback' }
      }
    })
  })

  it('preserves approval for a paid fallback', () => {
    const selection = selectWorkflowRoute(plan({ qualityGoal: 'best' }), [
      route('paid-cloud-fallback', {
        executionMode: 'cloud',
        isPaid: true,
        qualityScore: 70
      }),
      route('best-local', {
        qualityScore: 98,
        availability: {
          status: 'setup-required',
          missingModels: ['best-model.safetensors'],
          missingNodeTypes: []
        }
      })
    ])

    expect(selection).toMatchObject({
      status: 'setup-required',
      route: { id: 'best-local' },
      fallback: {
        status: 'approval-required',
        route: { id: 'paid-cloud-fallback' }
      }
    })
  })

  it('requires approval before selecting a ready paid cloud route', () => {
    const selection = selectWorkflowRoute(plan({ qualityGoal: 'best' }), [
      route('local', { qualityScore: 70 }),
      route('cloud', {
        executionMode: 'cloud',
        isPaid: true,
        qualityScore: 99
      })
    ])

    expect(selection.status).toBe('approval-required')
    if (selection.status !== 'approval-required')
      throw new Error('expected approval to be required')
    const runnableSelection: RunnableWorkflowRouteSelection = selection
    expect(runnableSelection.route.id).toBe('cloud')
  })

  it('requires approval for any paid route', () => {
    const selection = selectWorkflowRoute(plan(), [
      route('licensed-local-service', { isPaid: true })
    ])

    expect(selection).toMatchObject({
      status: 'approval-required',
      route: { id: 'licensed-local-service' }
    })
  })

  it('excludes cloud routes when the plan is local-only', () => {
    const selection = selectWorkflowRoute(
      plan({ executionPreference: 'local-only', qualityGoal: 'best' }),
      [
        route('local', { qualityScore: 60 }),
        route('cloud', {
          executionMode: 'cloud',
          isPaid: true,
          qualityScore: 100
        })
      ]
    )

    expect(selection).toMatchObject({ status: 'ready', route: { id: 'local' } })
  })

  it('prefers local when otherwise-identical routes tie', () => {
    const local = route('local')
    const cloud = route('cloud', { executionMode: 'cloud' })

    for (const candidates of [
      [cloud, local],
      [local, cloud]
    ]) {
      expect(selectWorkflowRoute(plan(), candidates)).toMatchObject({
        status: 'ready',
        route: { id: 'local' }
      })
    }
  })

  it('prefers a free route when otherwise-identical routes tie', () => {
    const free = route('free')
    const paid = route('paid', { isPaid: true })

    for (const candidates of [
      [free, paid],
      [paid, free]
    ]) {
      expect(selectWorkflowRoute(plan(), candidates)).toMatchObject({
        status: 'ready',
        route: { id: 'free' }
      })
    }
  })

  it('does not charge for a local route when an equivalent cloud route is free', () => {
    const paidLocal = route('paid-local', { isPaid: true })
    const freeCloud = route('free-cloud', { executionMode: 'cloud' })

    for (const candidates of [
      [paidLocal, freeCloud],
      [freeCloud, paidLocal]
    ]) {
      expect(selectWorkflowRoute(plan(), candidates)).toMatchObject({
        status: 'ready',
        route: { id: 'free-cloud' }
      })
    }
  })

  it('uses a locale-independent id tie-breaker', () => {
    const upperCase = route('Zebra')
    const lowerCase = route('alpha')

    for (const candidates of [
      [lowerCase, upperCase],
      [upperCase, lowerCase]
    ]) {
      expect(selectWorkflowRoute(plan(), candidates)).toMatchObject({
        status: 'ready',
        route: { id: 'Zebra' }
      })
    }
  })

  it('requires enough capacity for every referenced input', () => {
    const twoReferences = plan({
      intent: 'image-to-video',
      inputs: [
        {
          id: 'dog',
          mediaType: 'image',
          quantity: 1,
          purpose: 'Dog reference'
        },
        {
          id: 'sheep',
          mediaType: 'image',
          quantity: 1,
          purpose: 'Sheep reference'
        }
      ],
      outputMediaType: 'video'
    })
    const selection = selectWorkflowRoute(twoReferences, [
      route('single-reference', {
        intents: ['image-to-video'],
        inputCapacity: { image: 1 },
        outputMediaType: 'video',
        qualityScore: 100
      }),
      route('multi-reference', {
        intents: ['image-to-video'],
        inputCapacity: { image: 4 },
        outputMediaType: 'video',
        qualityScore: 80
      })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'multi-reference' }
    })
  })

  it('does not substitute a single clip route for a long sequence', () => {
    const minuteSequence = plan({
      intent: 'image-to-video',
      inputs: [
        {
          id: 'characters',
          mediaType: 'image',
          quantity: 2,
          purpose: 'Character references'
        }
      ],
      outputMediaType: 'video',
      targetDurationSeconds: 60,
      structure: {
        kind: 'sequence',
        units: Array.from({ length: 6 }, (_, index) => ({
          id: `shot-${index + 1}`,
          label: `Shot ${index + 1}`,
          instruction: `Story beat ${index + 1}`,
          durationSeconds: 10
        })),
        continuityConstraints: ['Keep both characters consistent']
      }
    })
    const selection = selectWorkflowRoute(minuteSequence, [
      route('five-second-clip', {
        intents: ['image-to-video'],
        inputCapacity: { image: 2 },
        outputMediaType: 'video',
        supportedStructures: ['sequence'],
        maxWorkUnits: 8,
        maxDurationSeconds: 5,
        qualityScore: 100
      }),
      route('minute-story', {
        intents: ['image-to-video'],
        inputCapacity: { image: 2 },
        outputMediaType: 'video',
        supportedStructures: ['sequence'],
        maxWorkUnits: 8,
        maxDurationSeconds: 60,
        qualityScore: 80
      })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'minute-story' }
    })
  })

  it('requires a route to support the requested batch size', () => {
    const batch = plan({
      structure: { kind: 'batch', unitCount: 8 }
    })
    const selection = selectWorkflowRoute(batch, [
      route('four-variants', {
        supportedStructures: ['batch'],
        maxWorkUnits: 4
      }),
      route('eight-variants', {
        supportedStructures: ['batch'],
        maxWorkUnits: 8
      })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'eight-variants' }
    })
  })

  it('requires a route to support every explicit batch item duration', () => {
    const batch = plan({
      intent: 'text-to-video',
      outputMediaType: 'video',
      targetDurationSeconds: 5,
      structure: {
        kind: 'batch',
        unitCount: 2,
        units: [
          {
            id: 'short',
            label: 'Short clip',
            instruction: 'Create a short variant',
            durationSeconds: 5
          },
          {
            id: 'long',
            label: 'Long clip',
            instruction: 'Create a long variant',
            durationSeconds: 30
          }
        ]
      }
    })
    const selection = selectWorkflowRoute(batch, [
      route('short-clips', {
        intents: ['text-to-video'],
        outputMediaType: 'video',
        supportedStructures: ['batch'],
        maxWorkUnits: 2,
        maxDurationSeconds: 5,
        qualityScore: 100
      }),
      route('long-clips', {
        intents: ['text-to-video'],
        outputMediaType: 'video',
        supportedStructures: ['batch'],
        maxWorkUnits: 2,
        maxDurationSeconds: 30,
        qualityScore: 80
      })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'long-clips' }
    })
  })

  it('requires explicit pipeline support for a multi-capability plan', () => {
    const pipeline = plan({
      intent: 'text-to-video',
      outputMediaType: 'video',
      structure: { kind: 'single' },
      pipeline: {
        stages: [
          {
            id: 'image',
            intent: 'text-to-image',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'image',
            instruction: 'Create the keyframe'
          },
          {
            id: 'motion',
            intent: 'image-to-video',
            dependsOnStageIds: ['image'],
            inputMediaTypes: ['image'],
            outputMediaType: 'video',
            instruction: 'Animate the keyframe'
          }
        ]
      }
    })
    const selection = selectWorkflowRoute(pipeline, [
      route('single-video', {
        intents: ['text-to-video'],
        outputMediaType: 'video'
      }),
      route('composed-video', {
        intents: ['text-to-video'],
        outputMediaType: 'video',
        supportedPipelineIntents: ['text-to-image', 'image-to-video']
      })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'composed-video' }
    })
  })

  it('requires support for every capability in a pipeline', () => {
    const production = plan({
      intent: 'text-to-video',
      outputMediaType: 'video',
      pipeline: {
        stages: [
          {
            id: 'keyframe',
            intent: 'text-to-image',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'image',
            instruction: 'Create a keyframe'
          },
          {
            id: 'motion',
            intent: 'image-to-video',
            dependsOnStageIds: ['keyframe'],
            inputMediaTypes: ['image'],
            outputMediaType: 'video',
            instruction: 'Animate the keyframe'
          },
          {
            id: 'narration',
            intent: 'text-to-audio',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'audio',
            instruction: 'Generate narration'
          },
          {
            id: 'edit',
            intent: 'video-edit',
            dependsOnStageIds: ['motion', 'narration'],
            inputMediaTypes: ['video', 'audio'],
            outputMediaType: 'video',
            instruction: 'Combine the video and narration'
          }
        ]
      }
    })
    const selection = selectWorkflowRoute(production, [
      route('no-audio', {
        intents: ['text-to-video'],
        outputMediaType: 'video',
        supportedPipelineIntents: [
          'text-to-image',
          'image-to-video',
          'video-edit'
        ],
        taskFitScore: 100
      }),
      route('complete-production', {
        intents: ['text-to-video'],
        outputMediaType: 'video',
        supportedPipelineIntents: [
          'text-to-image',
          'image-to-video',
          'text-to-audio',
          'video-edit'
        ]
      })
    ])

    expect(selection).toMatchObject({
      status: 'ready',
      route: { id: 'complete-production' }
    })
  })

  it('does not assume an unknown duration limit can satisfy a timed task', () => {
    const selection = selectWorkflowRoute(
      plan({
        intent: 'text-to-video',
        outputMediaType: 'video',
        targetDurationSeconds: 10
      }),
      [
        route('unknown-limit', {
          intents: ['text-to-video'],
          outputMediaType: 'video'
        })
      ]
    )

    expect(selection).toEqual({ status: 'no-match' })
  })

  it('ignores unavailable and incompatible routes', () => {
    const selection = selectWorkflowRoute(plan(), [
      route('unavailable', {
        qualityScore: 100,
        availability: { status: 'unavailable', reason: 'No supported GPU' }
      }),
      route('wrong-output', { outputMediaType: 'video' }),
      route('wrong-intent', { intents: ['text-to-video'] })
    ])

    expect(selection).toEqual({ status: 'no-match' })
  })
})
