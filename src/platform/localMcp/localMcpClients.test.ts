import { describe, expect, it } from 'vitest'

import {
  getLocalMcpAddress,
  getLocalMcpClients,
  LOCAL_MCP_DOCS_URL,
  LOCAL_MCP_INSTALL_COMMAND
} from '@/platform/localMcp/localMcpClients'

describe('localMcpClients', () => {
  it('offers the three clients documented by comfy-mcp', () => {
    expect(getLocalMcpClients().map((c) => c.id)).toEqual([
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

  it.for(['claude_desktop', 'cursor'])(
    'registers the comfy-mcp stdio command in the %s JSON config',
    (id) => {
      const client = getLocalMcpClients().find((c) => c.id === id)!
      expect(JSON.parse(client.config)).toEqual({
        mcpServers: { 'comfy-mcp': { command: 'comfy-mcp' } }
      })
    }
  )

  it('uses the one-line claude CLI form for Claude Code', () => {
    const claudeCode = getLocalMcpClients().find((c) => c.id === 'claude_code')
    expect(claudeCode?.config).toBe('claude mcp add comfy-mcp -- comfy-mcp')
  })

  describe('non-default ComfyUI address', () => {
    const address = 'http://127.0.0.1:8189'

    it.for(['claude_desktop', 'cursor'])(
      'sets COMFY_LOCAL_URL in the %s JSON config',
      (id) => {
        const client = getLocalMcpClients(address).find((c) => c.id === id)!
        expect(JSON.parse(client.config)).toEqual({
          mcpServers: {
            'comfy-mcp': {
              command: 'comfy-mcp',
              env: { COMFY_LOCAL_URL: address }
            }
          }
        })
      }
    )

    it('passes COMFY_LOCAL_URL to claude mcp add', () => {
      const claudeCode = getLocalMcpClients(address).find(
        (c) => c.id === 'claude_code'
      )
      expect(claudeCode?.config).toBe(
        `claude mcp add comfy-mcp -e 'COMFY_LOCAL_URL=${address}' -- comfy-mcp`
      )
    })

    it('quotes an IPv6 address so the shell does not glob the brackets', () => {
      const claudeCode = getLocalMcpClients('http://[::1]:8189').find(
        (c) => c.id === 'claude_code'
      )
      expect(claudeCode?.config).toBe(
        "claude mcp add comfy-mcp -e 'COMFY_LOCAL_URL=http://[::1]:8189' -- comfy-mcp"
      )
    })

    it.for<{
      location: Pick<Location, 'protocol' | 'host'>
      expected: string | undefined
    }>([
      {
        location: { protocol: 'http:', host: '127.0.0.1:8189' },
        expected: address
      },
      {
        location: { protocol: 'http:', host: '127.0.0.1:8188' },
        expected: undefined
      },
      {
        location: { protocol: 'http:', host: 'localhost:8188' },
        expected: undefined
      },
      {
        location: { protocol: 'http:', host: '[::1]:8189' },
        expected: 'http://[::1]:8189'
      },
      {
        location: { protocol: 'https:', host: 'box.example' },
        expected: undefined
      }
    ])('derives the address from $location.host', ({ location, expected }) => {
      expect(getLocalMcpAddress(location)).toBe(expected)
    })
  })
})
