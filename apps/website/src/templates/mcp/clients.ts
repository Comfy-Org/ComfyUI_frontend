const MCP_CONNECTION_IDS = ['cloud', 'local'] as const

export type ConnectionId = (typeof MCP_CONNECTION_IDS)[number]

const CLOUD_CLIENT_IDS = [
  'claude-desktop',
  'claude-code',
  'codex',
  'cursor',
  'openclaw',
  'other'
] as const

const LOCAL_CLIENT_IDS = [
  'local-claude-code',
  'local-claude-desktop',
  'local-cursor',
  'local-other'
] as const

type CloudClientId = (typeof CLOUD_CLIENT_IDS)[number]
type LocalClientId = (typeof LOCAL_CLIENT_IDS)[number]
export type McpClientId = CloudClientId | LocalClientId

const CONNECTION_ID_SET: ReadonlySet<string> = new Set(MCP_CONNECTION_IDS)
const CLIENT_ID_SET: ReadonlySet<string> = new Set<string>([
  ...CLOUD_CLIENT_IDS,
  ...LOCAL_CLIENT_IDS
])

export function isConnectionId(value: unknown): value is ConnectionId {
  return typeof value === 'string' && CONNECTION_ID_SET.has(value)
}

export function isMcpClientId(value: unknown): value is McpClientId {
  return typeof value === 'string' && CLIENT_ID_SET.has(value)
}
