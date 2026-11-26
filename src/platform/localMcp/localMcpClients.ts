import type { LocalMcpClient } from '@comfyorg/telemetry/types'

export const LOCAL_MCP_DOCS_URL =
  'https://github.com/Comfy-Org/comfy-mcp#configure-your-ai-client'

export const LOCAL_MCP_INSTALL_COMMAND =
  'pip install comfy-mcp "comfy-cli>=1.14.0"'

const DEFAULT_ADDRESS_HOSTS = new Set(['127.0.0.1:8188', 'localhost:8188'])

/** `COMFY_LOCAL_URL` value for a ComfyUI off comfy-cli's default address. */
export function getLocalMcpAddress(
  location: Pick<Location, 'protocol' | 'host'>
): string | undefined {
  if (location.protocol !== 'http:') return undefined
  if (DEFAULT_ADDRESS_HOSTS.has(location.host)) return undefined
  return `http://${location.host}`
}

interface LocalMcpClientConfig {
  readonly id: LocalMcpClient
  readonly labelKey: string
  readonly configFormat: 'shell' | 'json'
  readonly config: string
  readonly locationKey?: string
}

/** Per-client setup snippets, pointed at `address` when it is not the default. */
export function getLocalMcpClients(
  address?: string
): readonly LocalMcpClientConfig[] {
  const server = {
    command: 'comfy-mcp',
    ...(address && { env: { COMFY_LOCAL_URL: address } })
  }
  const json = JSON.stringify({ mcpServers: { 'comfy-mcp': server } }, null, 2)
  const envFlag = address ? ` -e 'COMFY_LOCAL_URL=${address}'` : ''
  return [
    {
      id: 'claude_code',
      labelKey: 'localMcp.clients.claudeCode',
      configFormat: 'shell',
      config: `claude mcp add comfy-mcp${envFlag} -- comfy-mcp`
    },
    {
      id: 'claude_desktop',
      labelKey: 'localMcp.clients.claudeDesktop',
      configFormat: 'json',
      config: json,
      locationKey: 'localMcp.locations.claudeDesktop'
    },
    {
      id: 'cursor',
      labelKey: 'localMcp.clients.cursor',
      configFormat: 'json',
      config: json,
      locationKey: 'localMcp.locations.cursor'
    }
  ]
}
