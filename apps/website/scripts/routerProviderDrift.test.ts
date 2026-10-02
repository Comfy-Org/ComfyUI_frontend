import { describe, expect, it, vi } from 'vitest'

import {
  alternateProviders,
  fetchText,
  parseCoverageTable
} from './routerProviderDrift'

describe('fetchText', () => {
  it('recovers when a source fails once and then responds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('providers'))
    const sleep = vi.fn(async () => {})

    await expect(
      fetchText('https://example.com', { fetchImpl, sleep })
    ).resolves.toBe('providers')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledOnce()
  })

  it('reports an unavailable source after every attempt', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'))

    await expect(
      fetchText('https://example.com', {
        fetchImpl,
        sleep: async () => {}
      })
    ).rejects.toThrow('Could not fetch https://example.com')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

it('reads alternate providers from a published model schema', () => {
  expect(
    alternateProviders(
      JSON.stringify({
        'x-comfy-router-alt-providers': [
          { provider: 'fal' },
          { provider: 'runware' }
        ]
      })
    )
  ).toEqual(['fal', 'runware'])
})

it('reads the provider coverage table from Markdown', () => {
  const markdown = `
## Provider coverage
| **Model / provider** | **Comfy (default)** | **fal** |
| --- | --- | --- |
| [Model](/models/model/code) | ✓ | ✓ |
`

  expect(parseCoverageTable(markdown)).toEqual({
    providers: ['fal'],
    rows: [
      {
        name: 'Model',
        docsUrl: 'https://docs.comfy.org/models/model/code',
        comfy: '✓'
      }
    ]
  })
})
