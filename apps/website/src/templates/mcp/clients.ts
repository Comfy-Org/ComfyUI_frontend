import { externalLinks } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { t } from '@/i18n/translations'

export const MCP_CLIENT_IDS = [
  'claude-desktop',
  'claude-code',
  'codex',
  'cursor',
  'openclaw',
  'other'
] as const

export type McpClientId = (typeof MCP_CLIENT_IDS)[number]

const MCP_CLIENT_ID_SET: ReadonlySet<string> = new Set(MCP_CLIENT_IDS)

export function isMcpClientId(value: unknown): value is McpClientId {
  return typeof value === 'string' && MCP_CLIENT_ID_SET.has(value)
}

type McpClientPanel =
  | { kind: 'agent-card' }
  | { kind: 'walkthrough'; video: string }

export interface McpClient {
  id: McpClientId
  name: string
  step: string
  panel: McpClientPanel
  command?: string
  link?: { label: string; href: string }
  manualTitle?: string
}

export function createMcpClients(locale: Locale): McpClient[] {
  return [
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      step: t('mcp.setup.clients.claudeDesktop.step', locale),
      manualTitle: t('mcp.setup.clients.claudeDesktop.manualTitle', locale),
      panel: {
        kind: 'walkthrough',
        video: 'https://media.comfy.org/website/mcp/setup-claude-desktop-v2.mp4'
      }
    },
    {
      id: 'claude-code',
      name: 'Claude Code Terminal',
      step: t('mcp.setup.clients.claudeCode.step', locale),
      command: `claude mcp add --transport http comfy-cloud ${externalLinks.mcpEndpoint}`,
      panel: { kind: 'agent-card' }
    },
    {
      id: 'codex',
      name: 'Codex',
      step: t('mcp.setup.clients.codex.step', locale),
      command: `codex mcp add comfy-cloud --url ${externalLinks.mcpEndpoint}`,
      panel: {
        kind: 'walkthrough',
        video: 'https://media.comfy.org/website/mcp/setup-codex-oauth-v2.mp4'
      }
    },
    {
      id: 'cursor',
      name: 'Cursor',
      step: t('mcp.setup.clients.cursor.step', locale),
      link: {
        label: t('mcp.setup.clients.cursor.linkLabel', locale),
        href: externalLinks.apiKeys
      },
      panel: { kind: 'agent-card' }
    },
    {
      id: 'openclaw',
      name: 'OpenClaw',
      step: t('mcp.setup.clients.openclaw.step', locale),
      command: `openclaw skills install @comfy-org/comfy\nopenclaw mcp set comfy '{"url":"${externalLinks.mcpEndpoint}","transport":"streamable-http","auth":"oauth"}'`,
      panel: { kind: 'agent-card' }
    },
    {
      id: 'other',
      name: t('mcp.setup.clients.other.name', locale),
      step: t('mcp.setup.clients.other.step', locale),
      link: {
        label: t('mcp.setup.clients.other.linkLabel', locale),
        href: externalLinks.docsMcp
      },
      panel: { kind: 'agent-card' }
    }
  ]
}
