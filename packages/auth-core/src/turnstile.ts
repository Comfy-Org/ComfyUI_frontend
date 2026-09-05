import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

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
 * Submit-gating state for a signup form's Turnstile widget: a token/
 * unavailable pair, plus `waiting`, which is true while a real token is still
 * needed. Waits in both shadow and enforce mode (`enabled`), not just
 * enforce, so shadow mode's token can't race the async Cloudflare
 * challenge; falls back open once the widget reports `unavailable` so a
 * broken/slow load can never permanently block signup.
 *
 * `token`/`unavailable` reset on every `enabled` transition, in either
 * direction, so state from a previous widget instance can never leak into a
 * freshly (re-)rendered one.
 */
export function useTurnstileGate(enabled: Ref<boolean>) {
  const token = ref('')
  const unavailable = ref(false)

  const waiting = computed(
    () => enabled.value && !token.value && !unavailable.value
  )

  watch(enabled, () => {
    token.value = ''
    unavailable.value = false
  })

  return { token, unavailable, waiting }
}
