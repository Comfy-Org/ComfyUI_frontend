import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { MessagePart } from './agentMessageParts'
import { isAskPart, toAskPart } from './agentMessageParts'

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

  it('treats a blank description as absent and ignores a null context', () => {
    const part = toAskPart(
      askUser({
        context: null,
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

  it('reads a kind-less ask as the generic ask_user question', () => {
    expect(toAskPart(askUser({ kind: undefined }))?.type).toBe('askUser')
  })

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

  it('leaves unknown kinds unrendered', () => {
    expect(toAskPart(askUser({ kind: 'paused' }))).toBeUndefined()
  })

  it('still maps run approvals and permission asks', () => {
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
    ).toMatchObject({ type: 'permissionAsk', target: 'example.org' })
  })
})

describe('isAskPart', () => {
  it('recognises every ask card and nothing else', () => {
    expect(
      (
        [
          'runApproval',
          'permissionAsk',
          'askUser',
          'text',
          'tool',
          'paywall'
        ] as const
      ).map((type) => isAskPart(fromPartial<MessagePart>({ type })))
    ).toEqual([true, true, true, false, false, false])
  })
})
