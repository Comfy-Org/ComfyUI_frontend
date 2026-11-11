import { describe, expect, it } from 'vitest'

import { AGENT_INSTRUCTIONS } from './agentPrompt'
import type {
  AgentRequest,
  HistoryFollowUp,
  HistoryTurn,
  ThreadNote
} from './agentReply'
import { pointConfig } from './config'
import { hostNode, textToImageNodes } from './fakePointHost'
import {
  buildChatBody,
  describeHistory,
  describeThread,
  describeWorkflow
} from './modelPrompt'
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
  kind: 'batch',
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
  ],
  history: []
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
      earlierTurns: [],
      earlierTurnsLeftOut: 0,
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

describe('describeHistory', () => {
  const width = { kind: 'setting' as const, nodeId: '5', setting: 'width' }

  function turn(comment: string, text: string): HistoryTurn {
    return {
      comments: [
        { id: `id-${comment}`, label: 'Save Image', comment, targets: [] }
      ],
      answer: [
        {
          annotationId: `id-${comment}`,
          text,
          target: width,
          offered: { target: width, value: 1280 },
          result: 'accepted',
          valueBefore: 1024
        }
      ],
      followUps: []
    }
  }

  function followUp(text: string): HistoryFollowUp {
    return { commentId: 'id-new', text, answer: turn('new', 'z').answer }
  }

  it('TU-04: gives every earlier turn, oldest first, with its comments, answer steps, offers and results', () => {
    const history = [turn('make this wider', 'Change width to 1280.')]

    expect(describeHistory(history)).toEqual({
      turns: [
        {
          turn: 1,
          comments: [
            {
              id: 'id-make this wider',
              pinnedOn: [],
              label: 'Save Image',
              comment: 'make this wider'
            }
          ],
          answer: history[0].answer
        }
      ],
      leftOut: 0
    })
  })

  it('TU-04: reaches the model as earlierTurns next to the current comments', () => {
    const body = buildChatBody(
      { ...request, history: [turn('make this wider', 'Change width.')] },
      nodes,
      pointConfig.model
    )

    expect(sent(body)).toMatchObject({
      comments: [{ id: 'comment-1' }, { id: 'comment-2' }],
      earlierTurns: [{ turn: 1, comments: [{ comment: 'make this wider' }] }],
      earlierTurnsLeftOut: 0
    })
  })

  it('TU-04: when the history is too long, leaves out the oldest turns and says how many', () => {
    const history = Array.from({ length: 6 }, (_, index) =>
      turn(`comment ${index}`, 'x'.repeat(400))
    )

    const described = describeHistory(history, 1500)

    expect(described).toMatchObject({
      turns: [{ turn: 5 }, { turn: 6 }],
      leftOut: 4
    })
  })

  it('TH-14: a turn’s threads go with it, and are cut with it when it is one of the oldest', () => {
    const withThread = { ...turn('new', 'y'), followUps: [followUp('more')] }

    expect(describeHistory([turn('old', 'x'), withThread])).toMatchObject({
      turns: [
        { turn: 1 },
        { turn: 2, followUps: [{ commentId: 'id-new', text: 'more' }] }
      ],
      leftOut: 0
    })
    expect(describeHistory([withThread, turn('newest', 'x')], 300)).toEqual({
      turns: [expect.objectContaining({ turn: 2 })],
      leftOut: 1
    })
  })

  it('TH-14: when the newest turn alone is over the cap, its oldest follow-ups are left out and counted', () => {
    const newest = {
      ...turn('new', 'y'),
      followUps: ['first', 'second', 'third'].map((text) =>
        followUp(`${text} ${'x'.repeat(300)}`)
      )
    }

    const described = describeHistory([turn('old', 'x'), newest], 1100)

    expect(described).toMatchObject({
      turns: [
        {
          turn: 2,
          followUps: [{ text: expect.stringMatching(/^third/) }],
          followUpsLeftOut: 2
        }
      ],
      leftOut: 1
    })
  })

  it('TU-04: always keeps the newest turn, even when it alone is over the cap', () => {
    const history = [turn('old', 'x'.repeat(400)), turn('new', 'y'.repeat(400))]

    expect(describeHistory(history, 100)).toMatchObject({
      turns: [{ turn: 2 }],
      leftOut: 1
    })
  })
})

describe('a follow-up', () => {
  const width = {
    kind: 'setting' as const,
    nodeId: latent.id,
    setting: 'width'
  }
  const earlier: ThreadNote[] = [
    {
      from: 'agent',
      steps: [
        {
          annotationId: 'comment-1',
          text: 'Change width to 1280.',
          target: width,
          offered: { target: width, value: 1280 },
          result: 'accepted',
          valueBefore: 1024
        }
      ]
    }
  ]
  const followUpRequest: AgentRequest = {
    kind: 'followUp',
    requestId: 'request-2',
    comment: request.annotations[0],
    thread: earlier,
    followUp: 'a bit more than that',
    history: []
  }

  it('TH-13: sends the thread with its comment, what was said, the new message, the earlier turns and the workflow', () => {
    const body = buildChatBody(followUpRequest, nodes, pointConfig.model)

    expect(sent(body)).toMatchObject({
      thread: {
        comment: {
          id: 'comment-1',
          pinnedOn: [{ kind: 'node', nodeId: save.id }],
          comment: 'make this wider'
        },
        messages: earlier,
        messagesLeftOut: 0,
        followUp: 'a bit more than that'
      },
      earlierTurns: [],
      earlierTurnsLeftOut: 0,
      workflow: {
        nodes: [{ id: sampler.id }, { id: latent.id }, { id: save.id }]
      }
    })
    expect(sent(body)).not.toHaveProperty('comments')
    expect(chatBodySchema.safeParse(body).success).toBe(true)
  })

  it('TH-13: a long thread loses its oldest messages first and says how many', () => {
    const long: ThreadNote[] = Array.from({ length: 6 }, (_, index) => ({
      from: 'person',
      text: `${index} ${'x'.repeat(400)}`
    }))

    const described = describeThread(long, 1000)

    expect(described.leftOut).toBe(4)
    expect(described.messages).toEqual(long.slice(4))
  })

  it('TH-13: the newest message of a thread is always kept', () => {
    expect(
      describeThread([{ from: 'person', text: 'x'.repeat(400) }], 100)
    ).toMatchObject({ leftOut: 0, messages: [{ from: 'person' }] })
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
