import type { AuthCopyLocale } from './firebaseAuthError'

export type TurnstileMode = 'off' | 'shadow' | 'enforce'

/**
 * Clamp an externally-sourced value to a known TurnstileMode. Unknown strings
 * (typos, stale flag variants) resolve to 'off' so a bad value can never leave
 * the widget rendered-but-unenforced — mirrors the server-side resolver.
 */
export function normalizeTurnstileMode(raw: string | undefined): TurnstileMode {
  return raw === 'shadow' || raw === 'enforce' ? raw : 'off'
}

/**
 * Whether the signup Turnstile widget should render. Purely config-driven: the
 * flag must be shadow/enforce and a sitekey must be configured. Hosts that
 * resolve no sitekey (OSS / local builds) never render the widget; their
 * exemption lives server-side (loopback-IP check in CreateCustomer).
 */
export function isTurnstileEnabled(
  mode: TurnstileMode,
  siteKey: string
): boolean {
  return mode !== 'off' && siteKey !== ''
}

/**
 * The cloud app's Turnstile copy (src/locales/<locale>/main.json,
 * auth.turnstile.*), so both hosts hand TurnstileWidget the same strings.
 */
export const TURNSTILE_MESSAGES: Readonly<
  Record<
    AuthCopyLocale,
    Readonly<{ expired: string; failed: string; submitBlockedHint: string }>
  >
> = {
  en: {
    expired: 'Verification expired. Please complete the challenge again.',
    failed: 'Verification failed. Please try again.',
    submitBlockedHint:
      'Complete the verification challenge above to enable sign up.'
  },
  'zh-CN': {
    expired: '验证已过期。请重新完成验证。',
    failed: '验证失败。请重试。',
    submitBlockedHint: '请先完成上方的验证挑战以启用注册。'
  },
  ja: {
    expired: '認証の有効期限が切れました。再度チャレンジを完了してください。',
    failed: '認証に失敗しました。もう一度お試しください。',
    submitBlockedHint:
      '上記の認証チャレンジを完了すると、サインアップが有効になります。'
  }
}
