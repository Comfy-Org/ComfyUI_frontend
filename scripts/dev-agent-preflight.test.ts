// @vitest-environment node
import { access } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

import { parseOptions } from './dev-agent-options'
import { preflightAgent } from './dev-agent-preflight'

vi.mock('node:fs/promises', () => ({ access: vi.fn() }))

describe('preflightAgent', () => {
  it('resolves one runtime contract for both launch modes', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const options = parseOptions([
      '--cloud-repo',
      '/tmp/cloud',
      '--comfy-url',
      'http://127.0.0.1:8188/'
    ])

    await expect(
      preflightAgent(options, ['start.sh', 'dochost/start.sh'], {
        ANTHROPIC_API_KEY: 'test-key'
      })
    ).resolves.toEqual({
      agentDir: '/tmp/cloud/services/agent',
      agentUrl: 'http://127.0.0.1:6286'
    })
    expect(access).toHaveBeenCalledWith('/tmp/cloud/services/agent/start.sh')
    expect(access).toHaveBeenCalledWith(
      '/tmp/cloud/services/agent/dochost/start.sh'
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8188/system_stats',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('rejects a launch without model credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 200 }))
    )
    const options = parseOptions([])

    await expect(preflightAgent(options, [], {})).rejects.toThrow(
      'Set ANTHROPIC_API_KEY or ANTHROPIC_BASE_URL'
    )
  })
})
