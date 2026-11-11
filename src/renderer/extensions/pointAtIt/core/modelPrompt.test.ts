import { describe, expect, it } from 'vitest'

import { AGENT_INSTRUCTIONS } from './agentPrompt'
import type { AgentRequest } from './agentReply'
import { pointConfig } from './config'
import { hostNode, textToImageNodes } from './fakePointHost'
import { buildChatBody, describeWorkflow } from './modelPrompt'
import { chatBodySchema } from './modelWire'
import type { HostNode } from './pointHost'

const nodes = textToImageNodes()
const [sampler, latent, save] = nodes
const runButton = {
  kind: 'element' as const,
  elementId: 'element-1',
  label: 'Run',
  role: 'button',
  context: 'toolbar "Actions"',
  testId: 'queue-button'
}
const request: AgentRequest = {
  requestId: 'request-1',
  annotations: [
    {
      id: 'comment-1',
      label: 'Save Image',
      comment: 'make this wider',
      targets: [{ kind: 'node', nodeId: save.id }]
    },
    {
      id: 'comment-2',
      label: 'Run',
      comment: 'what is this?',
      targets: [runButton]
    }
  ]
}

function manyNodes(count: number, description: string): HostNode[] {
  return Array.from({ length: count }, (_, index) =>
    hostNode({
      id: 100 + index,
      type: 'KSampler',
      title: `Sampler ${index}`,
      description,
      rect: null,
      settings: [{ name: 'steps', value: 20, description }]
    })
  )
}

function sent(body: ReturnType<typeof buildChatBody>) {
  return JSON.parse(body.messages[1].content)
}

describe('buildChatBody', () => {
  it('sends the instructions, every comment with what it is pinned on, and the workflow', () => {
    const linked = [
      sampler,
      latent,
      {
        ...save,
        links: [{ input: 'images', from: sampler.id, output: 'LATENT' }]
      }
    ]
    const body = buildChatBody(request, linked, pointConfig.model)

    expect(body.messages[0].content).toContain(AGENT_INSTRUCTIONS)
    expect(sent(body)).toEqual({
      comments: [
        {
          id: 'comment-1',
          pinnedOn: [{ kind: 'node', nodeId: save.id }],
          label: 'Save Image',
          comment: 'make this wider'
        },
        {
          id: 'comment-2',
          pinnedOn: [runButton],
          label: 'Run',
          comment: 'what is this?'
        }
      ],
      workflow: {
        nodes: [
          {
            id: sampler.id,
            type: 'KSampler',
            title: 'KSampler',
            about: 'Denoises a latent using the model and the prompts.',
            settings: [
              { name: 'seed', value: 4127 },
              {
                name: 'steps',
                value: 20,
                about: 'The number of steps used in the denoising process.'
              },
              { name: 'cfg', value: 7 }
            ]
          },
          {
            id: latent.id,
            type: 'EmptyLatentImage',
            title: 'Empty Latent Image',
            settings: [
              { name: 'width', value: 1024 },
              { name: 'height', value: 1024 },
              { name: 'batch_size', value: 1 }
            ]
          },
          {
            id: save.id,
            type: 'SaveImage',
            title: 'Save Image',
            settings: [{ name: 'filename_prefix', value: 'ComfyUI' }],
            inputs: [{ input: 'images', from: sampler.id, output: 'LATENT' }]
          }
        ],
        leftOut: []
      }
    })
  })

  it('T-06: with thinking on, asks for thinking and gives the reply format in the instructions', () => {
    const body = buildChatBody(request, nodes, {
      ...pointConfig.model,
      showThinking: true,
      thinkingEffort: 'max',
      thinkingTokens: 2000,
      replyTokens: 4096
    })

    expect(body).toMatchObject({
      reasoning: { effort: 'max' },
      max_tokens: 6096
    })
    expect(body.response_format).toBeUndefined()
    expect(body.messages[0].content).toContain('"annotationId"')
    expect(chatBodySchema.safeParse(body).success).toBe(true)
  })

  it('T-06: with thinking off, has the provider enforce the reply format and return no thinking', () => {
    const body = buildChatBody(request, nodes, {
      ...pointConfig.model,
      showThinking: false,
      replyTokens: 4096
    })

    expect(body).toMatchObject({
      reasoning: { exclude: true },
      max_tokens: 4096,
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: { required: ['steps'] } }
      }
    })
    expect(body.messages[0].content).toBe(AGENT_INSTRUCTIONS)
    expect(chatBodySchema.safeParse(body).success).toBe(true)
  })
})

describe('describeWorkflow', () => {
  it('shortens long descriptions, long text values and long option lists', () => {
    const prompt = hostNode({
      id: 6,
      type: 'CLIPTextEncode',
      title: 'Prompt',
      description: 'd'.repeat(500),
      rect: null,
      settings: [
        { name: 'text', value: 'p'.repeat(1000) },
        {
          name: 'style',
          value: 'style 0',
          options: Array.from({ length: 80 }, (_, index) => `style ${index}`)
        }
      ]
    })

    expect(describeWorkflow([prompt], request).nodes).toMatchObject([
      {
        about: `${'d'.repeat(200)}…`,
        settings: [
          { value: `${'p'.repeat(300)}…` },
          { options: { length: 30 } }
        ]
      }
    ])
  })

  it.for([
    { budget: 30_000, cut: ['setting descriptions removed'] },
    {
      budget: 12_000,
      cut: [
        'setting descriptions removed',
        'node descriptions and option lists removed'
      ]
    }
  ])(
    'drops detail in a fixed order until the workflow fits $budget characters',
    ({ budget, cut }) => {
      const workflow = describeWorkflow(
        manyNodes(100, 'x'.repeat(150)),
        request,
        budget
      )

      expect(workflow.cut).toEqual(cut)
      expect(JSON.stringify(workflow.nodes).length).toBeLessThanOrEqual(budget)
      expect(workflow.nodes).toHaveLength(100)
    }
  )

  it('when it still does not fit, keeps the commented node first and says how many nodes were left out', () => {
    const workflow = describeWorkflow(
      [...manyNodes(100, ''), save],
      request,
      2000
    )

    expect(workflow.nodes[0]).toMatchObject({ id: save.id })
    expect(workflow.nodes.length).toBeLessThan(101)
    expect(workflow.cut.at(-1)).toBe(
      `${101 - workflow.nodes.length} of 101 nodes left out`
    )
  })
})
