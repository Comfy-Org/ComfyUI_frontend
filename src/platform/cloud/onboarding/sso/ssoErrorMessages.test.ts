import { describe, expect, it } from 'vitest'

import type { SsoErrorCode } from '@comfyorg/account-core/sso'
import { readSsoError } from '@comfyorg/account-core/sso'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { SSO_ERROR_MESSAGE_KEY } from '@/platform/cloud/onboarding/sso/ssoErrorMessages'

/**
 * `SSO_ERROR_MESSAGE_KEY` is typed `Record<SsoErrorCode, string>`, so its keys
 * are exactly the codes ingest can send and TypeScript already proves none is
 * missing. What it cannot prove is that the string on the right names real
 * copy, or that `readSsoError` still recognises the code — both are plain
 * strings. A miss in either shows a person a raw `auth.sso.errors.…` key or a
 * generic failure, on the one screen that tells them why they cannot sign in.
 */
const CODES = Object.keys(SSO_ERROR_MESSAGE_KEY) as SsoErrorCode[]

function copyAt(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      enMessages
    )
}

describe('SSO error copy', () => {
  it('has codes to check, so the per-code cases below cannot vacuously pass', () => {
    // A lower bound, not a census: ingest may add codes, and the type already
    // proves the map covers them. This only catches the map being emptied.
    expect(CODES.length).toBeGreaterThanOrEqual(15)
  })

  it.for(CODES)('%s resolves to English copy', (code) => {
    const message = copyAt(SSO_ERROR_MESSAGE_KEY[code])

    expect(message, `${code} -> ${SSO_ERROR_MESSAGE_KEY[code]}`).toBeTypeOf(
      'string'
    )
    expect(message).not.toBe('')
  })

  it.for(CODES)('%s survives the round trip through readSsoError', (code) => {
    expect(readSsoError(code)).toBe(code)
  })

  it('answers a code this build predates with copy, not a blank screen', () => {
    const code = readSsoError('SSO_SOMETHING_INGEST_ADDED_LATER')

    expect(code).toBe('SSO_SIGN_IN_FAILED')
    expect(copyAt(SSO_ERROR_MESSAGE_KEY[code!])).toBeTypeOf('string')
  })

  it.for([[undefined], [null], [''], [42], [[]], [{}]] as const)(
    'reads no error from the query value %o',
    ([value]) => {
      expect(readSsoError(value)).toBeUndefined()
    }
  )

  it('reads the first value when the query repeats sso_error', () => {
    expect(readSsoError(['SSO_ORG_DISABLED', 'SSO_IDP_ERROR'])).toBe(
      'SSO_ORG_DISABLED'
    )
  })
})
