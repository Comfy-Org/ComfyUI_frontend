export const MCP_CONNECTION_IDS = ['cloud', 'local'] as const

export type ConnectionId = (typeof MCP_CONNECTION_IDS)[number]

const MCP_CONNECTION_ID_SET: ReadonlySet<string> = new Set(MCP_CONNECTION_IDS)

export function isConnectionId(value: unknown): value is ConnectionId {
  return typeof value === 'string' && MCP_CONNECTION_ID_SET.has(value)
}

export const CLOUD_CLIENT_IDS = [
  'claude-desktop',
  'claude-code',
  'codex',
  'cursor',
  'openclaw',
  'other'
] as const

export const LOCAL_CLIENT_IDS = [
  'local-claude-code',
  'local-claude-desktop',
  'local-cursor',
  'local-other'
] as const

export type McpClientId =
  | (typeof CLOUD_CLIENT_IDS)[number]
  | (typeof LOCAL_CLIENT_IDS)[number]

const MCP_CLIENT_ID_SET: ReadonlySet<string> = new Set([
  ...CLOUD_CLIENT_IDS,
  ...LOCAL_CLIENT_IDS
])

export function isMcpClientId(value: unknown): value is McpClientId {
  return typeof value === 'string' && MCP_CLIENT_ID_SET.has(value)
}
