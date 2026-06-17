import { computed } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { TurnstileMode } from '@/platform/remoteConfig/types'
import { api } from '@/scripts/api'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const SIGNUP_TURNSTILE_FLAG = 'signup_turnstile'

/**
 * Whether the current origin should host the signup Turnstile widget.
 *
 * Turnstile is a cloud-only protection: it must render on the cloud build/origin
 * (web + desktop Comfy Cloud view) but never on local OSS ComfyUI served from
 * localhost / 127.0.0.1, where signup is not gated and no token is required.
 */
export function isTurnstileOrigin(
  cloud: boolean = isCloud,
  hostname: string = window.location.hostname
): boolean {
  return cloud && !LOCAL_HOSTS.has(hostname)
}

function resolveTurnstileMode(): TurnstileMode {
  const override = getDevOverride<TurnstileMode>(SIGNUP_TURNSTILE_FLAG)
  if (override !== undefined) return override

  return (
    remoteConfig.value.signup_turnstile ??
    api.getServerFeature<TurnstileMode>(SIGNUP_TURNSTILE_FLAG, 'off')
  )
}

/**
 * Reactive Turnstile state for the signup form.
 * - `enabled`: render the widget (correct origin AND mode is shadow/enforce)
 * - `enforced`: block submit until the challenge is solved
 */
export function useTurnstile() {
  const mode = computed(resolveTurnstileMode)
  const enabled = computed(
    () => isTurnstileOrigin() && mode.value !== 'off'
  )
  const enforced = computed(() => enabled.value && mode.value === 'enforce')

  return { mode, enabled, enforced }
}
