import type { LocalMcpClient } from '@comfyorg/telemetry/types'

/**
 * Real connect instructions for Comfy MCP, the stdio MCP server in
 * https://github.com/Comfy-Org/comfy-mcp (README, "Configure your AI client").
 * Nothing here is a Comfy endpoint: the client launches `comfy-mcp` as a local
 * subprocess, which drives the ComfyUI on this machine through comfy-cli.
 */
export const LOCAL_MCP_DOCS_URL =
  'https://github.com/Comfy-Org/comfy-mcp#configure-your-ai-client'

export const LOCAL_MCP_INSTALL_COMMAND =
  'pip install comfy-mcp "comfy-cli>=1.14.0"'

const MCP_SERVERS_JSON = JSON.stringify(
  { mcpServers: { 'comfy-mcp': { command: 'comfy-mcp' } } },
  null,
  2
)

interface LocalMcpClientConfig {
  readonly id: LocalMcpClient
  readonly labelKey: string
  readonly configFormat: 'shell' | 'json'
  readonly config: string
  /** i18n key for where the config goes; absent when the command does it. */
  readonly locationKey?: string
}

export const LOCAL_MCP_CLIENTS: readonly LocalMcpClientConfig[] = [
  {
    id: 'claude_code',
    labelKey: 'localMcp.clients.claudeCode',
    configFormat: 'shell',
    config: 'claude mcp add comfy-mcp -- comfy-mcp'
  },
  {
    id: 'claude_desktop',
    labelKey: 'localMcp.clients.claudeDesktop',
    configFormat: 'json',
    config: MCP_SERVERS_JSON,
    locationKey: 'localMcp.locations.claudeDesktop'
  },
  {
    id: 'cursor',
    labelKey: 'localMcp.clients.cursor',
    configFormat: 'json',
    config: MCP_SERVERS_JSON,
    locationKey: 'localMcp.locations.cursor'
  }
]
