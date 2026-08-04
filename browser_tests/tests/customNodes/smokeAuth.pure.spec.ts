import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { FIREBASE_APP_NAME } from '@e2e/fixtures/helpers/firebaseAuthStorage'
import {
  SMOKE_ENV_VARS,
  identityToolkitErrorCode,
  missingSmokeEnvVars,
  shouldRewriteAuthHeader,
  smokeAuthUserRecord,
  workspaceSessionFromResponse
} from '@e2e/fixtures/helpers/smokeAuth'

const NOW = 1_700_000_000_000
const SMOKE_KEY = 'smoke-project-api-key'

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
      SMOKE_KEY,
      NOW
    )
    expect(record).toEqual({
      uid: 'smoke-uid',
      email: 'smoke-test@comfy.org',
      displayName: null,
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
      apiKey: SMOKE_KEY,
      appName: FIREBASE_APP_NAME
    })
  })

  test('falls back to the account email and keeps a returned displayName', () => {
    const { email: _omitted, ...withoutEmail } = signInResponse()
    const record = smokeAuthUserRecord(
      { ...withoutEmail, displayName: 'Smoke User' },
      'fallback@comfy.org',
      SMOKE_KEY,
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
      smokeAuthUserRecord(partial, 'fallback@comfy.org', SMOKE_KEY, NOW)
    } catch (error) {
      thrown = String(error)
    }
    expect(thrown).toContain('idToken')
    expect(thrown).toContain('localId')
    expect(thrown).not.toContain('refresh-opaque')
  })

  test('non-object and non-numeric-expiry responses fail loudly', () => {
    expect(() =>
      smokeAuthUserRecord(undefined, 'fallback@comfy.org', SMOKE_KEY, NOW)
    ).toThrow(/missing idToken/)
    expect(() =>
      smokeAuthUserRecord(
        { ...signInResponse(), expiresIn: 'soon' },
        'fallback@comfy.org',
        SMOKE_KEY,
        NOW
      )
    ).toThrow(/expiresIn/)
    expect(() =>
      smokeAuthUserRecord(
        { ...signInResponse(), expiresIn: '0' },
        'fallback@comfy.org',
        SMOKE_KEY,
        NOW
      )
    ).toThrow(/expiresIn/)
  })
})

function tokenResponse(): Record<string, unknown> {
  return {
    token: 'workspace.jwt.signature',
    expires_at: '2026-08-04T05:00:00Z',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['read', 'write']
  }
}

test.describe('workspaceSessionFromResponse', () => {
  test('shapes the mint response into what the session restore reads', () => {
    expect(workspaceSessionFromResponse(tokenResponse(), 'smoke-uid')).toEqual({
      token: 'workspace.jwt.signature',
      expiresAt: Date.parse('2026-08-04T05:00:00Z'),
      workspace: {
        id: 'ws-1',
        name: 'Personal',
        type: 'personal',
        role: 'owner'
      },
      ownerUid: 'smoke-uid'
    })
  })

  test('a response missing fields throws naming them, never the token', () => {
    const { token: _token, role: _role, ...partial } = tokenResponse()
    let thrown = ''
    try {
      workspaceSessionFromResponse(partial, 'smoke-uid')
    } catch (error) {
      thrown = String(error)
    }
    expect(thrown).toContain('token')
    expect(thrown).toContain('role')
    expect(thrown).not.toContain('workspace.jwt.signature')
  })

  test('non-object, nested-miss and unparsable-expiry responses fail loudly', () => {
    expect(() => workspaceSessionFromResponse(undefined, 'smoke-uid')).toThrow(
      /missing token/
    )
    expect(() =>
      workspaceSessionFromResponse(
        { ...tokenResponse(), workspace: { name: 'Personal' } },
        'smoke-uid'
      )
    ).toThrow(/workspace\.id/)
    expect(() =>
      workspaceSessionFromResponse(
        { ...tokenResponse(), expires_at: 'whenever' },
        'smoke-uid'
      )
    ).toThrow(/expires_at/)
  })
})

test.describe('identityToolkitErrorCode', () => {
  test('extracts the code from a well-formed error body', () => {
    expect(
      identityToolkitErrorCode({ error: { message: 'INVALID_PASSWORD' } })
    ).toBe('INVALID_PASSWORD')
  })

  test('returns undefined for every malformed shape', () => {
    expect(identityToolkitErrorCode(undefined)).toBeUndefined()
    expect(identityToolkitErrorCode(null)).toBeUndefined()
    expect(identityToolkitErrorCode('EMAIL_NOT_FOUND')).toBeUndefined()
    expect(identityToolkitErrorCode({})).toBeUndefined()
    expect(identityToolkitErrorCode({ error: null })).toBeUndefined()
    expect(identityToolkitErrorCode({ error: 'flat' })).toBeUndefined()
    expect(identityToolkitErrorCode({ error: { message: 42 } })).toBeUndefined()
  })
})

test.describe('shouldRewriteAuthHeader', () => {
  const API_PREFIX = 'http://localhost:4173/api/'
  const rewrites = (href: string) =>
    shouldRewriteAuthHeader(new URL(href), API_PREFIX)

  test('rewrites same-origin api traffic and nothing else', () => {
    expect(rewrites('http://localhost:4173/api/userdata/workflows')).toBe(true)
    expect(rewrites('http://localhost:4173/api/prompt')).toBe(true)
    expect(rewrites('http://localhost:4173/assets/main.js')).toBe(false)
    expect(rewrites('https://mp.comfy.org/api/track')).toBe(false)
  })

  test('leaves the token exchange and the boot feature payload anonymous', () => {
    expect(rewrites('http://localhost:4173/api/auth/token')).toBe(false)
    expect(rewrites('http://localhost:4173/api/features')).toBe(false)
    expect(rewrites('http://localhost:4173/api/features?flags=1')).toBe(false)
  })

  test('excludes whole paths, never prefixes of a longer one', () => {
    expect(rewrites('http://localhost:4173/api/featuresfoo')).toBe(true)
    expect(rewrites('http://localhost:4173/api/features/detail')).toBe(true)
  })
})

test.describe('missingSmokeEnvVars', () => {
  test('names exactly the absent or empty variables', () => {
    expect(missingSmokeEnvVars({})).toEqual([...SMOKE_ENV_VARS])
    expect(
      missingSmokeEnvVars({
        SMOKE_ACCOUNT_EMAIL: 'cloud-test@comfy.org',
        SMOKE_ACCOUNT_PASSWORD: 'secret'
      })
    ).toEqual([])
    expect(
      missingSmokeEnvVars({
        SMOKE_ACCOUNT_PASSWORD: ''
      })
    ).toEqual(['SMOKE_ACCOUNT_EMAIL', 'SMOKE_ACCOUNT_PASSWORD'])
  })
})
