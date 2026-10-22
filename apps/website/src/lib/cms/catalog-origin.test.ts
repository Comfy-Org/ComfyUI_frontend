import { describe, expect, it, vi } from 'vitest'

async function load(env: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const { catalogApiOrigin } = await import('./catalog-origin')
  const { cmsEnabled } = await import('./cms-enabled')
  return { origin: catalogApiOrigin(), enabled: cmsEnabled() }
}

describe('catalogApiOrigin', () => {
  it.for([
    ['staging', 'https://stagingcloud.comfy.org'],
    ['test', 'https://testcloud.comfy.org']
  ])(
    'a deployed preview built for %s uses that Cloud base URL',
    async ([family, base]) => {
      const { origin, enabled } = await load({
        VERCEL_ENV: 'preview',
        PUBLIC_WORKSHOP_CLOUD_ENV: family,
        SITE_CATALOG_API_URL: ''
      })
      expect(origin).toBe(base)
      expect(enabled).toBe(true)
    }
  )

  it('production keeps the static Hub, even with the override set', async () => {
    const { origin, enabled } = await load({
      VERCEL_ENV: 'production',
      PUBLIC_WORKSHOP_CLOUD_ENV: 'prod',
      SITE_CATALOG_API_URL: 'https://cloud.comfy.org'
    })
    expect(origin).toBeUndefined()
    expect(enabled).toBe(false)
  })

  it('local development keeps the static Hub without the override', async () => {
    const { origin, enabled } = await load({
      VERCEL_ENV: '',
      SITE_CATALOG_API_URL: ''
    })
    expect(origin).toBeUndefined()
    expect(enabled).toBe(false)
  })

  it('SITE_CATALOG_API_URL overrides the base URL (local demo, tests)', async () => {
    const { origin } = await load({
      VERCEL_ENV: '',
      SITE_CATALOG_API_URL: 'http://127.0.0.1:8109'
    })
    expect(origin).toBe('http://127.0.0.1:8109')
  })
})
