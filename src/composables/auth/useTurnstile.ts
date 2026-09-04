import { computed } from 'vue'

import {
  isTurnstileEnabled,
  normalizeTurnstileMode
} from '@comfyorg/auth-core/turnstile'

import { getTurnstileSiteKey } from '@/config/turnstile'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { TurnstileMode } from '@/platform/remoteConfig/types'

export { useTurnstileGate } from '@comfyorg/auth-core/turnstile'

/**
 * Reactive Turnstile state for the signup form.
 * - `enabled`: render the widget
 * - `enforced`: block submit until the challenge is solved
 *
 * Binds the shared resolution rules to this app's config sources: the
 * signupTurnstileMode feature flag and the per-env sitekey. OSS / local
 * builds resolve no sitekey — the real per-env keys are tree-shaken out via
 * the __DISTRIBUTION__ build define (see config/turnstile.ts) — so the widget
 * never renders there.
 */
export function useTurnstile() {
  const { flags } = useFeatureFlags()
  const mode = computed<TurnstileMode>(() =>
    normalizeTurnstileMode(flags.signupTurnstileMode)
  )
  const siteKey = computed(getTurnstileSiteKey)
  const enabled = computed(() => isTurnstileEnabled(mode.value, siteKey.value))
  const enforced = computed(() => enabled.value && mode.value === 'enforce')

  return { mode, siteKey, enabled, enforced }
}
