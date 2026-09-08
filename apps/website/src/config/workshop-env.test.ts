import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
})

describe('Workshop backend environment', () => {
  it('defaults to staging when no environment is configured', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', '')

    const {
      WORKSHOP_CLOUD_BASE_URL,
      WORKSHOP_FIREBASE_OPTIONS,
      WORKSHOP_ROUTER_BASE_URL
    } = await import('./workshop-env')

    expect(WORKSHOP_ROUTER_BASE_URL).toBe('https://stagingapi.comfy.org')
    expect(WORKSHOP_CLOUD_BASE_URL).toBe('https://stagingcloud.comfy.org')
    expect(WORKSHOP_FIREBASE_OPTIONS.projectId).toBe('dreamboothy-dev')
  })

  it('uses production only when explicitly requested', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', 'prod')

    const {
      WORKSHOP_CLOUD_BASE_URL,
      WORKSHOP_FIREBASE_OPTIONS,
      WORKSHOP_ROUTER_BASE_URL
    } = await import('./workshop-env')

    expect(WORKSHOP_ROUTER_BASE_URL).toBe('https://api.comfy.org')
    expect(WORKSHOP_CLOUD_BASE_URL).toBe('https://cloud.comfy.org')
    expect(WORKSHOP_FIREBASE_OPTIONS.projectId).toBe('dreamboothy')
  })
})
