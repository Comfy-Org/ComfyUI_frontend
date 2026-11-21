import { describe, expect, it } from 'vitest'

import {
  LOCAL_MCP_CLIENTS,
  LOCAL_MCP_DOCS_URL,
  LOCAL_MCP_INSTALL_COMMAND
} from '@/platform/localMcp/localMcpClients'

describe('localMcpClients', () => {
  it('offers the three clients documented by comfy-mcp', () => {
    expect(LOCAL_MCP_CLIENTS.map((c) => c.id)).toEqual([
      'claude_code',
      'claude_desktop',
      'cursor'
    ])
  })

  it('installs the server and the comfy-cli engine it wraps', () => {
    expect(LOCAL_MCP_INSTALL_COMMAND).toBe(
      'pip install comfy-mcp "comfy-cli>=1.14.0"'
    )
  })

  it('points the docs at the comfy-mcp repository', () => {
    expect(LOCAL_MCP_DOCS_URL).toMatch(
      /^https:\/\/github\.com\/Comfy-Org\/comfy-mcp/
    )
  })

  it('registers the comfy-mcp stdio command in every client config', () => {
    for (const client of LOCAL_MCP_CLIENTS) {
      expect(client.config).toContain('comfy-mcp')
      if (client.configFormat === 'json') {
        expect(JSON.parse(client.config)).toEqual({
          mcpServers: { 'comfy-mcp': { command: 'comfy-mcp' } }
        })
      }
    }
  })

  it('uses the one-line claude CLI form for Claude Code', () => {
    const claudeCode = LOCAL_MCP_CLIENTS.find((c) => c.id === 'claude_code')
    expect(claudeCode?.config).toBe('claude mcp add comfy-mcp -- comfy-mcp')
  })
})
