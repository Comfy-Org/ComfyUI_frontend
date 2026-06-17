import { computed } from 'vue'

import { getTurnstileSiteKey } from '@/config/turnstile'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { TurnstileMode } from '@/platform/remoteConfig/types'
import { api } from '@/scripts/api'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const SIGNUP_TURNSTILE_FLAG = 'signup_turnstile'

/**
 * Clamp an externally-sourced value to a known TurnstileMode. Unknown strings
 * (typos, stale flag variants) resolve to 'off' so a bad value can never leave
 * the widget rendered-but-unenforced — mirrors the server-side resolver.
 */
export function normalizeTurnstileMode(raw: string | undefined): TurnstileMode {
  return raw === 'shadow' || raw === 'enforce' ? raw : 'off'
}

function resolveTurnstileMode(): TurnstileMode {
  const raw =
    getDevOverride<TurnstileMode>(SIGNUP_TURNSTILE_FLAG) ??
    remoteConfig.value.signup_turnstile ??
    api.getServerFeature<TurnstileMode>(SIGNUP_TURNSTILE_FLAG, 'off')
  return normalizeTurnstileMode(raw)
}

/**
 * Whether the signup Turnstile widget should render. Purely config-driven: the
 * flag must be shadow/enforce and a sitekey must be configured. Both come only
 * from cloud remote config, so OSS / local builds get neither and the widget
 * never renders — no origin or `isCloud` dependency. The local-OSS exemption
 * lives server-side (loopback-IP check in CreateCustomer).
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
  const mode = computed(resolveTurnstileMode)
  const siteKey = computed(getTurnstileSiteKey)
  const enabled = computed(() => isTurnstileEnabled(mode.value, siteKey.value))
  const enforced = computed(() => enabled.value && mode.value === 'enforce')

  return { mode, siteKey, enabled, enforced }
}
