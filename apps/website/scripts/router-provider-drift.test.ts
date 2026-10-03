import { describe, expect, it, vi } from 'vitest'

import {
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_SERVING_PROVIDERS
} from '../src/config/router-providers'
import {
  alternateProviders,
  checkRouterProviderDrift,
  fetchText,
  parseCoverageTable
} from './router-provider-drift'

const DOCS_ORIGIN = 'https://docs.comfy.org'

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

  it('reports an HTTP error as an unavailable source', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('maintenance', { status: 503 }))

    await expect(
      fetchText('https://example.com', {
        fetchImpl,
        sleep: async () => {}
      })
    ).rejects.toThrow('Could not fetch https://example.com')
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

it('detects drift with controlled published-source fixtures', async () => {
  const coverageRows = ROUTER_PROVIDER_COVERAGE.map(
    ({ docsName, docsUrl, name }) =>
      `| [${docsName ?? name}](${docsUrl.slice(DOCS_ORIGIN.length)}) | ✓ |`
  ).join('\n')
  const coverage = `
## Provider coverage
| **Model / provider** | **Comfy (default)** | ${ROUTER_SERVING_PROVIDERS.map(({ name }) => `**${name}**`).join(' | ')} |
| --- | --- | --- |
${coverageRows}
`
  const catalog = ROUTER_COMFY_ONLY_PREVIEW.map(
    ({ docsUrl, name }) => `[${name}](${docsUrl.slice(DOCS_ORIGIN.length)})`
  ).join('\n')
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.endsWith('/providers.md')) return new Response(coverage)
    if (url.endsWith('/models.md')) return new Response(catalog)
    const row = ROUTER_PROVIDER_COVERAGE.find(({ modelId }) =>
      url.endsWith(`/${modelId}.json`)
    )
    return new Response(
      JSON.stringify({
        'x-comfy-router-alt-providers': (row?.providers ?? []).map(
          (provider) => ({ provider })
        )
      })
    )
  })

  await expect(
    checkRouterProviderDrift({ fetchImpl, sleep: async () => {} })
  ).resolves.toBeUndefined()

  fetchImpl.mockImplementationOnce(async () =>
    Promise.resolve(new Response(coverage.replace('Model / provider', 'Drift')))
  )
  await expect(
    checkRouterProviderDrift({ fetchImpl, sleep: async () => {} })
  ).rejects.toThrow()
})
