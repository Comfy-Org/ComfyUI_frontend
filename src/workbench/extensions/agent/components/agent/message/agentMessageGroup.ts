import type {
  ActivityPart,
  AskPart,
  AskUnavailablePart,
  AskUserPart,
  DeleteApprovalPart,
  ExtensionChangePart,
  MessagePart,
  NoticePart,
  PausedPart,
  PaywallPart,
  RunApprovalPart,
  TabLinkPart,
  TextPart,
  ToolPart
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import type { RunSlot } from '@/workbench/extensions/agent/services/agent/agentRunSlots'
import {
  runOwnedCallIds,
  runSlotsOf
} from '@/workbench/extensions/agent/services/agent/agentRunSlots'

export type AgentMessageGroup =
  | { kind: 'text'; parts: TextPart[] }
  | { kind: 'notice'; part: NoticePart | AskUnavailablePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'trace' }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'extensionChange'; part: ExtensionChangePart }
  | { kind: 'runApproval'; part: RunApprovalPart }
  | { kind: 'askUser'; part: AskUserPart }
  | { kind: 'deleteApproval'; part: DeleteApprovalPart }
  | { kind: 'paused'; part: PausedPart }
  | { kind: 'run'; slot: RunSlot }

export type AskGroup = Extract<AgentMessageGroup, { part: AskPart }>

const ASK_GROUP_KINDS: ReadonlySet<AgentMessageGroup['kind']> = new Set([
  'runApproval',
  'askUser',
  'deleteApproval',
  'paused'
])

export function isAskGroup(group: AgentMessageGroup): group is AskGroup {
  return ASK_GROUP_KINDS.has(group.kind)
}

type TextGroup = Extract<AgentMessageGroup, { kind: 'text' }>
type InterruptingPart = Exclude<MessagePart, TextPart | ActivityPart>

interface GroupMessagePartsOptions {
  foldRuns?: boolean
  streaming?: boolean
}

interface RunFolding {
  slots: ReadonlyMap<string, RunSlot>
  owned: ReadonlySet<string>
}

interface Grouping {
  out: AgentMessageGroup[]
  openTextGroup: TextGroup | null
}

const NO_RUN_FOLDING: RunFolding = { slots: new Map(), owned: new Set() }

export function groupMessageParts(
  parts: readonly MessagePart[],
  { foldRuns = false, streaming = false }: GroupMessagePartsOptions = {}
): AgentMessageGroup[] {
  const runs = foldRuns ? runFoldingOf(parts, streaming) : NO_RUN_FOLDING
  const grouping: Grouping = { out: [], openTextGroup: null }
  for (const part of parts) placePart(grouping, part, runs)
  return grouping.out
}

function runFoldingOf(
  parts: readonly MessagePart[],
  streaming: boolean
): RunFolding {
  const slots = runSlotsOf({ parts, streaming })
  return {
    slots: new Map(slots.map((slot) => [slot.callId, slot])),
    owned: runOwnedCallIds(parts)
  }
}

function placePart(
  grouping: Grouping,
  part: MessagePart,
  runs: RunFolding
): void {
  switch (part.type) {
    case 'tool':
      placeTool(grouping, part, runs)
      return
    case 'thinking':
      placeTrace(grouping.out)
      return
    case 'text':
      grouping.openTextGroup = appendText(
        grouping.out,
        grouping.openTextGroup,
        part
      )
      return
    default:
      grouping.openTextGroup = null
      pushInterruptingGroup(grouping.out, part)
  }
}

function placeTool(grouping: Grouping, part: ToolPart, runs: RunFolding): void {
  if (!runs.owned.has(part.callId)) {
    placeTrace(grouping.out)
    return
  }
  const slot = runs.slots.get(part.callId)
  if (!slot) return
  grouping.openTextGroup = null
  grouping.out.push({ kind: 'run', slot })
}

function placeTrace(out: AgentMessageGroup[]): void {
  if (out.some(({ kind }) => kind === 'trace')) return
  out.push({ kind: 'trace' })
}

function appendText(
  out: AgentMessageGroup[],
  openTextGroup: TextGroup | null,
  part: TextPart
): TextGroup {
  if (openTextGroup) {
    openTextGroup.parts.push(part)
    return openTextGroup
  }
  const group: TextGroup = { kind: 'text', parts: [part] }
  out.push(group)
  return group
}

function pushInterruptingGroup(
  out: AgentMessageGroup[],
  part: InterruptingPart
): void {
  if (part.type !== 'tabLink') {
    out.push(cardGroup(part))
    return
  }
  const prev = out.at(-1)
  if (prev?.kind === 'tabLinks') prev.parts.push(part)
  else out.push({ kind: 'tabLinks', parts: [part] })
}

function cardGroup(
  part: Exclude<InterruptingPart, TabLinkPart>
): AgentMessageGroup {
  switch (part.type) {
    case 'runApproval':
      return { kind: 'runApproval', part }
    case 'askUser':
      return { kind: 'askUser', part }
    case 'deleteApproval':
      return { kind: 'deleteApproval', part }
    case 'paused':
      return { kind: 'paused', part }
    case 'paywall':
      return { kind: 'paywall', part }
    case 'extensionChange':
      return { kind: 'extensionChange', part }
    case 'notice':
    case 'askUnavailable':
      return { kind: 'notice', part }
  }
}
