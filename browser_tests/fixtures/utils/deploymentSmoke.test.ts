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
    },
    {
      name: 'an i18n path nested under another path',
      error:
        'Failed to load resource: the server responded with a status of 404 () [https://deploy.example/other/api/i18n]',
      allowed: false
    },
    {
      name: 'the signed-out session 401 resource line',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example/api/auth/session]',
      allowed: true
    },
    {
      name: 'a session probe with a query',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example/api/auth/session?x=1]',
      allowed: false
    },
    {
      name: 'a session path carried in a query value',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example/api/auth/session?next=/api/auth/session]',
      allowed: false
    },
    {
      name: 'a session path nested under another path',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example/other/api/auth/session]',
      allowed: false
    },
    {
      name: 'the signed-out session 401 on a host with a port',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example:8443/api/auth/session]',
      allowed: true
    },
    {
      name: 'a server error from the session endpoint',
      error:
        'Failed to load resource: the server responded with a status of 500 () [https://deploy.example/api/auth/session]',
      allowed: false
    },
    {
      name: 'a 403 from the session endpoint',
      error:
        'Failed to load resource: the server responded with a status of 403 () [https://deploy.example/api/auth/session]',
      allowed: false
    },
    {
      name: 'a 401 from a neighbouring auth endpoint',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example/api/auth/session/refresh]',
      allowed: false
    },
    {
      name: 'a 401 from another API endpoint',
      error:
        'Failed to load resource: the server responded with a status of 401 () [https://deploy.example/api/user]',
      allowed: false
    }
  ])(
    'allows only the known signed-out boot lines: $name',
    ({ error, allowed }) => {
      expect(isBootConsoleErrorInEveryCloudEnvironment(error)).toBe(allowed)
    }
  )
})
