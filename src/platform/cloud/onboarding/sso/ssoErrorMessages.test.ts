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
 *
 * Several codes share a key on purpose, so asserting only that a key resolves
 * would let one code be remapped onto another's wording unnoticed. The table
 * below holds the rendered answer for every code instead. It covers `en` only:
 * no other locale carries `auth.sso.errors` yet, and whoever lands the first
 * translation should parameterise this over locales.
 */
const CODES = Object.keys(SSO_ERROR_MESSAGE_KEY) as SsoErrorCode[]

const { t } = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
}).global

const render = (key: string) => t(key as Parameters<typeof t>[0])

describe('SSO error copy', () => {
  it('renders the message a person reads for every code', () => {
    const rendered = Object.fromEntries(
      CODES.map((code) => [code, render(SSO_ERROR_MESSAGE_KEY[code])])
    )

    expect(rendered).toMatchInlineSnapshot(`
      {
        "INTERNAL_ERROR": "We couldn't sign you in with single sign-on. Try again.",
        "RATE_LIMITED": "Too many sign-in attempts. Wait a few minutes and try again.",
        "SESSION_CREATION_FAILED": "We couldn't sign you in with single sign-on. Try again.",
        "SSO_ACCOUNT_CONFLICT": "More than one Comfy account uses this email. Email support@comfy.org for help.",
        "SSO_ACCOUNT_DELETED": "This account is scheduled for deletion. If this is a mistake, email support@comfy.org.",
        "SSO_CONFIRM_EXPIRED": "Your sign-in expired or was started in another browser. Start again.",
        "SSO_EMAIL_DOMAIN_NOT_ALLOWED": "Your organization's sign-in returned an email outside its domains. Ask your administrator to use your work email in the directory.",
        "SSO_EXCHANGE_FAILED": "We couldn't sign you in with single sign-on. Try again.",
        "SSO_IDP_ERROR": "Your identity provider didn't complete the sign-in. Try again.",
        "SSO_INVALID_STATE": "Your sign-in expired or was started in another browser. Start again.",
        "SSO_LINK_CHECK_FAILED": "Single sign-on is unavailable right now. Try again in a moment.",
        "SSO_NOT_CONFIGURED": "Single sign-on isn't set up for your organization. Contact your administrator.",
        "SSO_ORG_DISABLED": "Single sign-on is turned off for your organization. Contact your administrator.",
        "SSO_ORG_MISMATCH": "You signed in to a different organization than the one for this email. Try again with your work account.",
        "SSO_ORG_NOT_ATTACHED": "Your organization's Comfy workspace isn't set up yet. Contact your administrator.",
        "SSO_SIGN_IN_FAILED": "We couldn't sign you in with single sign-on. Try again.",
        "SSO_UNAVAILABLE": "Single sign-on is unavailable right now. Try again in a moment.",
        "SSO_USER_SUSPENDED": "Your organization has removed your access. Contact your administrator.",
      }
    `)
  })

  it('answers a code this build predates with copy, not a blank screen', () => {
    const code = readSsoError('SSO_SOMETHING_INGEST_ADDED_LATER')!

    expect(render(SSO_ERROR_MESSAGE_KEY[code])).toBe(
      "We couldn't sign you in with single sign-on. Try again."
    )
  })
})
