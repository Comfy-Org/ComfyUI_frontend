import type {
  ActivityPart,
  AskPart,
  MessagePart,
  NoticePart,
  PaywallPart,
  TabLinkPart,
  TextPart
} from '../../../services/agent/agentMessageParts'
import { isAskPart } from '../../../services/agent/agentMessageParts'

export type AgentMessageGroup =
  | { kind: 'text'; part: TextPart }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'trace' }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'ask'; part: AskPart }

/** The group a part renders in on its own (everything but activity and tab links). */
export function toPartGroup(
  part: Exclude<MessagePart, ActivityPart | TabLinkPart>
): AgentMessageGroup {
  if (isAskPart(part)) return { kind: 'ask', part }
  switch (part.type) {
    case 'text':
      return { kind: 'text', part }
    case 'paywall':
      return { kind: 'paywall', part }
    case 'notice':
      return { kind: 'notice', part }
  }
}
