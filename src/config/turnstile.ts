import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

/**
 * Cloudflare Turnstile always-pass test sitekey, used only in local dev so the
 * signup flow can be exercised without a real key.
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

// Public per-environment sitekeys, baked at build time so a cloud build renders
// the widget even before (or without) remote config; remote config still
// overrides them, so keys rotate live without a rebuild.
const PROD_TURNSTILE_SITE_KEY = '0x4AAAAAADnYZPVOpFCL_zeo'
const STAGING_TURNSTILE_SITE_KEY = '0x4AAAAAADnYY4_Q0qxHZ5a7'

/**
 * Returns the Cloudflare Turnstile sitekey for the current environment.
 * - OSS / localhost never renders the cloud widget (server-side loopback
 *   exemption covers local signup); in dev it falls back to the always-pass test
 *   key so the flow is exercisable locally, otherwise ''.
 * - Cloud builds prefer the per-env sitekey delivered via remote config
 *   (`turnstile_sitekey`) and fall back to the build-time constant, so the widget
 *   still renders during a remote-config gap rather than silently disappearing.
 * - Cloud dev-server builds (e.g. running locally against the staging API) are
 *   the one exception: a dev-server hostname is never in a real widget's
 *   domain allowlist, so the real sitekey is guaranteed to fail there ("Verifying…"
 *   loops into "Verification failed"). We use the always-pass test key instead —
 *   it's cryptographically isolated from the real widgets' secrets, so it can't
 *   mint a token those widgets (or their siteverify checks) would trust.
 *   Production/preview cloud builds are unaffected and keep the remote-config
 *   → build-time-constant resolution above.
 */
export function getTurnstileSiteKey(): string {
  // Gate on the __DISTRIBUTION__ build define rather than the cross-module
  // `isCloud` const so dead-code elimination strips the real per-env sitekeys
  // from OSS/desktop bundles — same idiom as initTelemetry.ts, enforced by the
  // dist scan in ci-dist-telemetry-scan.yaml.
  const isCloudBuild = __DISTRIBUTION__ === 'cloud'
  if (!isCloudBuild) {
    return import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : ''
  }

  if (import.meta.env.DEV) {
    return TURNSTILE_TEST_SITE_KEY
  }

  return configValueOrDefault(
    remoteConfig.value,
    'turnstile_sitekey',
    __USE_PROD_CONFIG__ ? PROD_TURNSTILE_SITE_KEY : STAGING_TURNSTILE_SITE_KEY
  )
}
