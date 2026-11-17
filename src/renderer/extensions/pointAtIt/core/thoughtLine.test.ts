import { describe, expect, it } from 'vitest'

import { messages } from './messages'
import type { ThinkingLog } from './thinkingLog'
import { latestThought, waitingLine } from './thoughtLine'

describe('latestThought', () => {
  it.for([
    {
      name: 'nothing has arrived yet',
      text: '',
      done: false,
      expected: ''
    },
    {
      name: 'the first sentence is still being written, so there is nothing to show',
      text: "I'm checking which node sets the pic",
      done: false,
      expected: ''
    },
    {
      name: 'a sentence that has just ended is shown',
      text: "I'm checking which node sets the picture's width.",
      done: false,
      expected: "I'm checking which node sets the picture's width."
    },
    {
      name: 'the sentence after it is held back until it ends; the finished one stays',
      text: "I'm checking which node sets the width. It is the latent im",
      done: false,
      expected: "I'm checking which node sets the width."
    },
    {
      name: 'only the latest finished sentence is shown, not the ones before it',
      text: 'First look. Then the sampler. Now the latent. And the',
      done: false,
      expected: 'Now the latent.'
    },
    {
      name: 'a line break ends a thought as well',
      text: 'Reading the graph\nChecking the width\nThe size com',
      done: false,
      expected: 'Checking the width'
    },
    {
      name: 'a number with a decimal point does not end a sentence',
      text: 'cfg is set to 3.5 here, which is quite',
      done: false,
      expected: ''
    },
    {
      name: 'when the thinking is done the last words count as a thought',
      text: 'So the answer is the latent width',
      done: true,
      expected: 'So the answer is the latent width'
    },
    {
      name: 'markdown marks around a heading are dropped',
      text: '**Looking at the workflow**\n\nIt has nine nodes.',
      done: false,
      expected: 'It has nine nodes.'
    }
  ])('$name', ({ text, done, expected }) => {
    expect(latestThought(text, { done })).toBe(expected)
  })

  it('shows the same thought however the fragments were cut', () => {
    const fragments = [
      "I'm checking which node s",
      'ets the pic',
      "ture's width."
    ]
    let text = ''
    const seen: string[] = []
    for (const fragment of fragments) {
      text += fragment
      seen.push(latestThought(text, { done: false }))
    }

    expect(seen).toEqual([
      '',
      '',
      "I'm checking which node sets the picture's width."
    ])
  })
})

describe('waitingLine', () => {
  const log = (text: string, done = false): ThinkingLog => ({
    requestId: 'request-1',
    text,
    done
  })

  it.for([
    { name: 'there is no thinking log', thinking: null },
    { name: 'nothing has arrived yet', thinking: log('') },
    {
      name: 'the first sentence is still being written',
      thinking: log("I'm checking which node s")
    }
  ])('CP-04: is the plain waiting line when $name', ({ thinking }) => {
    expect(waitingLine(thinking)).toBe(messages.askWaiting)
  })

  it('CP-04: is the latest finished thought, and a newer one replaces it', () => {
    expect(waitingLine(log('First thought. Second thought. Thi'))).toBe(
      'Second thought.'
    )
  })

  it('CP-04: shows the last thought once the thinking is done', () => {
    expect(waitingLine(log('First thought. Second thought', true))).toBe(
      'Second thought'
    )
  })
})
