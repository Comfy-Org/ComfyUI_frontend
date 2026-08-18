import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { getTurnstileSiteKey } from '@/config/turnstile'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { TurnstileMode } from '@/platform/remoteConfig/types'

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
 * flag must be shadow/enforce and a sitekey must be configured. OSS / local
 * builds resolve no sitekey — the real per-env keys are tree-shaken out via the
 * __DISTRIBUTION__ build define (see config/turnstile.ts) — so the widget never
 * renders. The local-OSS exemption lives server-side (loopback-IP check in
 * CreateCustomer).
 */
export function isTurnstileEnabled(
  mode: TurnstileMode,
  siteKey: string
): boolean {
  return mode !== 'off' && siteKey !== ''
}

/**
 * Reactive Turnstile state for the signup form.
 * - `enabled`: render the widget
 * - `enforced`: block submit until the challenge is solved
 */
export function useTurnstile() {
  const { flags } = useFeatureFlags()
  const mode = computed(() => normalizeTurnstileMode(flags.signupTurnstileMode))
  const siteKey = computed(getTurnstileSiteKey)
  const enabled = computed(() => isTurnstileEnabled(mode.value, siteKey.value))
  const enforced = computed(() => enabled.value && mode.value === 'enforce')

  return { mode, siteKey, enabled, enforced }
}

/**
 * Submit-gating state for the signup form's Turnstile widget: a token/
 * unavailable pair, plus `waiting`, which is true while a real token is still
 * needed. Waits in both shadow and enforce mode (`enabled`), not just
 * `enforced`, so shadow mode's token can't race the async Cloudflare
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
