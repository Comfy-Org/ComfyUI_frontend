import { isNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { z } from 'zod'

import type { Conversation, Turn } from './turns'

const STORED_VERSION = 1
const KEY_PREFIX = 'Comfy.PointAtItPoc.history.'
const ID_NUMBER = /-(\d+)$/

const nodeId = z.custom<NodeLocatorId>(isNodeLocatorId)
const settingValue = z.union([z.string(), z.number(), z.boolean()])
const nodeAddress = z.object({ kind: z.literal('node'), nodeId })
const settingAddress = z.object({
  kind: z.literal('setting'),
  nodeId,
  setting: z.string()
})
const elementAddress = z.object({
  kind: z.literal('element'),
  elementId: z.string(),
  label: z.string(),
  role: z.string(),
  context: z.string(),
  testId: z.string().nullable()
})
const runControl = z.object({
  kind: z.literal('control'),
  control: z.literal('run')
})

const annotation = z.object({
  id: z.string(),
  targets: z.array(z.union([nodeAddress, settingAddress, elementAddress])),
  label: z.string(),
  comment: z.string()
})

const answeredStep = z.object({
  annotationId: z.string().nullable(),
  text: z.string(),
  target: z
    .union([nodeAddress, settingAddress, elementAddress, runControl])
    .nullable(),
  waitFor: z
    .union([
      z.object({
        for: z.literal('valueChange'),
        of: settingAddress,
        direction: z.enum(['increase', 'decrease']).nullable()
      }),
      z.object({ for: z.literal('run') })
    ])
    .nullable(),
  offerEdit: z
    .object({ target: settingAddress, value: settingValue })
    .nullable(),
  problems: z.array(z.string()),
  result: z.enum(['accepted', 'changed']).nullable(),
  valueBefore: settingValue.nullable()
})

const turn = z.object({
  id: z.string(),
  sentAt: z.number(),
  comments: z.array(annotation),
  steps: z.array(answeredStep),
  thinking: z.string(),
  followUps: z.array(
    z.object({
      id: z.string(),
      commentId: z.string(),
      text: z.string(),
      steps: z.array(answeredStep),
      thinking: z.string()
    })
  )
})

const storedHistorySchema = z.object({
  version: z.literal(STORED_VERSION),
  savedAt: z.number(),
  turns: z.array(turn),
  unsent: z.array(annotation),
  pendingFollowUp: z
    .object({ commentId: z.string(), text: z.string() })
    .nullable()
})

/** One workflow's history as it is written to the browser's storage. */
export type StoredHistory = z.infer<typeof storedHistorySchema>

/** A follow-up that was sent and has no reply yet. */
export type PendingFollowUp = NonNullable<StoredHistory['pendingFollowUp']>

/** The storage key of one workflow's history. */
export function historyKey(workflowKey: string): string {
  return `${KEY_PREFIX}${workflowKey}`
}

export function isHistoryKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX)
}

/** What is kept of a conversation: its turns, its unsent comments and a follow-up still waiting. */
export function storedFrom(
  conversation: Conversation,
  pendingFollowUp: PendingFollowUp | null,
  savedAt: number
): StoredHistory {
  return {
    version: STORED_VERSION,
    savedAt,
    turns: [...conversation.turns],
    unsent: [...conversation.unsent],
    pendingFollowUp
  }
}

/** True when there is nothing worth keeping. */
export function isEmptyHistory(stored: StoredHistory): boolean {
  return (
    stored.turns.length === 0 &&
    stored.unsent.length === 0 &&
    stored.pendingFollowUp === null
  )
}

function withoutThinking(kept: Turn): Turn {
  return {
    ...kept,
    thinking: '',
    followUps: kept.followUps.map((followUp) => ({ ...followUp, thinking: '' }))
  }
}

/**
 * Cuts a history down to `maxChars` of JSON. Thinking goes first, oldest
 * turn first; then whole turns, oldest first. Unsent comments always stay.
 */
export function fitWithin(
  stored: StoredHistory,
  maxChars: number
): StoredHistory {
  let fitted = stored
  function isTooLong(): boolean {
    return JSON.stringify(fitted).length > maxChars
  }
  for (let index = 0; index < stored.turns.length && isTooLong(); index += 1)
    fitted = {
      ...fitted,
      turns: fitted.turns.map((kept, position) =>
        position === index ? withoutThinking(kept) : kept
      )
    }
  while (fitted.turns.length > 0 && isTooLong())
    fitted = { ...fitted, turns: fitted.turns.slice(1) }
  return fitted
}

/**
 * Reads a stored entry. Null when it is missing, not JSON, of another
 * version or invalid anywhere: a history is never loaded in part.
 */
export function parseStored(raw: string | null): StoredHistory | null {
  if (raw === null) return null
  try {
    const parsed = storedHistorySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** When a stored entry was written; 0 for one that cannot be read. */
export function savedAtOf(raw: string | null): number {
  return parseStored(raw)?.savedAt ?? 0
}

function idNumber(id: string): number {
  return Number(ID_NUMBER.exec(id)?.[1] ?? 0)
}

/** The highest number in the ids of a conversation, so new ids can start above it. */
export function highestIdNumber(conversation: Conversation): number {
  const comments = [
    ...conversation.unsent,
    ...conversation.turns.flatMap((kept) => kept.comments)
  ]
  const ids = [
    ...comments.map((comment) => comment.id),
    ...comments.flatMap((comment) =>
      comment.targets.flatMap((target) =>
        target.kind === 'element' ? [target.elementId] : []
      )
    ),
    ...conversation.turns.map((kept) => kept.id),
    ...conversation.turns.flatMap((kept) =>
      kept.followUps.map((followUp) => followUp.id)
    )
  ]
  return Math.max(0, ...ids.map(idNumber))
}

/**
 * The conversation a stored history comes back as. A follow-up that had no
 * reply comes back as an unsent comment pinned where its thread's comment
 * is pinned, so that its text is not lost.
 */
export function conversationFrom(stored: StoredHistory): Conversation {
  const { turns, unsent, pendingFollowUp } = stored
  if (!pendingFollowUp) return { turns, unsent }
  const asked = turns
    .flatMap((kept) => kept.comments)
    .find((comment) => comment.id === pendingFollowUp.commentId)
  return {
    turns,
    unsent: [
      ...unsent,
      {
        id: `comment-${highestIdNumber({ turns, unsent }) + 1}`,
        targets: asked?.targets ?? [],
        label: asked?.label ?? '',
        comment: pendingFollowUp.text
      }
    ]
  }
}
