import { assert, describe, expect, it } from 'vitest'

import type { AskUserResolution, MessagePart } from './agentMessageParts'
import {
  retireAskParts,
  toAskOrNoticePart,
  toAskPart,
  toAskResolution
} from './agentMessageParts'

type AskInput = Parameters<typeof toAskPart>[0]

const askUser = (ask: Partial<AskInput> = {}): AskInput => ({
  kind: 'ask_user',
  ask_id: 'turn-1:call-1',
  prompt: 'Which model should I use?',
  options: [
    { id: 'sdxl', label: 'SDXL', description: 'Fast, 1024px' },
    { id: 'flux', label: 'Flux Dev' }
  ],
  min_selections: 1,
  max_selections: 1,
  allow_other: false,
  ...ask
})

describe('toAskPart ask_user', () => {
  it('keeps the prompt and every option, with descriptions only where given', () => {
    expect(toAskPart(askUser())).toEqual({
      type: 'askUser',
      askId: 'turn-1:call-1',
      prompt: 'Which model should I use?',
      options: [
        { id: 'sdxl', label: 'SDXL', description: 'Fast, 1024px' },
        { id: 'flux', label: 'Flux Dev', description: undefined }
      ],
      minSelections: 1,
      maxSelections: 1,
      allowOther: false
    })
  })

  it('carries multi-choice bounds and allow_other through', () => {
    expect(
      toAskPart(
        askUser({ min_selections: 2, max_selections: 3, allow_other: true })
      )
    ).toMatchObject({ minSelections: 2, maxSelections: 3, allowOther: true })
  })

  it('treats a blank description as absent', () => {
    const part = toAskPart(
      askUser({
        options: [
          { id: 'a', label: 'A', description: '   ' },
          { id: 'b', label: 'B' }
        ]
      })
    )
    expect(part).toMatchObject({
      type: 'askUser',
      options: [
        { id: 'a', label: 'A', description: undefined },
        { id: 'b', label: 'B', description: undefined }
      ]
    })
  })

  it.for(['unknown', 'paused'] as const)(
    'renders nothing for an ask whose kind is %s',
    (kind) => {
      expect(toAskPart(askUser({ kind }))).toBeUndefined()
    }
  )

  it('renders an Other-only ask and drops an empty one', () => {
    expect(
      toAskPart(askUser({ options: [], allow_other: true }))
    ).toMatchObject({
      type: 'askUser',
      options: [],
      minSelections: 1,
      maxSelections: 1
    })
    expect(toAskPart(askUser({ options: [] }))).toBeUndefined()
  })

  it('raises a negative minimum to zero', () => {
    expect(
      toAskPart(askUser({ min_selections: -1, max_selections: 2 }))
    ).toMatchObject({ minSelections: 0, maxSelections: 2 })
  })

  it('caps the maximum at what can actually be chosen', () => {
    expect(
      toAskPart(askUser({ min_selections: 1, max_selections: 5 }))
    ).toMatchObject({ minSelections: 1, maxSelections: 2 })
    expect(
      toAskPart(
        askUser({ min_selections: 3, max_selections: 4, allow_other: true })
      )
    ).toMatchObject({ minSelections: 3, maxSelections: 3 })
  })

  it('keeps the first of options that share an id, as the server does', () => {
    const part = toAskPart(
      askUser({
        options: [
          { id: 'a', label: 'First' },
          { id: 'b', label: 'B' },
          { id: 'a', label: 'Second' }
        ],
        max_selections: 3
      })
    )
    expect(part).toMatchObject({
      options: [
        { id: 'a', label: 'First' },
        { id: 'b', label: 'B' }
      ],
      maxSelections: 2
    })
  })

  it('bounds the option count and text lengths of an untrusted ask', () => {
    const part = toAskPart(
      askUser({
        prompt: 'p'.repeat(2010),
        options: Array.from({ length: 75 }, (_, index) => ({
          id: `o${index}`,
          label: 'l'.repeat(210),
          description: 'd'.repeat(510)
        }))
      })
    )
    assert(part?.type === 'askUser')
    expect(part.options).toHaveLength(50)
    expect(part.prompt).toBe(`${'p'.repeat(1999)}\u2026`)
    expect(part.options[0].label).toBe(`${'l'.repeat(199)}\u2026`)
    expect(part.options[0].description).toBe(`${'d'.repeat(499)}\u2026`)
  })

  it('maps a run approval', () => {
    expect(
      toAskPart(
        askUser({
          kind: 'run_approval',
          context: { workflow_id: 'wf-1', workflow_name: 'Portrait' }
        })
      )
    ).toEqual({
      type: 'runApproval',
      askId: 'turn-1:call-1',
      workflowId: 'wf-1',
      workflowName: 'Portrait'
    })
  })
})

describe('toAskPart delete_approval', () => {
  const deleteApproval = (ask: Partial<AskInput> = {}): AskInput =>
    askUser({
      kind: 'delete_approval',
      prompt: 'Delete 2 nodes?',
      options: [
        { id: 'delete', label: 'Delete' },
        { id: 'keep', label: 'Keep' }
      ],
      context: {
        action: 'delete_nodes',
        nodes: [
          { id: '12', type: 'KSampler', title: 'Hero sampler' },
          { id: '13', type: 'VAEDecode', title: '  ' },
          { id: '12', type: 'KSampler', title: 'A repeat' }
        ]
      },
      ...ask
    })

  it('lists each node once, title before type', () => {
    expect(toAskPart(deleteApproval())).toEqual({
      type: 'deleteApproval',
      askId: 'turn-1:call-1',
      prompt: 'Delete 2 nodes?',
      nodes: [
        { id: '12', name: 'Hero sampler' },
        { id: '13', name: 'VAEDecode' }
      ],
      hiddenNodeCount: 0
    })
  })

  it('counts the nodes the host left out of the list as not listed', () => {
    expect(
      toAskPart(
        deleteApproval({
          context: {
            action: 'delete_nodes',
            nodes: [{ id: '12', type: 'KSampler' }],
            hidden_node_count: 20
          }
        })
      )
    ).toMatchObject({ hiddenNodeCount: 20 })
  })

  it.for([
    { name: 'no context', context: undefined },
    { name: 'no nodes', context: { action: 'delete_nodes' } },
    {
      name: 'nodes not an array',
      context: { action: 'delete_nodes', nodes: 'oops' }
    },
    { name: 'an empty list', context: { action: 'delete_nodes', nodes: [] } },
    {
      name: 'a blank id',
      context: { action: 'delete_nodes', nodes: [{ id: '12' }, { id: '  ' }] }
    },
    {
      name: 'an unreadable entry next to a readable one',
      context: {
        action: 'delete_nodes',
        nodes: [{ id: '12' }, { type: 'NoId' }]
      }
    }
  ])('falls back to the notice with $name in context', ({ context }) => {
    expect(toAskOrNoticePart(deleteApproval({ context }))).toEqual({
      type: 'askUnavailable',
      askId: 'turn-1:call-1'
    })
  })

  it('clips a long node name but never its id', () => {
    const prefix = 'n'.repeat(200)
    const part = toAskPart(
      deleteApproval({
        context: {
          action: 'delete_nodes',
          nodes: [
            {
              id: `${prefix}-a`,
              title: 'x'.repeat(210)
            },
            { id: `${prefix}-b` }
          ]
        }
      })
    )
    assert(part?.type === 'deleteApproval')
    expect(part.nodes.map(({ id }) => id)).toEqual([
      `${prefix}-a`,
      `${prefix}-b`
    ])
    expect(part.nodes[0].name).toBe(`${'x'.repeat(199)}\u2026`)
  })

  it.for([
    {
      name: 'other option ids',
      ask: {
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' }
        ]
      }
    },
    {
      name: 'a third option',
      ask: {
        options: [
          { id: 'delete', label: 'Delete' },
          { id: 'keep', label: 'Keep' },
          { id: 'delete_all', label: 'Delete all' }
        ]
      }
    },
    {
      name: 'only one of the two',
      ask: { options: [{ id: 'delete', label: 'Delete' }] }
    },
    { name: 'free text', ask: { allow_other: true } },
    { name: 'a multi-choice', ask: { max_selections: 2 } }
  ])('renders nothing for $name', ({ ask }) => {
    expect(toAskPart(deleteApproval(ask))).toBeUndefined()
  })

  it('stays on screen read-only with its resolution once retired', () => {
    const card = toAskPart(deleteApproval())
    assert(card)
    expect(
      retireAskParts([card], card.askId, {
        status: 'answered',
        selected: ['keep']
      })
    ).toEqual([
      { ...card, resolution: { status: 'answered', selected: ['keep'] } }
    ])
  })
})

describe('toAskOrNoticePart', () => {
  it('stands a notice in for an ask it cannot render', () => {
    expect(toAskOrNoticePart(askUser({ kind: 'paused' }))).toEqual({
      type: 'askUnavailable',
      askId: 'turn-1:call-1'
    })
  })

  it.for<{ name: string; ask: Partial<AskInput> }>([
    {
      name: 'a minimum above the options it can show',
      ask: { min_selections: 3, max_selections: 5 }
    },
    {
      name: 'a minimum above the maximum',
      ask: { min_selections: 2, max_selections: 1 }
    },
    { name: 'a zero maximum', ask: { min_selections: 0, max_selections: 0 } },
    {
      name: 'a minimum only duplicate ids could meet',
      ask: {
        options: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'A again' },
          { id: 'b', label: 'B' }
        ],
        min_selections: 3,
        max_selections: 3
      }
    }
  ])('stands a notice in for $name', ({ ask }) => {
    expect(toAskOrNoticePart(askUser(ask))).toEqual({
      type: 'askUnavailable',
      askId: 'turn-1:call-1'
    })
  })
})

describe('retireAskParts', () => {
  const question = toAskPart(askUser({ ask_id: 'q' }))
  assert(question)
  const parts: MessagePart[] = [
    { type: 'text', text: 'before', state: 'done' },
    { type: 'runApproval', askId: 'run' },
    { type: 'askUnavailable', askId: 'odd' },
    question
  ]

  const retired: AskUserResolution = { status: 'retired' }

  it('drops a run approval and a stand-in notice, and leaves the rest alone', () => {
    expect(retireAskParts(parts, 'run', retired)).toEqual([
      parts[0],
      parts[2],
      question
    ])
    expect(retireAskParts(parts, 'odd', retired)).toEqual([
      parts[0],
      parts[1],
      question
    ])
  })

  it('keeps an ask_user card read-only with its resolution', () => {
    expect(
      retireAskParts(parts, 'q', { status: 'answered', selected: ['flux'] }).at(
        -1
      )
    ).toEqual({
      ...question,
      resolution: { status: 'answered', selected: ['flux'] }
    })
  })

  it.for<{
    name: string
    shown: AskUserResolution
    next: AskUserResolution
    expected: AskUserResolution
  }>([
    {
      name: 'a server answer replaces a local retirement',
      shown: { status: 'retired' },
      next: { status: 'answered', selected: ['sdxl'] },
      expected: { status: 'answered', selected: ['sdxl'] }
    },
    {
      name: 'a server cancel replaces an unknown outcome',
      shown: { status: 'unconfirmed' },
      next: { status: 'closed' },
      expected: { status: 'closed' }
    },
    {
      name: 'a server answer replaces an unknown outcome',
      shown: { status: 'unconfirmed' },
      next: { status: 'answered', selected: ['flux'] },
      expected: { status: 'answered', selected: ['flux'] }
    },
    {
      name: 'an unknown outcome outlasts a local retirement',
      shown: { status: 'unconfirmed' },
      next: { status: 'retired' },
      expected: { status: 'unconfirmed' }
    },
    {
      name: 'a server answer outlasts a local retirement',
      shown: { status: 'answered', selected: ['sdxl'] },
      next: { status: 'retired' },
      expected: { status: 'answered', selected: ['sdxl'] }
    },
    {
      name: 'a server cancel outlasts a local retirement',
      shown: { status: 'closed' },
      next: { status: 'retired' },
      expected: { status: 'closed' }
    },
    {
      name: 'a server cancel outlasts an unknown outcome',
      shown: { status: 'closed' },
      next: { status: 'unconfirmed' },
      expected: { status: 'closed' }
    },
    {
      name: 'a named answer replaces an unnamed one',
      shown: { status: 'answered', selected: [] },
      next: { status: 'answered', selected: ['flux'] },
      expected: { status: 'answered', selected: ['flux'] }
    },
    {
      name: 'a named answer outlasts an unnamed one',
      shown: { status: 'answered', selected: ['flux'] },
      next: { status: 'answered', selected: [] },
      expected: { status: 'answered', selected: ['flux'] }
    }
  ])('$name', ({ shown, next, expected }) => {
    const settled = retireAskParts(
      retireAskParts(parts, 'q', shown),
      'q',
      next
    ).at(-1)
    assert(settled?.type === 'askUser')
    expect(settled.resolution).toEqual(expected)
  })

  it('returns the same array when no part belongs to the ask', () => {
    expect(retireAskParts(parts, 'missing', retired)).toBe(parts)
  })

  it('returns the same array when the card keeps the resolution it shows', () => {
    const answered = retireAskParts(parts, 'q', {
      status: 'answered',
      selected: ['flux']
    })
    expect(retireAskParts(answered, 'q', retired)).toBe(answered)
  })
})

describe('toAskResolution', () => {
  it.for<{
    name: string
    data: Parameters<typeof toAskResolution>[0]
    expected: AskUserResolution
  }>([
    {
      name: 'a cancelled ask',
      data: { status: 'cancelled', selected: null },
      expected: { status: 'closed' }
    },
    {
      name: 'an expired ask',
      data: { status: 'expired', selected: null },
      expected: { status: 'closed' }
    },
    {
      name: 'an outcome the server does not report',
      data: {},
      expected: { status: 'retired' }
    },
    {
      name: 'an answer naming no selection',
      data: { status: 'answered' },
      expected: { status: 'answered', selected: [] }
    },
    {
      name: 'the committed ids',
      data: { status: 'answered', selected: ['oil'] },
      expected: { status: 'answered', selected: ['oil'] }
    },
    {
      name: 'the committed free text',
      data: { status: 'answered', selected: null, other_text: 'watercolor' },
      expected: { status: 'answered', selected: [], otherText: 'watercolor' }
    },
    {
      name: 'an empty free text',
      data: { status: 'answered', selected: ['oil'], other_text: '' },
      expected: { status: 'answered', selected: ['oil'] }
    }
  ])('reads $name', ({ data, expected }) => {
    expect(toAskResolution(data)).toEqual(expected)
  })
})
