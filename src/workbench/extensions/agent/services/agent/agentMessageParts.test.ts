import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it } from 'vitest'

import type { MessagePart } from './agentMessageParts'
import {
  ASK_USER_LIMITS,
  isAskPart,
  retireAskParts,
  toAskOrNoticePart,
  toAskPart
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

  it.for([undefined, 'mystery'])(
    'renders nothing for an ask whose kind is %s',
    (kind) => {
      expect(toAskPart(askUser({ kind }))).toBeUndefined()
    }
  )

  it('keeps a lone option when free text is allowed and drops an empty ask', () => {
    expect(
      toAskPart(
        askUser({
          options: [{ id: 'a', label: 'A' }],
          allow_other: true
        })
      )?.type
    ).toBe('askUser')
    expect(toAskPart(askUser({ options: [] }))).toBeUndefined()
  })

  it('clamps out-of-range bounds into a satisfiable range', () => {
    expect(
      toAskPart(askUser({ min_selections: 5, max_selections: 0 }))
    ).toMatchObject({ minSelections: 1, maxSelections: 1 })
    expect(
      toAskPart(askUser({ min_selections: -1, max_selections: 2 }))
    ).toMatchObject({ minSelections: 0, maxSelections: 2 })
  })

  it('caps the bounds at what can actually be chosen', () => {
    expect(
      toAskPart(askUser({ min_selections: 3, max_selections: 5 }))
    ).toMatchObject({ minSelections: 2, maxSelections: 2 })
    expect(
      toAskPart(
        askUser({ min_selections: 4, max_selections: 4, allow_other: true })
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
        prompt: 'p'.repeat(ASK_USER_LIMITS.prompt + 10),
        options: Array.from(
          { length: ASK_USER_LIMITS.options + 25 },
          (_, index) => ({
            id: `o${index}`,
            label: 'l'.repeat(ASK_USER_LIMITS.label + 10),
            description: 'd'.repeat(ASK_USER_LIMITS.description + 10)
          })
        )
      })
    )
    assert(part?.type === 'askUser')
    expect(part.options).toHaveLength(ASK_USER_LIMITS.options)
    expect(part.prompt).toHaveLength(ASK_USER_LIMITS.prompt)
    expect(part.options[0].label).toHaveLength(ASK_USER_LIMITS.label)
    expect(part.options[0].description).toHaveLength(
      ASK_USER_LIMITS.description
    )
  })

  it('still maps run approvals, and no kind outside the contract', () => {
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
    expect(
      toAskPart(
        askUser({
          kind: 'permission',
          context: { target_kind: 'host', target: 'example.org' }
        })
      )
    ).toBeUndefined()
  })
})

describe('isAskPart', () => {
  it('recognises every ask card and nothing else', () => {
    const samples: MessagePart[] = [
      { type: 'runApproval', askId: 'a' },
      fromPartial<MessagePart>({ type: 'askUser', askId: 'b' }),
      { type: 'text', text: '', state: 'done' },
      { type: 'tool', callId: 'c', name: 'x', state: 'done' },
      { type: 'paywall' }
    ]
    expect(samples.map(isAskPart)).toEqual([true, true, false, false, false])
  })
})

describe('toAskOrNoticePart', () => {
  it('returns the card for a renderable ask', () => {
    expect(toAskOrNoticePart(askUser()).type).toBe('askUser')
  })

  it('surfaces a warning notice for an ask it cannot render', () => {
    expect(toAskOrNoticePart(askUser({ kind: undefined }))).toEqual({
      type: 'notice',
      level: 'warning',
      text: 'The agent asked a question this panel cannot show. Stop the turn to continue.',
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
    { type: 'notice', level: 'warning', text: 'cannot show', askId: 'odd' },
    question
  ]

  it('drops a run approval and a stand-in notice, and leaves the rest alone', () => {
    expect(retireAskParts(parts, 'run')).toEqual([parts[0], parts[2], question])
    expect(retireAskParts(parts, 'odd')).toEqual([parts[0], parts[1], question])
  })

  it('keeps an ask_user card read-only with its resolution', () => {
    expect(
      retireAskParts(parts, 'q', { answered: true, selected: ['flux'] }).at(-1)
    ).toEqual({
      ...question,
      resolution: { answered: true, selected: ['flux'] }
    })
  })

  it('lets a real answer replace a retirement that could not name one, never the reverse', () => {
    const closed = retireAskParts(parts, 'q')
    expect(closed.at(-1)).toMatchObject({
      resolution: { answered: false, selected: [] }
    })
    const answered = retireAskParts(closed, 'q', {
      answered: true,
      selected: ['sdxl']
    })
    expect(answered.at(-1)).toMatchObject({
      resolution: { answered: true, selected: ['sdxl'] }
    })
    expect(retireAskParts(answered, 'q').at(-1)).toMatchObject({
      resolution: { answered: true, selected: ['sdxl'] }
    })
  })

  it('returns the same array when no part belongs to the ask', () => {
    expect(retireAskParts(parts, 'missing')).toBe(parts)
  })
})
