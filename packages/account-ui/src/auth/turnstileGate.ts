import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

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
