import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  FIREBASE_APP_NAME,
  FIREBASE_WEB_API_KEY
} from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  missingSmokeEnvVars,
  SMOKE_ENV_VARS,
  smokeAuthUserRecord
} from '@e2e/fixtures/helpers/smokeAuth'

// The record shaping is the one seam between the identitytoolkit sign-in
// response and the IndexedDB record the frontend's Firebase SDK restores; a
// silent field drift here would boot the cloud suite signed out.

const NOW = 1_700_000_000_000

function signInResponse(): Record<string, unknown> {
  return {
    kind: 'identitytoolkit#VerifyPasswordResponse',
    idToken: 'header.payload.signature',
    refreshToken: 'refresh-opaque',
    localId: 'smoke-uid',
    expiresIn: '3600',
    email: 'smoke-test@comfy.org',
    registered: true
  }
}

test.describe('smokeAuthUserRecord', () => {
  test('shapes the sign-in response into the record the SDK restores', () => {
    const record = smokeAuthUserRecord(
      signInResponse(),
      'fallback@comfy.org',
      NOW
    )
    expect(record).toEqual({
      uid: 'smoke-uid',
      email: 'smoke-test@comfy.org',
      emailVerified: true,
      isAnonymous: false,
      providerData: [
        {
          providerId: 'password',
          uid: 'smoke-test@comfy.org',
          displayName: null,
          email: 'smoke-test@comfy.org',
          phoneNumber: null,
          photoURL: null
        }
      ],
      stsTokenManager: {
        refreshToken: 'refresh-opaque',
        accessToken: 'header.payload.signature',
        expirationTime: NOW + 3600 * 1000
      },
      apiKey: FIREBASE_WEB_API_KEY,
      appName: FIREBASE_APP_NAME
    })
  })

  test('falls back to the account email and keeps a returned displayName', () => {
    const { email: _omitted, ...withoutEmail } = signInResponse()
    const record = smokeAuthUserRecord(
      { ...withoutEmail, displayName: 'Smoke User' },
      'fallback@comfy.org',
      NOW
    )
    expect(record.email).toBe('fallback@comfy.org')
    expect(record.displayName).toBe('Smoke User')
    expect(record.providerData[0].displayName).toBe('Smoke User')
    expect(record.providerData[0].uid).toBe('fallback@comfy.org')
  })

  test('a response missing token fields throws naming the fields, never the values', () => {
    const {
      idToken: _idToken,
      localId: _localId,
      ...partial
    } = signInResponse()
    let thrown = ''
    try {
      smokeAuthUserRecord(partial, 'fallback@comfy.org', NOW)
    } catch (error) {
      thrown = String(error)
    }
    expect(thrown).toContain('idToken')
    expect(thrown).toContain('localId')
    // The intact refreshToken value must not leak into the diagnostic.
    expect(thrown).not.toContain('refresh-opaque')
  })

  test('non-object and non-numeric-expiry responses fail loudly', () => {
    expect(() =>
      smokeAuthUserRecord(undefined, 'fallback@comfy.org', NOW)
    ).toThrow(/missing idToken/)
    expect(() =>
      smokeAuthUserRecord(
        { ...signInResponse(), expiresIn: 'soon' },
        'fallback@comfy.org',
        NOW
      )
    ).toThrow(/expiresIn/)
    expect(() =>
      smokeAuthUserRecord(
        { ...signInResponse(), expiresIn: '0' },
        'fallback@comfy.org',
        NOW
      )
    ).toThrow(/expiresIn/)
  })
})

test.describe('missingSmokeEnvVars', () => {
  test('names exactly the absent or empty variables', () => {
    expect(missingSmokeEnvVars({})).toEqual([...SMOKE_ENV_VARS])
    expect(
      missingSmokeEnvVars({
        SMOKE_FIREBASE_API_KEY: 'key',
        SMOKE_ACCOUNT_EMAIL: 'smoke-test@comfy.org',
        SMOKE_ACCOUNT_PASSWORD: 'secret'
      })
    ).toEqual([])
    expect(
      missingSmokeEnvVars({
        SMOKE_FIREBASE_API_KEY: 'key',
        SMOKE_ACCOUNT_PASSWORD: ''
      })
    ).toEqual(['SMOKE_ACCOUNT_EMAIL', 'SMOKE_ACCOUNT_PASSWORD'])
  })
})
