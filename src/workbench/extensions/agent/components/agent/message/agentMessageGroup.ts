import type {
  NoticePart,
  PaywallPart,
  PermissionAskPart,
  RunApprovalPart,
  TabLinkPart,
  TextPart
} from '../../../services/agent/agentMessageParts'

export type AgentMessageGroup =
  | { kind: 'text'; part: TextPart }
  | { kind: 'notice'; part: NoticePart }
  | { kind: 'paywall'; part: PaywallPart }
  | { kind: 'trace' }
  | { kind: 'tabLinks'; parts: TabLinkPart[] }
  | { kind: 'runApproval'; part: RunApprovalPart }
  | { kind: 'permissionAsk'; part: PermissionAskPart }
