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
