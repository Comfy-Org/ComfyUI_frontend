import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { externalLinks } from './routes'

export interface McpClient {
  name: string
  step: string
  command?: string
  link?: { label: string; href: string }
  manualTitle?: string
  showAgentCard: boolean
  video?: string
}

const LOCAL_CONFIG_SNIPPET =
  '{ "mcpServers": { "comfy-mcp": { "command": "comfy-mcp" } } }'

function createCloudClients(locale: Locale) {
  const { t } = translationsFor(locale)
  return {
    'claude-desktop': {
      name: 'Claude Desktop',
      step: t('mcp.setup.clients.claudeDesktop.step'),
      manualTitle: t('mcp.setup.clients.claudeDesktop.manualTitle'),
      showAgentCard: false,
      video: 'https://media.comfy.org/website/mcp/setup-claude-desktop-v2.mp4'
    },
    'claude-code': {
      name: 'Claude Code Terminal',
      step: t('mcp.setup.clients.claudeCode.step'),
      command: `claude mcp add --transport http comfy-cloud ${externalLinks.mcpEndpoint}`,
      showAgentCard: true
    },
    codex: {
      name: 'Codex',
      step: t('mcp.setup.clients.codex.step'),
      command: `codex mcp add comfy-cloud --url ${externalLinks.mcpEndpoint}`,
      showAgentCard: false,
      video: 'https://media.comfy.org/website/mcp/setup-codex-oauth-v2.mp4'
    },
    cursor: {
      name: 'Cursor',
      step: t('mcp.setup.clients.cursor.step'),
      link: {
        label: t('mcp.setup.clients.cursor.linkLabel'),
        href: externalLinks.apiKeys
      },
      showAgentCard: true
    },
    openclaw: {
      name: 'OpenClaw',
      step: t('mcp.setup.clients.openclaw.step'),
      command: `openclaw skills install @comfy-org/comfy\nopenclaw mcp set comfy '{"url":"${externalLinks.mcpEndpoint}","transport":"streamable-http","auth":"oauth"}'\nopenclaw mcp login comfy`,
      showAgentCard: true
    },
    other: {
      name: t('mcp.setup.clients.other.name'),
      step: t('mcp.setup.clients.other.step'),
      link: {
        label: t('mcp.setup.clients.other.linkLabel'),
        href: externalLinks.docsMcp
      },
      showAgentCard: true
    }
  } satisfies Record<string, McpClient>
}

function createLocalClients(locale: Locale) {
  const { t } = translationsFor(locale)
  return {
    'local-claude-code': {
      name: 'Claude Code Terminal',
      step: t('mcp.setup.local.clients.claudeCode.step'),
      command: 'claude mcp add comfy-mcp -- comfy-mcp',
      showAgentCard: true
    },
    'local-claude-desktop': {
      name: 'Claude Desktop',
      step: t('mcp.setup.local.clients.claudeDesktop.step'),
      command: LOCAL_CONFIG_SNIPPET,
      showAgentCard: true
    },
    'local-cursor': {
      name: 'Cursor',
      step: t('mcp.setup.local.clients.cursor.step'),
      command: LOCAL_CONFIG_SNIPPET,
      showAgentCard: true
    },
    'local-other': {
      name: t('mcp.setup.clients.other.name'),
      step: t('mcp.setup.local.clients.other.step'),
      link: {
        label: t('mcp.setup.clients.other.linkLabel'),
        href: externalLinks.docsMcpLocal
      },
      showAgentCard: true
    }
  } satisfies Record<string, McpClient>
}

export function createMcpConnections(locale: Locale) {
  const { t } = translationsFor(locale)
  return {
    cloud: {
      name: t('mcp.setup.connections.cloud.name'),
      tagline: t('mcp.setup.connections.cloud.tagline'),
      copyValue: externalLinks.mcpEndpoint,
      manualTitle: t('mcp.setup.manual.title'),
      manualDescription: t('mcp.setup.manual.description'),
      agentCommand: t('mcp.setup.agent.command', {
        url: externalLinks.docsMcpMd
      }),
      agentRecommended: false,
      showSkillsNote: true,
      clients: createCloudClients(locale)
    },
    local: {
      name: t('mcp.setup.connections.local.name'),
      tagline: t('mcp.setup.connections.local.tagline'),
      copyValue: 'pip install comfy-mcp',
      manualTitle: t('mcp.setup.local.manual.title'),
      manualDescription: t('mcp.setup.local.manual.description'),
      agentCommand: t('mcp.setup.local.agent.command', {
        url: externalLinks.docsMcpLocalMd
      }),
      agentRecommended: true,
      showSkillsNote: false,
      clients: createLocalClients(locale)
    }
  }
}

type McpConnectionData = ReturnType<typeof createMcpConnections>
export type ConnectionId = keyof McpConnectionData
export type McpClientId =
  | keyof McpConnectionData['cloud']['clients']
  | keyof McpConnectionData['local']['clients']

type McpConnection = Omit<McpConnectionData[ConnectionId], 'clients'> & {
  clients: Record<string, McpClient>
}

export type McpConnections = Record<ConnectionId, McpConnection>

export function isConnectionId(
  value: unknown,
  connections: McpConnections
): value is ConnectionId {
  return typeof value === 'string' && Object.hasOwn(connections, value)
}

export function isMcpClientId(
  value: unknown,
  connections: McpConnections
): value is McpClientId {
  return (
    typeof value === 'string' &&
    Object.values(connections).some(({ clients }) =>
      Object.hasOwn(clients, value)
    )
  )
}
