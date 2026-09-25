import { describe, expect, it } from 'vitest'

import { zWorkflowPlan } from './workflowPlanSchema'
import type { WorkflowPlan } from './workflowPlanSchema'

function basePlan(): WorkflowPlan {
  return {
    version: 1,
    brief: 'Create a polished product image',
    summary: 'Polished product image',
    intent: 'text-to-image',
    inputs: [],
    outputMediaType: 'image',
    qualityGoal: 'balanced',
    executionPreference: 'auto',
    constraints: [],
    structure: { kind: 'single' },
    clarification: { status: 'ready' }
  }
}

describe('workflowPlanSchema', () => {
  it('accepts a single image task', () => {
    expect(zWorkflowPlan.parse(basePlan())).toEqual(basePlan())
  })

  it('accepts the existing text-to-3d product capability', () => {
    const plan = {
      ...basePlan(),
      brief: 'Create a textured chair model from a description',
      summary: 'Generate a chair model',
      intent: 'text-to-3d',
      outputMediaType: '3d'
    } satisfies WorkflowPlan

    expect(zWorkflowPlan.parse(plan)).toEqual(plan)
  })

  it('keeps quality independent from the allowed execution boundary', () => {
    const plan = {
      ...basePlan(),
      qualityGoal: 'best',
      executionPreference: 'local-only'
    } satisfies WorkflowPlan

    expect(zWorkflowPlan.parse(plan)).toMatchObject({
      qualityGoal: 'best',
      executionPreference: 'local-only'
    })
  })

  it('accepts a batch plan when its declared count matches its units', () => {
    const plan = {
      ...basePlan(),
      brief: '把 3 张鞋子图统一换成白底',
      summary: '三张鞋子白底商品图',
      intent: 'image-edit',
      inputs: [
        {
          id: 'product-images',
          mediaType: 'image',
          quantity: 3,
          purpose: '待处理的鞋子商品图'
        }
      ],
      constraints: ['商品比例不变', '阴影保持一致'],
      structure: {
        kind: 'batch',
        unitCount: 3,
        units: [
          { id: 'shoe-1', label: '鞋子 1', instruction: '换成白底' },
          { id: 'shoe-2', label: '鞋子 2', instruction: '换成白底' },
          { id: 'shoe-3', label: '鞋子 3', instruction: '换成白底' }
        ]
      }
    } satisfies WorkflowPlan

    expect(zWorkflowPlan.safeParse(plan).success).toBe(true)
  })

  it('accepts a one-minute storyboard with explicit continuity', () => {
    const events = [
      ['play', '小狗和小羊在草地上玩耍'],
      ['find-ball', '它们发现一个皮球'],
      ['play-ball', '它们轮流顶球'],
      ['sheep-rests', '小羊累了，走回羊圈'],
      ['dog-closes-gate', '小狗关好羊圈门'],
      ['dog-sleeps', '小狗在门边睡着']
    ] as const
    const plan = {
      ...basePlan(),
      brief: '用两张参考图生成一分钟的小狗和小羊动画',
      summary: '小狗和小羊玩球后休息的连续动画',
      intent: 'image-to-video',
      inputs: [
        {
          id: 'dog-reference',
          mediaType: 'image',
          quantity: 1,
          purpose: '保持小狗外观一致'
        },
        {
          id: 'sheep-reference',
          mediaType: 'image',
          quantity: 1,
          purpose: '保持小羊外观一致'
        }
      ],
      outputMediaType: 'video',
      qualityGoal: 'best',
      executionPreference: 'cloud-allowed',
      constraints: ['小狗和小羊外观一致', '空间方向连续', '镜头衔接自然'],
      targetDurationSeconds: 60,
      structure: {
        kind: 'sequence',
        units: events.map(([id, instruction]) => ({
          id,
          label: id,
          instruction,
          durationSeconds: 10
        })),
        continuityConstraints: ['角色外观', '草地和羊圈位置', '皮球颜色']
      }
    } satisfies WorkflowPlan

    const parsed = zWorkflowPlan.parse(plan)
    expect(parsed.structure.kind).toBe('sequence')
    expect(parsed.targetDurationSeconds).toBe(60)
  })

  it.for([
    {
      name: 'a missing unit duration',
      durations: [30, undefined],
      message: 'A timed sequence requires a duration for every unit'
    },
    {
      name: 'durations that do not fill the target',
      durations: [20, 20],
      message: 'Sequence unit durations must equal the target duration'
    }
  ])('rejects a timed sequence with $name', ({ durations, message }) => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      targetDurationSeconds: 60,
      structure: {
        kind: 'sequence',
        units: durations.map((duration, index) => ({
          id: `shot-${index}`,
          label: `Shot ${index}`,
          instruction: `Story beat ${index}`,
          ...(duration === undefined ? {} : { durationSeconds: duration })
        })),
        continuityConstraints: ['Keep the subject consistent']
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ message })
    )
  })

  it('rejects a partially timed sequence without a declared total', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      structure: {
        kind: 'sequence',
        units: [
          {
            id: 'known-duration',
            label: 'Known duration',
            instruction: 'A shot whose requested duration must be honored',
            durationSeconds: 20
          },
          {
            id: 'unknown-duration',
            label: 'Unknown duration',
            instruction: 'A shot that still needs a duration'
          }
        ],
        continuityConstraints: ['Keep the subject consistent']
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'A partially timed sequence requires a duration for every unit'
      })
    )
  })

  it('rejects an implicit sequence duration above the plan limit', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      structure: {
        kind: 'sequence',
        units: Array.from({ length: 7 }, (_, index) => ({
          id: `shot-${index}`,
          label: `Shot ${index}`,
          instruction: `Long story beat ${index}`,
          durationSeconds: 600
        })),
        continuityConstraints: ['Keep the subject consistent']
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'Sequence duration must not exceed 3600 seconds'
      })
    )
  })

  it('accepts a multi-stage screenplay pipeline', () => {
    const plan = {
      ...basePlan(),
      brief: '把剧本做成带配音的竖屏短片',
      summary: '剧本到带配音短片',
      intent: 'text-to-video',
      outputMediaType: 'video',
      targetDurationSeconds: 30,
      structure: {
        kind: 'sequence',
        units: [
          {
            id: 'opening',
            label: 'Opening',
            instruction: 'Introduce the character',
            durationSeconds: 10
          },
          {
            id: 'conflict',
            label: 'Conflict',
            instruction: 'Show the central conflict',
            durationSeconds: 10
          },
          {
            id: 'ending',
            label: 'Ending',
            instruction: 'Resolve the story',
            durationSeconds: 10
          }
        ],
        continuityConstraints: ['Keep the character and setting consistent']
      },
      pipeline: {
        stages: [
          {
            id: 'keyframes',
            intent: 'text-to-image',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'image',
            instruction: '生成角色一致的分镜关键帧'
          },
          {
            id: 'motion',
            intent: 'image-to-video',
            dependsOnStageIds: ['keyframes'],
            inputMediaTypes: ['image'],
            outputMediaType: 'video',
            instruction: '将关键帧制作成连续镜头'
          },
          {
            id: 'narration',
            intent: 'text-to-audio',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'audio',
            instruction: 'Generate narration from the screenplay'
          },
          {
            id: 'edit',
            intent: 'video-edit',
            dependsOnStageIds: ['motion', 'narration'],
            inputMediaTypes: ['video', 'audio'],
            outputMediaType: 'video',
            instruction: '合并镜头、配音和转场'
          }
        ]
      }
    } satisfies WorkflowPlan

    const parsed = zWorkflowPlan.parse(plan)
    expect(parsed.structure.kind).toBe('sequence')
    expect(parsed.pipeline?.stages).toHaveLength(4)
  })

  it('requires a question when the plan needs user input', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      clarification: { status: 'needs-input' }
    })

    expect(result.success).toBe(false)
  })

  it('accepts an incomplete provisional plan while awaiting user input', () => {
    const plan = {
      ...basePlan(),
      brief: 'Make it better',
      summary: 'Improve the selected media',
      intent: 'image-edit',
      inputs: [],
      clarification: {
        status: 'needs-input',
        question: 'What should I improve, and what result do you want?'
      }
    } satisfies WorkflowPlan

    expect(zWorkflowPlan.safeParse(plan).success).toBe(true)
  })

  it('rejects a batch whose count disagrees with its units', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      structure: {
        kind: 'batch',
        unitCount: 3,
        units: [
          { id: 'one', label: 'One', instruction: 'First variant' },
          { id: 'two', label: 'Two', instruction: 'Second variant' }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'Batch unitCount must match the number of units'
      })
    )
  })

  it.for([
    {
      name: 'duplicate input ids',
      patch: {
        inputs: [
          {
            id: 'reference',
            mediaType: 'image',
            quantity: 1,
            purpose: 'First subject'
          },
          {
            id: 'reference',
            mediaType: 'image',
            quantity: 1,
            purpose: 'Second subject'
          }
        ]
      }
    },
    {
      name: 'duplicate sequence unit ids',
      patch: {
        structure: {
          kind: 'sequence',
          units: [
            { id: 'shot', label: 'One', instruction: 'First shot' },
            { id: 'shot', label: 'Two', instruction: 'Second shot' }
          ],
          continuityConstraints: ['Keep the subject consistent']
        }
      }
    }
  ])('rejects $name', ({ patch }) => {
    const result = zWorkflowPlan.safeParse({ ...basePlan(), ...patch })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ message: 'Values must be unique' })
    )
  })

  it.for([
    ['image-edit', 'image'],
    ['image-upscale', 'image'],
    ['image-to-video', 'image'],
    ['video-edit', 'video'],
    ['audio-edit', 'audio'],
    ['image-to-3d', 'image']
  ] as const)(
    'requires $0 to receive $1 input',
    ([intent, requiredMediaType]) => {
      const result = zWorkflowPlan.safeParse({
        ...basePlan(),
        intent,
        inputs: []
      })

      expect(result.success).toBe(false)
      if (result.success) throw new Error('expected plan validation to fail')
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: `${intent} requires ${requiredMediaType} input`
        })
      )
    }
  )

  it('rejects a pipeline whose final stage has the wrong output type', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
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
            instruction: 'Create a frame'
          },
          {
            id: 'audio',
            intent: 'text-to-audio',
            dependsOnStageIds: ['image'],
            inputMediaTypes: ['image'],
            outputMediaType: 'audio',
            instruction: 'Create narration'
          }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'The final pipeline stage must produce the planned output'
      })
    )
  })

  it('rejects output media that conflicts with the plan intent', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      outputMediaType: 'video'
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ message: 'text-to-image must produce image' })
    )
  })

  it('validates intent compatibility inside every pipeline stage', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      intent: 'text-to-video',
      outputMediaType: 'video',
      structure: { kind: 'single' },
      pipeline: {
        stages: [
          {
            id: 'bad-keyframe',
            intent: 'image-edit',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'video',
            instruction: 'Edit a missing image into a video'
          },
          {
            id: 'motion',
            intent: 'image-to-video',
            dependsOnStageIds: ['bad-keyframe'],
            inputMediaTypes: ['image'],
            outputMediaType: 'video',
            instruction: 'Animate the keyframe'
          }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'image-edit requires image input' }),
        expect.objectContaining({ message: 'image-edit must produce image' })
      ])
    )
  })

  it('rejects duplicate media inputs within a pipeline stage', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
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
            instruction: 'Create a keyframe'
          },
          {
            id: 'motion',
            intent: 'image-to-video',
            dependsOnStageIds: ['image'],
            inputMediaTypes: ['image', 'image'],
            outputMediaType: 'video',
            instruction: 'Animate the keyframe'
          }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ['pipeline', 'stages', 1, 'inputMediaTypes'],
        message: 'Values must be unique'
      })
    )
  })

  it('rejects missing and forward stage dependencies', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      intent: 'text-to-video',
      outputMediaType: 'video',
      structure: { kind: 'single' },
      pipeline: {
        stages: [
          {
            id: 'image',
            intent: 'text-to-image',
            dependsOnStageIds: ['motion'],
            inputMediaTypes: [],
            outputMediaType: 'image',
            instruction: 'Create a frame'
          },
          {
            id: 'motion',
            intent: 'image-to-video',
            dependsOnStageIds: [],
            inputMediaTypes: ['image'],
            outputMediaType: 'video',
            instruction: 'Animate a frame with no declared source'
          }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Pipeline stages may depend only on earlier stages'
        }),
        expect.objectContaining({
          message: 'Pipeline stage input image has no source'
        })
      ])
    )
  })

  it('rejects a dependency whose output is not consumed', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      intent: 'text-to-video',
      outputMediaType: 'video',
      structure: { kind: 'single' },
      pipeline: {
        stages: [
          {
            id: 'narration',
            intent: 'text-to-audio',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'audio',
            instruction: 'Create narration'
          },
          {
            id: 'motion',
            intent: 'text-to-video',
            dependsOnStageIds: ['narration'],
            inputMediaTypes: [],
            outputMediaType: 'video',
            instruction: 'Create video without using the narration'
          }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'A stage dependency output must be declared as an input'
      })
    )
  })

  it('rejects a pipeline stage that does not contribute to the final output', () => {
    const result = zWorkflowPlan.safeParse({
      ...basePlan(),
      intent: 'text-to-video',
      outputMediaType: 'video',
      structure: { kind: 'single' },
      pipeline: {
        stages: [
          {
            id: 'unused-image',
            intent: 'text-to-image',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'image',
            instruction: 'Create an image that is never used'
          },
          {
            id: 'video',
            intent: 'text-to-video',
            dependsOnStageIds: [],
            inputMediaTypes: [],
            outputMediaType: 'video',
            instruction: 'Create an unrelated video'
          }
        ]
      }
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected plan validation to fail')
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'Every pipeline stage must contribute to the final output'
      })
    )
  })

  it('rejects unknown fields and unsafe collection sizes', () => {
    expect(
      zWorkflowPlan.safeParse({ ...basePlan(), modelName: 'unverified-model' })
        .success
    ).toBe(false)
    expect(
      zWorkflowPlan.safeParse({
        ...basePlan(),
        structure: { kind: 'batch', unitCount: 65 }
      }).success
    ).toBe(false)
  })

  it('returns a safe result for unknown input', () => {
    const result = zWorkflowPlan.safeParse('not a structured plan')
    expect(result.success).toBe(false)
  })
})
