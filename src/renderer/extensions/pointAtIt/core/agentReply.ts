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
    .union([nodeAddress, settingAddress, runControl])
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

/** One pinned comment as the agent receives it. */
export interface AnnotationNote {
  id: string
  label: string
  comment: string
  targets: Exclude<ReplyAddress, { kind: 'control' }>[]
}

/** What the layer sends: every comment of the batch in one request. */
export interface AgentRequest {
  requestId: string
  annotations: AnnotationNote[]
}
