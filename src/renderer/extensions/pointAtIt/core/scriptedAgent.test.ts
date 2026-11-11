import { describe, expect, it } from 'vitest'

import type { AgentQuestion, TargetAddress } from './agentReply'
import { hostNode, settingAddress, textToImageNodes } from './fakePointHost'
import { answers } from './messages'
import { answerQuestion } from './scriptedAgent'

const nodes = textToImageNodes()
const [sampler, latent, save] = nodes
const run: TargetAddress = { kind: 'control', control: 'run' }

function ask(
  text: string,
  marked: TargetAddress[] = [],
  workflow = nodes,
  wrongTarget = false
) {
  const question: AgentQuestion = { questionId: 'question-7', text, marked }
  return answerQuestion(question, workflow, { wrongTarget })
}

describe('answerQuestion', () => {
  it('answers a wider picture by pointing at the size node, waiting for the change, then at Run', () => {
    const width = settingAddress(latent.id, 'width')

    expect(ask('how do I make this wider?')).toEqual({
      questionId: 'question-7',
      steps: [
        {
          text: answers.sizeLead('width', 1536, true),
          target: width,
          waitFor: { for: 'valueChange', of: width, direction: 'increase' },
          offerEdit: { target: width, value: 1536 }
        },
        { text: answers.runNext, target: run, waitFor: { for: 'run' } }
      ]
    })
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

    expect(ask('make it taller', [], workflow).steps[0]).toMatchObject({
      target: settingAddress(workflow[0].id, 'height'),
      offerEdit: { value: 768 }
    })
  })

  it.for([
    { question: 'I want more steps', value: 30, direction: 'increase' },
    { question: 'fewer steps please', value: 10, direction: 'decrease' }
  ])('answers "$question" on the sampler', ({ question, value, direction }) => {
    const steps = settingAddress(sampler.id, 'steps')

    expect(ask(question).steps).toEqual([
      {
        text: answers.stepsLead(value, direction === 'increase'),
        target: steps,
        waitFor: { for: 'valueChange', of: steps, direction },
        offerEdit: { target: steps, value }
      },
      { text: answers.runNext, target: run, waitFor: { for: 'run' } }
    ])
  })

  it('answers "what is this?" with the marked setting’s own description', () => {
    const steps = settingAddress(sampler.id, 'steps')

    expect(ask('what is this?', [steps]).steps).toEqual([
      {
        text: 'KSampler › steps: The number of steps used in the denoising process.',
        target: steps
      }
    ])
  })

  it('answers "what is this?" with the marked node’s own description', () => {
    const marked: TargetAddress = { kind: 'node', nodeId: sampler.id }

    expect(ask('What does this do?', [marked]).steps).toEqual([
      {
        text: 'KSampler: Denoises a latent using the model and the prompts.',
        target: marked
      }
    ])
  })

  it('says so when the marked thing has no description', () => {
    const marked: TargetAddress = { kind: 'node', nodeId: save.id }

    expect(ask('what is this?', [marked]).steps).toEqual([
      { text: answers.noDescription('Save Image'), target: marked }
    ])
  })

  it('X-02: says it has no script for the question and lists what it can answer', () => {
    expect(ask('why is the sky blue?').steps).toEqual([
      { text: `${answers.noScript}\n\n${answers.canAnswer}`, target: null }
    ])
  })

  it('X-02: says so when no node in the workflow fits the question', () => {
    expect(ask('make it wider', [], [save]).steps).toEqual([
      { text: `${answers.noSizeNode}\n\n${answers.canAnswer}`, target: null }
    ])
  })

  it('X-01: with the wrong target on, the same text lands on a different node', () => {
    const right = ask('how do I make this wider?').steps
    const wrong = ask('how do I make this wider?', [], nodes, true).steps

    expect(wrong).toEqual([
      { text: right[0].text, target: { kind: 'node', nodeId: save.id } },
      right[1]
    ])
  })
})
