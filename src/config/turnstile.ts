import { isCloud } from '@/platform/distribution/types'
import {
  configValueOrDefault,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'

// TODO(BE-1489): Replace the staging/prod placeholders below with the real
// per-environment Turnstile sitekeys once Terraform PR #196 is applied. The
// real keys are delivered at runtime via cloud remote config
// (`turnstile_sitekey`); these build-time constants are only the fallback.
const PROD_SITE_KEY = '1x00000000000000000000AA'
const STAGING_SITE_KEY = '1x00000000000000000000AA'

/**
 * Cloudflare Turnstile dev/test sitekey that always passes. Used on OSS /
 * localhost builds where the widget is not rendered, and as the ultimate
 * fallback until the real per-environment keys land via Terraform.
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

const BUILD_TIME_SITE_KEY = __USE_PROD_CONFIG__
  ? PROD_SITE_KEY
  : STAGING_SITE_KEY

/**
 * Returns the Cloudflare Turnstile sitekey for the current environment.
 * - Cloud builds use the runtime sitekey delivered via remote config
 * - OSS / localhost builds fall back to the build-time key determined by
 *   __USE_PROD_CONFIG__
 */
export function getTurnstileSiteKey(): string {
  if (!isCloud) {
    return BUILD_TIME_SITE_KEY
  }

  return configValueOrDefault(
    remoteConfig.value,
    'turnstile_sitekey',
    BUILD_TIME_SITE_KEY
  )
}
