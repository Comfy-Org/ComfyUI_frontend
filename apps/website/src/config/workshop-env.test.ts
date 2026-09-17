import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
})

async function loadWorkshopEnv(value: string | undefined) {
  vi.stubEnv('PUBLIC_WORKSHOP_CLOUD_ENV', value)
  return import('./workshop-env')
}

describe('Workshop backend environment', () => {
  it('defaults to staging when no environment is configured', async () => {
    const env = await loadWorkshopEnv('')

    expect(env.WORKSHOP_ROUTER_BASE_URL).toBe('https://stagingapi.comfy.org')
    expect(env.WORKSHOP_CLOUD_BASE_URL).toBe('https://stagingcloud.comfy.org')
    expect(env.WORKSHOP_FIREBASE_OPTIONS.projectId).toBe('dreamboothy-dev')
    expect(env.WORKSHOP_TURNSTILE_SITE_KEY).not.toBe('')
    expect(env.WORKSHOP_CREDITS_URL).toBe(
      'https://stagingcloud.comfy.org/?settings=plan-credits'
    )
  })

  it('uses production only when explicitly requested', async () => {
    const env = await loadWorkshopEnv('prod')

    expect(env.WORKSHOP_ROUTER_BASE_URL).toBe('https://api.comfy.org')
    expect(env.WORKSHOP_CLOUD_BASE_URL).toBe('https://cloud.comfy.org')
    expect(env.WORKSHOP_FIREBASE_OPTIONS.projectId).toBe('dreamboothy')
    expect(env.WORKSHOP_TURNSTILE_SITE_KEY).not.toBe('')
    expect(env.WORKSHOP_CREDITS_URL).toBe(
      'https://cloud.comfy.org/?settings=plan-credits'
    )
  })

  it('uses the test family when requested', async () => {
    const env = await loadWorkshopEnv('test')

    expect(env.WORKSHOP_ROUTER_BASE_URL).toBe('https://testapi.comfy.org')
    expect(env.WORKSHOP_CLOUD_BASE_URL).toBe('https://testcloud.comfy.org')
    // Test validates tokens from the same dev Firebase project as staging.
    expect(env.WORKSHOP_FIREBASE_OPTIONS.projectId).toBe('dreamboothy-dev')
    // testcloud has no Turnstile sitekey, so the widget stays off there.
    expect(env.WORKSHOP_TURNSTILE_SITE_KEY).toBe('')
    expect(env.WORKSHOP_CREDITS_URL).toBe(
      'https://testcloud.comfy.org/?settings=plan-credits'
    )
  })

  it('never lands on production for a value it does not recognise', async () => {
    const env = await loadWorkshopEnv('production')

    expect(env.WORKSHOP_CLOUD_BASE_URL).toBe('https://stagingcloud.comfy.org')
    expect(env.WORKSHOP_FIREBASE_OPTIONS.projectId).toBe('dreamboothy-dev')
  })
})
