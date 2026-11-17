import { describe, expect, it } from 'vitest'

import type { AgentRequest, AnnotationNote, ReplyAddress } from './agentReply'
import { hostNode, settingAddress, textToImageNodes } from './fakePointHost'
import { answers } from './messages'
import type { HostNode } from './pointHost'
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

  it('CP-54: a message pinned on nothing keeps the known patterns: a size or a step count is answered, pointing at the setting', () => {
    const width = settingAddress(latent.id, 'width')

    expect(answer([note('comment-1', 'Make the picture larger')])).toEqual([
      {
        annotationId: 'comment-1',
        text: answers.sizeLead('width', 1536, true),
        target: width,
        waitFor: { for: 'valueChange', of: width, direction: 'increase' },
        offerEdit: { target: width, value: 1536 }
      },
      runStep
    ])
    expect(answer([note('comment-1', 'Make it run faster')])[0]).toMatchObject({
      text: answers.stepsLead(10, false)
    })
  })

  describe('a tour of the workflow, asked with nothing marked', () => {
    const latentNode = hostNode({
      id: 5,
      type: 'EmptyLatentImage',
      title: 'Empty Latent Image',
      description: 'Makes the blank picture.',
      rect: null
    })
    const samplerNode = hostNode({
      id: 3,
      type: 'KSampler',
      title: 'KSampler',
      description: 'Denoises it.',
      rect: null,
      links: [{ input: 'latent_image', from: latentNode.id, output: 'LATENT' }]
    })
    const saveNode = hostNode({
      id: 9,
      type: 'SaveImage',
      title: 'Save Image',
      rect: null,
      links: [{ input: 'images', from: samplerNode.id, output: 'IMAGE' }]
    })
    const noteNode = hostNode({
      id: 10,
      type: 'Note',
      title: 'Note',
      description: 'Free text.',
      rect: null
    })

    const lead = (text: string) => ({
      annotationId: 'comment-1',
      text,
      target: null,
      waitFor: null,
      offerEdit: null
    })
    const stop = (node: HostNode, text: string) => ({
      annotationId: 'comment-1',
      text,
      target: { kind: 'node' as const, nodeId: node.id },
      waitFor: null,
      offerEdit: null
    })

    it.for([
      'Explain this workflow',
      'What does this do?',
      'walk me through it'
    ])(
      'CP-92: "%s" gives a lead-in pointing at nothing, then one stop per main node in the order the data flows, leaving out the note, and no Run step',
      (words) => {
        expect(
          answer(
            [note('comment-1', words)],
            [saveNode, samplerNode, noteNode, latentNode]
          )
        ).toEqual([
          lead(answers.tourLead(3)),
          stop(latentNode, 'Empty Latent Image: Makes the blank picture.'),
          stop(samplerNode, 'KSampler: Denoises it.'),
          stop(saveNode, answers.noDescription('Save Image'))
        ])
      }
    )

    it('CP-92: a long chain is cut to six stops, and the last one is still where it ends', () => {
      const chain = Array.from({ length: 9 }).reduce<HostNode[]>(
        (built, _, index) => {
          const previous = built.at(-1)
          return [
            ...built,
            hostNode({
              id: index + 1,
              type: 'Step',
              title: `Step ${index + 1}`,
              rect: null,
              links: previous
                ? [{ input: 'in', from: previous.id, output: 'OUT' }]
                : []
            })
          ]
        },
        []
      )

      const steps = answer([note('comment-1', 'explain this workflow')], chain)

      expect(steps[0]).toEqual(lead(answers.tourLead(6)))
      expect(steps.slice(1).map((step) => step.target)).toEqual(
        [...chain.slice(0, 5), chain[8]].map((node) => ({
          kind: 'node',
          nodeId: node.id
        }))
      )
    })

    it('CP-92: a workflow of notes only has nothing to show, and says so', () => {
      expect(
        answer([note('comment-1', 'explain this workflow')], [noteNode])
      ).toEqual([lead(answers.emptyWorkflow)])
    })

    it('CP-92: a follow-up that asks to explain the workflow, in a thread pinned on nothing, is answered with the tour for that thread’s comment', () => {
      const request: AgentRequest = {
        kind: 'followUp',
        requestId: 'request-9',
        comment: note('comment-1', 'hi'),
        thread: [],
        followUp: 'now explain the workflow',
        history: []
      }

      expect(
        answerRequest(request, [samplerNode, latentNode], {
          wrongTarget: false
        }).steps
      ).toEqual([
        lead(answers.tourLead(2)),
        stop(latentNode, 'Empty Latent Image: Makes the blank picture.'),
        stop(samplerNode, 'KSampler: Denoises it.')
      ])
    })
  })

  it.for(['hi', 'Hello there', '  hey!'])(
    'CP-54: a greeting (%j) gets a friendly line and what the script can answer, pointing at nothing',
    (greeting) => {
      expect(answer([note('comment-1', greeting)])).toEqual([
        {
          annotationId: 'comment-1',
          text: `${answers.greeting}\n\n${answers.canAnswer}`,
          target: null,
          waitFor: null,
          offerEdit: null
        }
      ])
    }
  )

  it('CP-54: a greeting that carries a question is answered as the question', () => {
    expect(answer([note('comment-1', 'hi, make it taller')])[0]).toMatchObject({
      target: settingAddress(latent.id, 'height')
    })
  })

  it('CP-54: any other free text, even empty-looking or odd, gets the usual line and never throws', () => {
    for (const text of ['', '???', '日本語', 'a'.repeat(5000)])
      expect(answer([note('comment-1', text)])).toEqual([
        {
          annotationId: 'comment-1',
          text: `${answers.noScript}\n\n${answers.canAnswer}`,
          target: null,
          waitFor: null,
          offerEdit: null
        }
      ])
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
