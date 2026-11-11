import { describe, expect, it } from 'vitest'

import type { AgentReply, AgentRequest, ReplyStep } from './agentReply'
import { settingAddress, textToImageNodes } from './fakePointHost'
import { problems } from './messages'
import { checkReply } from './replyValidation'

const nodes = textToImageNodes()
const latent = nodes[1]
const width = settingAddress(latent.id, 'width')
const request: AgentRequest = {
  requestId: 'request-1',
  annotations: [
    { id: 'comment-1', label: 'Save Image', comment: 'wider', targets: [] }
  ]
}

function step(overrides: Partial<ReplyStep>): ReplyStep {
  return {
    annotationId: 'comment-1',
    text: 'Change width.',
    target: width,
    waitFor: { for: 'valueChange', of: width, direction: 'increase' },
    offerEdit: { target: width, value: 1536 },
    ...overrides
  }
}

function check(...steps: ReplyStep[]) {
  const reply: AgentReply = { steps }
  return checkReply(reply, request, nodes)
}

describe('checkReply', () => {
  it('passes a step whose every address is in the workflow', () => {
    expect(check(step({}))).toEqual([{ ...step({}), problems: [] }])
  })

  it('L-02: keeps a step that names an unknown node, without a target, and says so', () => {
    const unknown = { kind: 'node' as const, nodeId: '999' }

    expect(check(step({ target: unknown }))).toEqual([
      {
        annotationId: 'comment-1',
        text: 'Change width.',
        target: null,
        waitFor: null,
        offerEdit: null,
        problems: [problems.unknownNode('999')]
      }
    ])
  })

  it('L-02: says once that a setting is unknown when the target, the wait and the offer all name it', () => {
    const unknown = settingAddress(latent.id, 'depth')

    expect(
      check(
        step({
          target: unknown,
          waitFor: { for: 'valueChange', of: unknown, direction: null },
          offerEdit: { target: unknown, value: 2 }
        })
      )
    ).toMatchObject([
      {
        target: null,
        waitFor: null,
        offerEdit: null,
        problems: [problems.unknownSetting(unknown)]
      }
    ])
  })

  it('L-03: removes an offered value of the wrong type and says so', () => {
    expect(
      check(step({ offerEdit: { target: width, value: 'wide' } }))
    ).toMatchObject([
      {
        target: width,
        offerEdit: null,
        problems: [problems.valueNotAccepted('width', 'wide')]
      }
    ])
  })

  it('answers no comment when the step names a comment that was not sent', () => {
    expect(check(step({ annotationId: 'comment-9' }))).toMatchObject([
      { annotationId: null }
    ])
  })

  it.for([
    { name: 'no steps', raw: { steps: [] } },
    { name: 'a step with no text', raw: { steps: [{ target: null }] } },
    { name: 'plain text', raw: 'Change the width.' },
    { name: 'nothing', raw: null }
  ])('L-04: rejects a reply with $name', ({ raw }) => {
    expect(checkReply(raw, request, nodes)).toBeNull()
  })
})
