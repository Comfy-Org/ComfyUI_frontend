import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { nodeHelpService } from '@/services/nodeHelpService'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: vi.fn((path: string) => `/files${path}`)
  }
}))

describe('nodeHelpService', () => {
  const mockFetch = vi.fn<typeof fetch>()

  function nodeDef(options: {
    name?: string
    python_module?: string
    description?: string
  }): ComfyNodeDefImpl {
    return {
      name: options.name ?? 'TestNode',
      display_name: options.name ?? 'Test Node',
      category: 'test',
      python_module: options.python_module ?? 'nodes',
      description: options.description ?? ''
    } as ComfyNodeDefImpl
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('returns blueprint descriptions without fetching markdown', async () => {
    const help = await nodeHelpService.fetchNodeHelp(
      nodeDef({
        python_module: 'blueprint',
        description: 'Saved workflow help'
      }),
      'en'
    )

    expect(help).toBe('Saved workflow help')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches localized core node markdown', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Core help', {
        headers: { 'content-type': 'text/markdown' }
      })
    )

    const help = await nodeHelpService.fetchNodeHelp(
      nodeDef({ name: 'LoadImage' }),
      'zh'
    )

    expect(api.fileURL).toHaveBeenCalledWith('/docs/LoadImage/zh.md')
    expect(mockFetch).toHaveBeenCalledWith('/files/docs/LoadImage/zh.md')
    expect(help).toBe('Core help')
  })

  it('rejects core node HTML fallbacks', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('<html></html>', {
        headers: { 'content-type': 'text/html' },
        statusText: 'OK'
      })
    )

    await expect(
      nodeHelpService.fetchNodeHelp(nodeDef({ name: 'PreviewImage' }), 'en')
    ).rejects.toThrow('OK')
  })

  it('uses the default missing-help error for empty markdown responses', async () => {
    mockFetch.mockResolvedValueOnce(new Response(''))

    await expect(
      nodeHelpService.fetchNodeHelp(nodeDef({ name: 'EmptyHelp' }), 'en')
    ).rejects.toThrow('Help not found')
  })

  it('fetches custom node localized markdown before fallback markdown', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Custom localized help', {
        headers: { 'content-type': 'text/markdown' }
      })
    )

    const help = await nodeHelpService.fetchNodeHelp(
      nodeDef({
        name: 'CustomNode',
        python_module: 'custom_nodes.ComfyUI-TestPack@1.2.3.nodes'
      }),
      'ja'
    )

    expect(api.fileURL).toHaveBeenCalledWith(
      '/extensions/ComfyUI-TestPack/docs/CustomNode/ja.md'
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(help).toBe('Custom localized help')
  })

  it('falls back to custom node default markdown after locale miss', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response('Not found', {
          status: 404,
          statusText: 'Locale missing'
        })
      )
      .mockResolvedValueOnce(
        new Response('Custom fallback help', {
          headers: { 'content-type': 'text/markdown' }
        })
      )

    const help = await nodeHelpService.fetchNodeHelp(
      nodeDef({
        name: 'CustomNode',
        python_module: 'custom_nodes.TestPack.nodes'
      }),
      'fr'
    )

    expect(api.fileURL).toHaveBeenNthCalledWith(
      1,
      '/extensions/TestPack/docs/CustomNode/fr.md'
    )
    expect(api.fileURL).toHaveBeenNthCalledWith(
      2,
      '/extensions/TestPack/docs/CustomNode.md'
    )
    expect(help).toBe('Custom fallback help')
  })

  it('reports the locale miss when the custom fallback is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response('Not found', {
          status: 404,
          statusText: 'Locale missing'
        })
      )
      .mockResolvedValueOnce(new Response(''))

    await expect(
      nodeHelpService.fetchNodeHelp(
        nodeDef({
          name: 'CustomNode',
          python_module: 'custom_nodes.TestPack.nodes'
        }),
        'de'
      )
    ).rejects.toThrow('Locale missing')
  })
})
