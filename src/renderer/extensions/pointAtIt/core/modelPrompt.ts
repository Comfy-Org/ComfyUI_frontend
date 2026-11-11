import { omit } from 'es-toolkit'
import { z } from 'zod'

import { AGENT_INSTRUCTIONS } from './agentPrompt'
import { agentReplySchema, answerableNotes } from './agentReply'
import type {
  AgentRequest,
  AnnotationNote,
  HistoryTurn,
  ThreadNote
} from './agentReply'
import type { PointConfig } from './config'
import type { ChatBody } from './modelWire'
import type { HostLink, HostNode, HostSetting } from './pointHost'
import type { SettingValue } from './targetAddress'

const MAX_WORKFLOW_CHARS = 48_000
const MAX_HISTORY_CHARS = 12_000
const MAX_THREAD_CHARS = 8_000
const MAX_DESCRIPTION_CHARS = 200
const MAX_TEXT_VALUE_CHARS = 300
const MAX_OPTIONS = 30

interface Detail {
  settingText: boolean
  nodeText: boolean
  links: boolean
}

const DETAIL_LEVELS: { detail: Detail; cut: string | null }[] = [
  { detail: { settingText: true, nodeText: true, links: true }, cut: null },
  {
    detail: { settingText: false, nodeText: true, links: true },
    cut: 'setting descriptions removed'
  },
  {
    detail: { settingText: false, nodeText: false, links: true },
    cut: 'node descriptions and option lists removed'
  },
  {
    detail: { settingText: false, nodeText: false, links: false },
    cut: 'links between nodes removed'
  }
]

function shorten(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function compactValue(value: SettingValue | undefined): SettingValue | null {
  if (value === undefined) return null
  return typeof value === 'string'
    ? shorten(value, MAX_TEXT_VALUE_CHARS)
    : value
}

function compactSetting(setting: HostSetting, detail: Detail) {
  return {
    name: setting.name,
    ...(setting.label === setting.name ? {} : { label: setting.label }),
    value: compactValue(setting.value),
    ...(detail.nodeText && setting.options
      ? { options: setting.options.slice(0, MAX_OPTIONS) }
      : {}),
    ...(detail.settingText && setting.description
      ? { about: shorten(setting.description, MAX_DESCRIPTION_CHARS) }
      : {})
  }
}

function compactLink(link: HostLink) {
  return { input: link.input, from: link.from, output: link.output }
}

function compactNode(node: HostNode, detail: Detail) {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    ...(detail.nodeText && node.description
      ? { about: shorten(node.description, MAX_DESCRIPTION_CHARS) }
      : {}),
    settings: node.settings.map((setting) => compactSetting(setting, detail)),
    ...(detail.links && node.links.length > 0
      ? { inputs: node.links.map(compactLink) }
      : {})
  }
}

function nodeRank(
  node: HostNode,
  annotated: ReadonlySet<string>,
  linked: ReadonlySet<string>
): number {
  if (annotated.has(node.id)) return 0
  return linked.has(node.id) ? 1 : 2
}

function annotatedFirst(
  nodes: readonly HostNode[],
  request: AgentRequest
): HostNode[] {
  const annotated = new Set<string>(
    answerableNotes(request).flatMap((note) =>
      note.targets.flatMap((target) =>
        target.kind === 'element' ? [] : [target.nodeId]
      )
    )
  )
  const linked = new Set<string>(
    nodes
      .filter((node) => annotated.has(node.id))
      .flatMap((node) => node.links.map((link) => link.from))
  )
  return [...nodes].sort(
    (a, b) => nodeRank(a, annotated, linked) - nodeRank(b, annotated, linked)
  )
}

function withinBudget(
  nodes: readonly HostNode[],
  detail: Detail,
  budget: number
): unknown[] {
  const kept: unknown[] = []
  let used = 0
  for (const node of nodes) {
    const compact = compactNode(node, detail)
    used += JSON.stringify(compact).length
    if (used > budget && kept.length > 0) break
    kept.push(compact)
  }
  return kept
}

/**
 * The open workflow as compact JSON for the model, cut down in a fixed order
 * until it fits `budget`; `cut` says in words what was left out.
 */
export function describeWorkflow(
  nodes: readonly HostNode[],
  request: AgentRequest,
  budget = MAX_WORKFLOW_CHARS
): { nodes: unknown[]; cut: string[] } {
  const cut: string[] = []
  for (const level of DETAIL_LEVELS) {
    if (level.cut) cut.push(level.cut)
    const compact = nodes.map((node) => compactNode(node, level.detail))
    if (JSON.stringify(compact).length <= budget) return { nodes: compact, cut }
  }
  const leanest = DETAIL_LEVELS[DETAIL_LEVELS.length - 1].detail
  const kept = withinBudget(annotatedFirst(nodes, request), leanest, budget)
  return {
    nodes: kept,
    cut: [
      ...cut,
      `${nodes.length - kept.length} of ${nodes.length} nodes left out`
    ]
  }
}

function compactComment(note: AnnotationNote) {
  return {
    id: note.id,
    pinnedOn: note.targets,
    label: note.label,
    comment: note.comment
  }
}

function compactTurn(turn: HistoryTurn, index: number) {
  return {
    turn: index + 1,
    comments: turn.comments.map(compactComment),
    answer: turn.answer,
    ...(turn.followUps.length > 0 ? { followUps: turn.followUps } : {})
  }
}

/** The index of the first item kept when the newest are kept within `budget`; the newest always is. */
function firstKeptWithin(items: readonly unknown[], budget: number): number {
  let used = 0
  let firstKept = items.length
  while (firstKept > 0) {
    used += JSON.stringify(items[firstKept - 1]).length
    if (used > budget && firstKept < items.length) break
    firstKept -= 1
  }
  return firstKept
}

function withoutOldestFollowUps(
  turn: HistoryTurn,
  index: number,
  budget: number
): unknown {
  let kept = turn.followUps
  while (
    kept.length > 0 &&
    JSON.stringify(compactTurn({ ...turn, followUps: kept }, index)).length >
      budget
  )
    kept = kept.slice(1)
  return {
    ...compactTurn({ ...turn, followUps: kept }, index),
    followUpsLeftOut: turn.followUps.length - kept.length
  }
}

/**
 * The earlier turns for the model, oldest first, with their threads. When
 * they do not fit `budget` the oldest turns are left out whole; the newest
 * turn is always kept, and loses its oldest follow-ups when it alone is
 * still too long.
 */
export function describeHistory(
  history: readonly HistoryTurn[],
  budget = MAX_HISTORY_CHARS
): { turns: unknown[]; leftOut: number } {
  const compact = history.map(compactTurn)
  const firstKept = firstKeptWithin(compact, budget)
  const newest = history.at(-1)
  const isNewestAloneTooLong =
    newest !== undefined &&
    firstKept === history.length - 1 &&
    JSON.stringify(compact[firstKept]).length > budget
  return {
    turns: isNewestAloneTooLong
      ? [withoutOldestFollowUps(newest, firstKept, budget)]
      : compact.slice(firstKept),
    leftOut: firstKept
  }
}

/**
 * The earlier messages of a thread for the model, oldest first. When they
 * do not fit `budget` the oldest are left out; the newest is always kept.
 */
export function describeThread(
  thread: readonly ThreadNote[],
  budget = MAX_THREAD_CHARS
): { messages: ThreadNote[]; leftOut: number } {
  const firstKept = firstKeptWithin(thread, budget)
  return { messages: thread.slice(firstKept), leftOut: firstKept }
}

function asked(request: AgentRequest): Record<string, unknown> {
  if (request.kind === 'batch')
    return { comments: request.annotations.map(compactComment) }
  const thread = describeThread(request.thread)
  return {
    thread: {
      comment: compactComment(request.comment),
      messages: thread.messages,
      messagesLeftOut: thread.leftOut,
      followUp: request.followUp
    }
  }
}

/** The reply format as the JSON Schema the provider enforces. */
function replyJsonSchema(): Record<string, unknown> {
  return omit(z.toJSONSchema(agentReplySchema), ['$schema'])
}

function replyFormatInstructions(schema: Record<string, unknown>): string {
  return [
    'Reply format',
    'Reply with one JSON object and nothing else: no text before or after it and no code fence. It must match this JSON Schema:',
    JSON.stringify(schema)
  ].join('\n')
}

/**
 * Everything the model is sent for one request: the instructions, the
 * comments of a Send or the thread of a follow-up, the earlier turns, the
 * workflow description and the reply format. No screenshot.
 */
export function buildChatBody(
  request: AgentRequest,
  nodes: readonly HostNode[],
  model: PointConfig['model']
): ChatBody {
  const workflow = describeWorkflow(nodes, request)
  const history = describeHistory(request.history)
  const schema = replyJsonSchema()
  return {
    messages: [
      {
        role: 'system',
        content: model.showThinking
          ? `${AGENT_INSTRUCTIONS}\n\n${replyFormatInstructions(schema)}`
          : AGENT_INSTRUCTIONS
      },
      {
        role: 'user',
        content: JSON.stringify({
          ...asked(request),
          earlierTurns: history.turns,
          earlierTurnsLeftOut: history.leftOut,
          workflow: { nodes: workflow.nodes, leftOut: workflow.cut }
        })
      }
    ],
    ...(model.showThinking
      ? {
          max_tokens: model.replyTokens + model.thinkingTokens,
          reasoning: { effort: model.thinkingEffort }
        }
      : {
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'canvas_guidance', strict: true, schema }
          },
          max_tokens: model.replyTokens,
          reasoning: { exclude: true }
        })
  }
}
