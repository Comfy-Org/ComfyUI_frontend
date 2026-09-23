import type {
  ActivityPart,
  MessagePart,
  NoticePart,
  PaywallPart,
  RunApprovalPart,
  TabLinkPart,
  TextPart
} from '../../../services/agent/agentMessageParts'

export type AgentMessageGroup =
  | { kind: 'text'; parts: TextPart[] }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'trace' }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'runApproval'; part: RunApprovalPart }

type TextGroup = Extract<AgentMessageGroup, { kind: 'text' }>
type InterruptingPart = Exclude<MessagePart, TextPart | ActivityPart>

/**
 * Consecutive text parts separated only by tool calls or thinking steps
 * collapse into one text group so their assets render in a single grid.
 * Every activity part folds into one trace group placed where the first one
 * occurs; anything user-facing (tab link, run approval, paywall, notice)
 * closes the open text group.
 */
export function groupMessageParts(
  parts: readonly MessagePart[],
  hasActivity: boolean
): AgentMessageGroup[] {
  const out: AgentMessageGroup[] = []
  let tracePlaced = !hasActivity
  let openTextGroup: TextGroup | null = null
  for (const part of parts) {
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
  switch (part.type) {
    case 'tabLink': {
      const prev = out.at(-1)
      if (prev?.kind === 'tabLinks') prev.parts.push(part)
      else out.push({ kind: 'tabLinks', parts: [part] })
      return
    }
    case 'runApproval':
      out.push({ kind: 'runApproval', part })
      return
    case 'paywall':
      out.push({ kind: 'paywall', part })
      return
    case 'notice':
      out.push({ kind: 'notice', part })
      return
  }
}
