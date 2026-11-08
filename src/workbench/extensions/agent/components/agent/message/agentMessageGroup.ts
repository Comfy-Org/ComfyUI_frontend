import type {
  ActivityPart,
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
  TextPart
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

type TextGroup = Extract<AgentMessageGroup, { kind: 'text' }>
type InterruptingPart = Exclude<MessagePart, TextPart | ActivityPart>

interface GroupMessagePartsOptions {
  foldRuns?: boolean
  streaming?: boolean
}

export function groupMessageParts(
  parts: readonly MessagePart[],
  { foldRuns = false, streaming = false }: GroupMessagePartsOptions = {}
): AgentMessageGroup[] {
  const slots = foldRuns ? runSlotsOf({ parts, streaming }) : []
  const runSlots = new Map(slots.map((slot) => [slot.callId, slot]))
  const ownedByRun = foldRuns ? runOwnedCallIds(parts) : new Set<string>()
  const out: AgentMessageGroup[] = []
  let tracePlaced = false
  let openTextGroup: TextGroup | null = null
  for (const part of parts) {
    if (part.type === 'tool' && ownedByRun.has(part.callId)) {
      const slot = runSlots.get(part.callId)
      if (!slot) continue
      openTextGroup = null
      out.push({ kind: 'run', slot })
      continue
    }
    if (part.type === 'tool' || part.type === 'thinking') {
      if (tracePlaced) continue
      tracePlaced = true
      out.push({ kind: 'trace' })
      continue
    }
    if (part.type === 'text') {
      openTextGroup = appendText(out, openTextGroup, part)
      continue
    }
    openTextGroup = null
    pushInterruptingGroup(out, part)
  }
  return out
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
