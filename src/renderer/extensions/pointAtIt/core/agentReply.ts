import { z } from 'zod'

const nodeAddress = z.object({
  kind: z.literal('node'),
  nodeId: z.string().describe('The id of a node in the workflow.')
})

const settingAddress = z.object({
  kind: z.literal('setting'),
  nodeId: z.string().describe('The id of the node that owns the setting.'),
  setting: z.string().describe('The name of the setting on that node.')
})

const elementAddress = z.object({
  kind: z.literal('element'),
  elementId: z
    .string()
    .describe('The elementId of an interface element a comment is pinned on.')
})

const runControl = z.object({
  kind: z.literal('control'),
  control: z.literal('run')
})

const stepWait = z.union([
  z.object({
    for: z.literal('valueChange'),
    of: settingAddress,
    direction: z.enum(['increase', 'decrease']).nullable()
  }),
  z.object({ for: z.literal('run') })
])

const offeredEdit = z.object({
  target: settingAddress,
  value: z.union([z.string(), z.number(), z.boolean()])
})

const replyStep = z.object({
  annotationId: z
    .string()
    .nullable()
    .describe('The id of the comment this step answers, or null.'),
  text: z.string().describe('One or two short sentences shown in the bubble.'),
  target: z
    .union([nodeAddress, settingAddress, elementAddress, runControl])
    .nullable()
    .describe('Where the pointer lands, or null when nothing fits.'),
  waitFor: stepWait
    .nullable()
    .describe(
      'The step stays until this happens; null lets the person move on.'
    ),
  offerEdit: offeredEdit
    .nullable()
    .describe('An edit the person can accept instead of making it themselves.')
})

/** The reply format: what an agent backend emits for one request. */
export const agentReplySchema = z.object({
  steps: z.array(replyStep).describe('Shown in order, one at a time.')
})

export type AgentReply = z.infer<typeof agentReplySchema>
export type ReplyStep = AgentReply['steps'][number]
export type ReplyAddress = NonNullable<ReplyStep['target']>
export type ReplySettingAddress = z.infer<typeof settingAddress>
type ReplyElementAddress = z.infer<typeof elementAddress>

/** An interface element as the agent is told about it. */
export interface DescribedElement extends ReplyElementAddress {
  label: string
  role: string
  context: string
  testId: string | null
}

type NoteTarget =
  | z.infer<typeof nodeAddress>
  | ReplySettingAddress
  | DescribedElement

/** One pinned comment as the agent receives it. */
export interface AnnotationNote {
  id: string
  label: string
  comment: string
  targets: NoteTarget[]
}

/** One step of an earlier answer, as the agent is reminded of it. */
export interface HistoryStep {
  annotationId: string | null
  text: string
  target: ReplyAddress | null
  offered: ReplyStep['offerEdit']
  /** The person took the offered value, changed the setting themselves, or neither. */
  result: 'accepted' | 'changed' | null
  /** What the setting held before the person acted; null when they did not. */
  valueBefore: string | number | boolean | null
}

/** An earlier turn: its comments and the answer they got. */
export interface HistoryTurn {
  comments: AnnotationNote[]
  answer: HistoryStep[]
}

/**
 * What the layer sends: the comments of the current turn, to be answered,
 * and the earlier turns, oldest first, for context only.
 */
export interface AgentRequest {
  requestId: string
  annotations: AnnotationNote[]
  history: HistoryTurn[]
}
