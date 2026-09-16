import {
  cloudBaseUrlFor,
  readFirebaseOptions,
  resolveBillingWebEnv
} from '@/config/env'
import type { BillingWebEnv } from '@/config/env'

const FIREBASE_ENV = {
  VITE_FIREBASE_API_KEY: 'api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'billing.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'billing',
  VITE_FIREBASE_APP_ID: '1:1:web:1'
}

describe('billing web environment', () => {
  it.for([
    ['production', 'https://cloud.comfy.org'],
    ['staging', 'https://stagingcloud.comfy.org'],
    ['test', 'https://testcloud.comfy.org']
  ] as const)('sends %s at %s', ([env, cloudBaseUrl]) => {
    expect(cloudBaseUrlFor(env)).toBe(cloudBaseUrl)
  })

  it.for([
    ['production', 'production'],
    ['staging', 'staging'],
    ['test', 'test'],
    ['prod', 'test'],
    ['Production', 'test'],
    ['', 'test'],
    [undefined, 'test']
  ] as [string | undefined, BillingWebEnv][])(
    'resolves %s to the %s family',
    ([value, expected]) => {
      expect(resolveBillingWebEnv(value)).toBe(expected)
    }
  )
})

describe('firebase configuration', () => {
  it('reads every documented variable into the options the identity takes', () => {
    expect(
      readFirebaseOptions({
        ...FIREBASE_ENV,
        VITE_FIREBASE_DATABASE_URL: 'https://billing.firebaseio.com',
        VITE_FIREBASE_STORAGE_BUCKET: 'billing.appspot.com',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '42',
        VITE_FIREBASE_MEASUREMENT_ID: 'G-1'
      })
    ).toEqual({
      apiKey: 'api-key',
      authDomain: 'billing.firebaseapp.com',
      projectId: 'billing',
      appId: '1:1:web:1',
      databaseURL: 'https://billing.firebaseio.com',
      storageBucket: 'billing.appspot.com',
      messagingSenderId: '42',
      measurementId: 'G-1'
    })
  })

  it.for([
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID'
  ])('offers no configuration when %s is missing', (missing) => {
    expect(
      readFirebaseOptions({ ...FIREBASE_ENV, [missing]: '' })
    ).toBeUndefined()
  })

  it('offers no configuration when nothing is set', () => {
    expect(readFirebaseOptions({})).toBeUndefined()
  })
})
