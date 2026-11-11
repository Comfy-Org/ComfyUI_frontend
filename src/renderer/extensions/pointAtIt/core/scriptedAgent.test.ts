import { describe, expect, it } from 'vitest'

import type { AgentRequest, AnnotationNote, ReplyAddress } from './agentReply'
import { hostNode, settingAddress, textToImageNodes } from './fakePointHost'
import { answers } from './messages'
import { answerRequest } from './scriptedAgent'

const nodes = textToImageNodes()
const [sampler, latent, save] = nodes
const run: ReplyAddress = { kind: 'control', control: 'run' }
const runStep = {
  annotationId: null,
  text: answers.runNext,
  target: run,
  waitFor: { for: 'run' },
  offerEdit: null
}

function note(
  id: string,
  comment: string,
  targets: AnnotationNote['targets'] = []
): AnnotationNote {
  return { id, label: 'label', comment, targets }
}

function answer(
  annotations: AnnotationNote[],
  workflow = nodes,
  wrongTarget = false
) {
  const request: AgentRequest = {
    kind: 'batch',
    requestId: 'request-7',
    annotations,
    history: []
  }
  return answerRequest(request, workflow, { wrongTarget }).steps
}

describe('answerRequest', () => {
  it('AN-16: answers every comment of a batch, each step naming its comment, with one Run step at the end', () => {
    const width = settingAddress(latent.id, 'width')
    const steps = settingAddress(sampler.id, 'steps')
    const picture = { kind: 'node' as const, nodeId: save.id }

    expect(
      answer([
        note('comment-1', 'make this wider', [picture]),
        note('comment-2', 'what is this?', [steps]),
        note('comment-3', 'more steps', [steps])
      ])
    ).toEqual([
      {
        annotationId: 'comment-1',
        text: answers.sizeLead('width', 1536, true),
        target: width,
        waitFor: { for: 'valueChange', of: width, direction: 'increase' },
        offerEdit: { target: width, value: 1536 }
      },
      {
        annotationId: 'comment-2',
        text: 'KSampler › steps: The number of steps used in the denoising process.',
        target: steps,
        waitFor: null,
        offerEdit: null
      },
      {
        annotationId: 'comment-3',
        text: answers.stepsLead(30, true),
        target: steps,
        waitFor: { for: 'valueChange', of: steps, direction: 'increase' },
        offerEdit: { target: steps, value: 30 }
      },
      runStep
    ])
  })

  it('finds the size node by its settings in a workflow with other ids and types', () => {
    const workflow = [
      hostNode({
        id: 41,
        type: 'EmptySD3LatentImage',
        title: 'Latent',
        rect: null,
        settings: [
          { name: 'width', value: 768 },
          { name: 'height', value: 512 }
        ]
      })
    ]

    expect(
      answer([note('comment-1', 'make it taller')], workflow)[0]
    ).toMatchObject({
      target: settingAddress(workflow[0].id, 'height'),
      offerEdit: { value: 768 }
    })
  })

  it('answers fewer steps with a lower value and a wait for a decrease', () => {
    const steps = settingAddress(sampler.id, 'steps')

    expect(answer([note('comment-1', 'fewer steps please')])[0]).toMatchObject({
      text: answers.stepsLead(10, false),
      waitFor: { for: 'valueChange', of: steps, direction: 'decrease' },
      offerEdit: { target: steps, value: 10 }
    })
  })

  it('answers "what is this?" about a node with the node’s own description, and adds no Run step', () => {
    const marked = { kind: 'node' as const, nodeId: sampler.id }

    expect(answer([note('comment-1', 'What does this do?', [marked])])).toEqual(
      [
        {
          annotationId: 'comment-1',
          text: 'KSampler: Denoises a latent using the model and the prompts.',
          target: marked,
          waitFor: null,
          offerEdit: null
        }
      ]
    )
  })

  it('says so when the commented thing has no description', () => {
    const marked = { kind: 'node' as const, nodeId: save.id }

    expect(
      answer([note('comment-1', 'what is this?', [marked])])[0]
    ).toMatchObject({
      text: answers.noDescription('Save Image'),
      target: marked
    })
  })

  it('E-06: answers a comment on an interface element by saying what was marked, pointing at it', () => {
    const queue = {
      kind: 'element' as const,
      elementId: 'element-1',
      label: 'Run',
      role: 'button',
      context: 'toolbar "Actions"',
      testId: 'queue-button'
    }

    expect(answer([note('comment-1', 'make this wider', [queue])])).toEqual([
      {
        annotationId: 'comment-1',
        text: answers.describeElement(queue),
        target: { kind: 'element', elementId: 'element-1' },
        waitFor: null,
        offerEdit: null
      }
    ])
  })

  it('TH-17: answers a follow-up by the words of the new message, as one step for the thread’s comment and no Run step', () => {
    const width = settingAddress(latent.id, 'width')
    const request: AgentRequest = {
      kind: 'followUp',
      requestId: 'request-8',
      comment: note('comment-1', 'what is this?', [width]),
      thread: [],
      followUp: 'make it wider',
      history: []
    }

    expect(answerRequest(request, nodes, { wrongTarget: false }).steps).toEqual(
      [
        {
          annotationId: 'comment-1',
          text: answers.sizeLead('width', 1536, true),
          target: width,
          waitFor: { for: 'valueChange', of: width, direction: 'increase' },
          offerEdit: { target: width, value: 1536 }
        }
      ]
    )
  })

  it('X-02: says it has no script for a comment and lists what it can answer', () => {
    expect(answer([note('comment-1', 'why is the sky blue?')])).toEqual([
      {
        annotationId: 'comment-1',
        text: `${answers.noScript}\n\n${answers.canAnswer}`,
        target: null,
        waitFor: null,
        offerEdit: null
      }
    ])
  })

  it('X-02: says so when no node in the workflow fits the comment', () => {
    expect(
      answer([note('comment-1', 'make it wider')], [save])[0]
    ).toMatchObject({
      text: `${answers.noSizeNode}\n\n${answers.canAnswer}`,
      target: null
    })
  })

  it('X-01: with the wrong target on, the same text lands on a different node', () => {
    const right = answer([note('comment-1', 'how do I make this wider?')])
    const wrong = answer(
      [note('comment-1', 'how do I make this wider?')],
      nodes,
      true
    )

    expect(wrong).toEqual([
      {
        annotationId: 'comment-1',
        text: right[0].text,
        target: { kind: 'node', nodeId: save.id },
        waitFor: null,
        offerEdit: null
      },
      runStep
    ])
  })
})
