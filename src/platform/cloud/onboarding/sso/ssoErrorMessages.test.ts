import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { SsoErrorCode } from '@comfyorg/account-core/sso'
import { readSsoError } from '@comfyorg/account-core/sso'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { SSO_ERROR_MESSAGE_KEY } from '@/platform/cloud/onboarding/sso/ssoErrorMessages'

/**
 * `SSO_ERROR_MESSAGE_KEY` is typed `Record<SsoErrorCode, string>`, so TypeScript
 * already proves it names every code and no others. What it cannot prove is that
 * the string on the right reaches real copy, because the message keys are plain
 * strings: a key with no entry renders as a raw `auth.sso.errors.…`, and a bad
 * i18n literal such as `{@}` instead of `{'@'}` throws in the message compiler.
 * Either one lands on the single screen that tells a person why they cannot sign
 * in, so copy is resolved here through vue-i18n rather than by reading the JSON,
 * which would accept both.
 */
const CODES = Object.keys(SSO_ERROR_MESSAGE_KEY) as SsoErrorCode[]

const { t } = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global

const render = (key: string) => t(key as Parameters<typeof t>[0])

describe('SSO error copy', () => {
  it.for(CODES)('%s renders English copy', (code) => {
    const key = SSO_ERROR_MESSAGE_KEY[code]

    expect(render(key), `${code} -> ${key}`).not.toBe(key)
    expect(render(key)).not.toBe('')
  })

  it.for([['SSO_ACCOUNT_DELETED'], ['SSO_ACCOUNT_CONFLICT']] as const)(
    '%s renders the support address, not a raw i18n literal',
    ([code]) => {
      expect(render(SSO_ERROR_MESSAGE_KEY[code])).toContain('support@comfy.org')
    }
  )

  it('answers a code this build predates with copy, not a blank screen', () => {
    const code = readSsoError('SSO_SOMETHING_INGEST_ADDED_LATER')

    expect(code).toBe('SSO_SIGN_IN_FAILED')
    expect(render(SSO_ERROR_MESSAGE_KEY['SSO_SIGN_IN_FAILED'])).not.toBe('')
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
