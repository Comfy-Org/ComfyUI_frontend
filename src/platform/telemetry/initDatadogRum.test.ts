import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  getInitConfiguration: vi.fn(),
  init: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: hoisted
}))

import { rumBeforeSend } from './datadogRumBeforeSend'
import { initDatadogRum } from './initDatadogRum'

describe('initDatadogRum', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.getInitConfiguration.mockReturnValue(undefined)
  })

  it.for([
    { hostname: 'cloud.comfy.org', env: 'prod-v2' },
    { hostname: 'stagingcloud.comfy.org', env: 'stg-v2' },
    { hostname: 'testcloud.comfy.org', env: 'test-v2' },
    { hostname: 'fe-pr-13691.testenvs.comfy.org', env: 'test-v2' }
  ])('initializes $hostname with the $env environment', ({ hostname, env }) => {
    initDatadogRum(hostname)

    expect(hoisted.init).toHaveBeenCalledWith({
      clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
      applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
      site: 'us5.datadoghq.com',
      service: 'comfy-cloud-frontend',
      env,
      version: __COMFYUI_FRONTEND_VERSION__,
      beforeSend: rumBeforeSend,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 0,
      allowedTracingUrls: [expect.any(RegExp)]
    })
  })

  it.for([
    'localhost',
    'testenvs.comfy.org',
    'eviltestenvs.comfy.org',
    'preview.testenvs.comfy.org.example.com'
  ])('does not initialize on unknown hostname %s', (hostname) => {
    initDatadogRum(hostname)

    expect(hoisted.init).not.toHaveBeenCalled()
  })

  it('does not initialize twice', () => {
    hoisted.getInitConfiguration.mockReturnValue({})

    initDatadogRum('cloud.comfy.org')

    expect(hoisted.init).not.toHaveBeenCalled()
  })
})
