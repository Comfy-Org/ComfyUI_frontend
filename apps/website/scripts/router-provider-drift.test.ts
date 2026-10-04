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

describe('checkRouterProviderDrift', () => {
  const coverageRows = ROUTER_PROVIDER_COVERAGE.map(
    ({ docsName, docsUrl, name }) =>
      `| [${docsName ?? name}](${new URL(docsUrl).pathname}) | ✓ |`
  ).join('\n')
  const coverage = `
## Provider coverage
| **Model / provider** | **Comfy (default)** | ${ROUTER_SERVING_PROVIDERS.map(({ name }) => `**${name}**`).join(' | ')} |
| --- | --- | --- |
${coverageRows}
`
  const catalog = ROUTER_COMFY_ONLY_PREVIEW.map(
    ({ docsUrl, name }) => `[${name}](${new URL(docsUrl).pathname})`
  ).join('\n')
  const [driftedRow] = ROUTER_PROVIDER_COVERAGE
  const [driftedProvider] = ROUTER_SERVING_PROVIDERS
  const [previewRow] = ROUTER_COMFY_ONLY_PREVIEW

  function createFetch({
    coverageMarkdown = coverage,
    catalogMarkdown = catalog,
    providerOverrides = {}
  }: {
    coverageMarkdown?: string
    catalogMarkdown?: string
    providerOverrides?: Readonly<Record<string, readonly string[]>>
  } = {}) {
    return vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/providers.md')) {
        return new Response(coverageMarkdown)
      }
      if (url.endsWith('/models.md')) return new Response(catalogMarkdown)
      const row = ROUTER_PROVIDER_COVERAGE.find(({ modelId }) =>
        url.endsWith(`/${modelId}.json`)
      )
      const providers = row
        ? (providerOverrides[row.modelId] ?? row.providers)
        : []
      return new Response(
        JSON.stringify({
          'x-comfy-router-alt-providers': providers.map((provider) => ({
            provider
          }))
        })
      )
    })
  }

  it('accepts matching published sources', async () => {
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch(),
        sleep: async () => {}
      })
    ).resolves.toBeUndefined()
  })

  it('detects serving-provider header drift', async () => {
    const coverageMarkdown = coverage.replace(
      `**${driftedProvider.name}**`,
      `**${driftedProvider.name}-drift**`
    )
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch({ coverageMarkdown }),
        sleep: async () => {}
      })
    ).rejects.toThrow(`${driftedProvider.name}-drift`)
  })

  it('detects alternate-provider drift', async () => {
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch({
          providerOverrides: {
            [driftedRow.modelId]: [...driftedRow.providers, 'drift-provider']
          }
        }),
        sleep: async () => {}
      })
    ).rejects.toThrow(/drift-provider/)
  })

  it('detects provider documentation row drift', async () => {
    const coverageMarkdown = coverage.replace(
      new URL(driftedRow.docsUrl).pathname,
      `${new URL(driftedRow.docsUrl).pathname}-drift`
    )
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch({ coverageMarkdown }),
        sleep: async () => {}
      })
    ).rejects.toThrow(/-drift/)
  })

  it('detects a provider row not served by Comfy', async () => {
    const coverageMarkdown = coverage.replace(
      `| [${driftedRow.docsName ?? driftedRow.name}](${new URL(driftedRow.docsUrl).pathname}) | ✓ |`,
      `| [${driftedRow.docsName ?? driftedRow.name}](${new URL(driftedRow.docsUrl).pathname}) | - |`
    )
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch({ coverageMarkdown }),
        sleep: async () => {}
      })
    ).rejects.toThrow('every provider coverage row must be served by Comfy')
  })

  it('detects a missing catalog link', async () => {
    const catalogMarkdown = catalog.replace(`[${previewRow.name}]`, '[Drift]')
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch({ catalogMarkdown }),
        sleep: async () => {}
      })
    ).rejects.toThrow(previewRow.name)
  })

  it('detects a preview path in provider coverage', async () => {
    const previewPath = new URL(previewRow.docsUrl).pathname
    await expect(
      checkRouterProviderDrift({
        fetchImpl: createFetch({
          coverageMarkdown: `${previewPath}\n${coverage}`
        }),
        sleep: async () => {}
      })
    ).rejects.toThrow(previewPath)
  })
})
