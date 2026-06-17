import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

/**
 * Cloudflare Turnstile always-pass test sitekey, used only in local dev so the
 * signup flow can be exercised without a real key.
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

/**
 * Returns the Cloudflare Turnstile sitekey, delivered per-environment at runtime
 * via cloud remote config (`turnstile_sitekey`). Only the cloud-served frontend
 * receives remote config, so OSS / local builds get '' and the widget never
 * renders — no origin or `isCloud` check is needed. In dev it falls back to the
 * always-pass test key so the flow is exercisable locally.
 */
export function getTurnstileSiteKey(): string {
  const fallback = import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : ''
  return configValueOrDefault(remoteConfig.value, 'turnstile_sitekey', fallback)
}
