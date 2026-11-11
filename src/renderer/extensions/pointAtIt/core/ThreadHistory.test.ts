import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import { messages } from './messages'
import ThreadHistory from './ThreadHistory.vue'
import type { ThreadMessage } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')

function answer(
  text: string,
  value: number | null,
  result: 'accepted' | 'changed' | null,
  index: number
): ThreadMessage {
  return {
    kind: 'answer',
    ref: { turnId: 'turn-1', followUpId: null, index },
    step: {
      annotationId: 'comment-1',
      text,
      target: width,
      waitFor: null,
      offerEdit: value === null ? null : { target: width, value },
      problems: [],
      result,
      valueBefore: result ? 1024 : null
    }
  }
}

const thread: ThreadMessage[] = [
  { kind: 'comment', text: 'make this wider' },
  answer('Change width to 1280.', 1280, 'accepted', 0),
  {
    kind: 'followUp',
    id: 'followUp-1',
    text: 'a bit more than that',
    thinking: 'Going a little further.'
  },
  answer('Go to 1408.', 1408, 'changed', 1),
  {
    kind: 'followUp',
    id: 'followUp-2',
    text: 'what does it do?',
    thinking: ''
  },
  answer('It sets how wide the picture is.', null, null, 2),
  answer('Or try 1536.', 1536, null, 3)
]

describe('ThreadHistory', () => {
  it('TH-01: shows the thread oldest first, saying who said what', () => {
    render(ThreadHistory, { props: { thread } })

    const said = within(
      screen.getByRole('log', { name: messages.threadLabel })
    ).getAllByRole('listitem')

    expect(said.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^You\s*make this wider$/),
      expect.stringContaining('Agent'),
      expect.stringContaining('a bit more than that'),
      expect.stringContaining('Go to 1408.'),
      expect.stringContaining('what does it do?'),
      expect.stringContaining('It sets how wide the picture is.'),
      expect.stringContaining('Or try 1536.')
    ])
  })

  it('TH-06, TH-15: earlier answers say what was offered and what the person did, with nothing to press', () => {
    render(ThreadHistory, { props: { thread } })

    expect(
      screen.getByText('Offered 1280 for width · you accepted it')
    ).toBeVisible()
    expect(
      screen.getByText('Offered 1408 for width · you changed it yourself')
    ).toBeVisible()
    expect(screen.getByText('Offered 1536 for width · not taken')).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('TH-16: the thinking for a follow-up stays readable from the thread', () => {
    render(ThreadHistory, { props: { thread } })

    expect(screen.getByText('Going a little further.')).toBeInTheDocument()
    expect(screen.getAllByText(messages.thinking)).toHaveLength(1)
  })
})
