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
import { askIdOf } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

export type AgentMessageGroup =
  | { kind: 'text'; parts: TextPart[] }
  | { kind: 'notice'; part: NoticePart | AskUnavailablePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'trace'; parts: ActivityPart[] }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'extensionChange'; part: ExtensionChangePart }
  | { kind: 'runApproval'; part: RunApprovalPart }
  | { kind: 'askUser'; part: AskUserPart }
  | { kind: 'deleteApproval'; part: DeleteApprovalPart }
  | { kind: 'paused'; part: PausedPart }

type TextGroup = Extract<AgentMessageGroup, { kind: 'text' }>
type TraceGroup = Extract<AgentMessageGroup, { kind: 'trace' }>
type InterruptingPart = Exclude<MessagePart, TextPart | ActivityPart>

/**
 * Tool and thinking parts gather into one trace across text; any ask card
 * (a part with an `askId`) closes it, so later steps start a new trace below.
 */
export function groupMessageParts(
  parts: readonly MessagePart[]
): AgentMessageGroup[] {
  const out: AgentMessageGroup[] = []
  let openTrace: TraceGroup | null = null
  let openTextGroup: TextGroup | null = null
  for (const part of parts) {
    if (part.type === 'tool' || part.type === 'thinking') {
      if (openTrace) {
        openTrace.parts.push(part)
        continue
      }
      openTrace = { kind: 'trace', parts: [part] }
      out.push(openTrace)
      continue
    }
    if (part.type === 'text') {
      openTextGroup = appendText(out, openTextGroup, part)
      continue
    }
    openTextGroup = null
    if (askIdOf(part) !== undefined) openTrace = null
    pushInterruptingGroup(out, part)
  }
  return out
}

/**
 * A stable render key per group: an ask card keys on its `askId`, any other
 * group on its kind and how many groups of that kind come before it.
 */
export function groupKeys(groups: readonly AgentMessageGroup[]): string[] {
  const seen = new Map<AgentMessageGroup['kind'], number>()
  return groups.map((group) => {
    const askId = 'part' in group ? askIdOf(group.part) : undefined
    if (askId !== undefined) return `ask:${askId}`
    const ordinal = seen.get(group.kind) ?? 0
    seen.set(group.kind, ordinal + 1)
    return `${group.kind}:${ordinal}`
  })
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
