import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import { settingAddress } from './fakePointHost'
import type { GuidanceStep } from './replyValidation'
import type { ElementAddress } from './targetAddress'
import { emptyConversation, reduceConversation } from './turns'
import type { Annotation, Conversation, ConversationEvent } from './turns'

const width = settingAddress(createNodeLocatorId(null, 5), 'width')
const runButton: ElementAddress = {
  kind: 'element',
  elementId: 'element-4',
  label: 'Run',
  role: 'button',
  context: 'toolbar "Actions"',
  testId: 'queue-button'
}

function question(
  id: string,
  comment: string,
  targets: Annotation['targets'] = [width]
): Annotation {
  return { id, targets, label: 'Empty Latent Image › width', comment }
}

function widen(annotationId: string, value: number): GuidanceStep {
  return {
    annotationId,
    text: `Change width to ${value}.`,
    target: width,
    waitFor: { for: 'valueChange', of: width, direction: 'increase' },
    offerEdit: { target: width, value },
    problems: []
  }
}

function after(start: Conversation, events: ConversationEvent[]): Conversation {
  return events.reduce(reduceConversation, start)
}

/** One answered turn of two questions, the first with an answered follow-up and an accepted offer. */
export function oneTurn(thinking = 'Checking the width.'): Conversation {
  return after(emptyConversation, [
    { type: 'saved', ...question('comment-1', 'make this wider') },
    { type: 'saved', ...question('comment-2', 'what is this?', [runButton]) },
    {
      type: 'answered',
      turnId: 'turn-3',
      sentAt: 1_700_000_000_000,
      steps: [
        widen('comment-1', 1280),
        {
          annotationId: 'comment-2',
          text: 'This runs the workflow.',
          target: runButton,
          waitFor: null,
          offerEdit: null,
          problems: [
            'The agent named node "99", which is not in this workflow.'
          ]
        },
        {
          annotationId: null,
          text: 'Now run it.',
          target: { kind: 'control', control: 'run' },
          waitFor: { for: 'run' },
          offerEdit: null,
          problems: []
        }
      ],
      thinking
    },
    {
      type: 'actedOn',
      ref: { turnId: 'turn-3', followUpId: null, index: 0 },
      result: 'accepted',
      valueBefore: 1024
    },
    {
      type: 'followedUp',
      commentId: 'comment-1',
      followUpId: 'followUp-5',
      text: 'a bit more than that',
      steps: [widen('comment-1', 1408)],
      thinking: 'Going a little further.'
    }
  ])
}

/** The same turn with one more question that is not sent yet. */
export function withUnsent(thinking?: string): Conversation {
  return after(oneTurn(thinking), [
    { type: 'saved', ...question('comment-6', 'and the height?') }
  ])
}

/** `count` answered turns, each of one question, oldest first, with `thinking` of the given length. */
export function manyTurns(count: number, thinkingChars: number): Conversation {
  return after(
    emptyConversation,
    Array.from({ length: count }, (_, index): ConversationEvent[] => [
      {
        type: 'saved',
        ...question(`comment-${index * 2 + 1}`, `question ${index}`)
      },
      {
        type: 'answered',
        turnId: `turn-${index * 2 + 2}`,
        sentAt: 1_700_000_000_000 + index,
        steps: [widen(`comment-${index * 2 + 1}`, 1280)],
        thinking: 't'.repeat(thinkingChars)
      }
    ]).flat()
  )
}

/** The browser's storage as a test can inspect it; `isFull` makes every write fail. */
export function fakeBrowserStorage() {
  const entries = new Map<string, string>()
  const storage = {
    entries,
    isFull: false,
    get length() {
      return entries.size
    },
    key: (index: number) => [...entries.keys()].at(index) ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem(key: string, value: string) {
      if (storage.isFull) throw new DOMException('full', 'QuotaExceededError')
      entries.set(key, value)
    },
    removeItem(key: string) {
      entries.delete(key)
    }
  }
  return storage
}
