import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_COPY,
  AUTH_TOAST_SUMMARIES,
  UNAUTHORIZED_DOMAIN_MESSAGES
} from '@comfyorg/account/firebaseAuthError'
import type { AuthCopyLocale } from '@comfyorg/account/firebaseAuthError'
import { TURNSTILE_MESSAGES } from '@comfyorg/account/turnstile'

import en from './en/main.json'
import ja from './ja/main.json'
import zh from './zh/main.json'

interface AuthCopySlice {
  auth: { errors: Record<string, string>; turnstile: Record<string, string> }
  toastMessages: { unauthorizedDomain: string }
  g: { error: string; warning: string }
}

const LOCALES: ReadonlyArray<readonly [AuthCopyLocale, AuthCopySlice]> = [
  ['en', en],
  ['zh-CN', zh],
  ['ja', ja]
]

describe('auth copy shipped here equals the @comfyorg/account tables', () => {
  it.for(LOCALES)('%s auth.errors', ([locale, messages]) => {
    expect(
      messages.auth.errors,
      'edit the package table and this file together; the website reads the package'
    ).toEqual(AUTH_ERROR_COPY[locale])
  })

  it.for(LOCALES)('%s auth.turnstile', ([locale, messages]) => {
    expect(messages.auth.turnstile).toEqual(TURNSTILE_MESSAGES[locale])
  })

  it.for(LOCALES)(
    '%s unauthorized-domain and toast summaries',
    ([locale, messages]) => {
      expect(messages.toastMessages.unauthorizedDomain).toBe(
        UNAUTHORIZED_DOMAIN_MESSAGES[locale]
      )
      expect({ error: messages.g.error, warn: messages.g.warning }).toEqual(
        AUTH_TOAST_SUMMARIES[locale]
      )
    }
  )
})
