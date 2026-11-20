import { describe, expect, it } from 'vitest'

import { isBootConsoleErrorInEveryCloudEnvironment } from '@e2e/fixtures/utils/deploymentSmoke'

describe(isBootConsoleErrorInEveryCloudEnvironment, () => {
  it.for([
    {
      name: 'the i18n 404 resource line',
      error:
        'Failed to load resource: the server responded with a status of 404 () [https://deploy.example/api/i18n]',
      allowed: true
    },
    {
      name: 'the i18n 404 resource line with a query',
      error:
        'Failed to load resource: the server responded with a status of 404 (Not Found) [https://deploy.example/api/i18n?locale=en]',
      allowed: true
    },
    {
      name: 'an uncaught page error that mentions the endpoint',
      error:
        'Uncaught page error: Error: i18n crashed after GET /api/i18n\n    at boot (https://deploy.example/assets/index.js:1:1)',
      allowed: false
    },
    {
      name: 'a console.error that mentions the endpoint',
      error:
        'Failed to fetch /api/i18n [https://deploy.example/assets/index.js]',
      allowed: false
    },
    {
      name: 'a server error from the endpoint',
      error:
        'Failed to load resource: the server responded with a status of 500 () [https://deploy.example/api/i18n]',
      allowed: false
    },
    {
      name: 'a 404 from a neighbouring endpoint',
      error:
        'Failed to load resource: the server responded with a status of 404 () [https://deploy.example/api/i18n-extra]',
      allowed: false
    },
    {
      name: 'a 404 app chunk',
      error:
        'Failed to load resource: the server responded with a status of 404 () [https://deploy.example/assets/index-abc.js]',
      allowed: false
    }
  ])('allows only the known i18n 404: $name', ({ error, allowed }) => {
    expect(isBootConsoleErrorInEveryCloudEnvironment(error)).toBe(allowed)
  })
})
