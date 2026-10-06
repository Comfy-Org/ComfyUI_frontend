/**
 * Enterprise SSO for comfy.org's email sign-in and sign-up. Behind Cloud's
 * global `sso_enabled` (anonymous `/api/features`, read once per page load),
 * an email whose domain signs in through its organization is sent to Cloud's
 * SSO start instead of Firebase. Every failure, of the flag read or of
 * discover, leaves the visitor on the Firebase sign-in.
 */
import { readAnonymousFeatureFlag } from '@comfyorg/account-core/webSessionFlag'
import { discoverSso, ssoStartUrl } from '@comfyorg/account-core/sso'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

/** SSO signs into Cloud; coming back to comfy.org waits on FE-3098. */
const CLOUD_RETURN_PATH = '/cloud/user-check'

interface SsoStartOptions {
  /** Cloud origin, e.g. `https://cloud.comfy.org`. */
  readonly cloudBaseUrl: string
  readonly fetchImpl: typeof fetch
}

interface SsoStartResolver {
  (email: string): Promise<string | undefined>
  /** Starts the flag read early so a sign-in submit doesn't wait on it. */
  readonly warm: () => void
}

export function createSsoStartResolver({
  cloudBaseUrl,
  fetchImpl
}: SsoStartOptions): SsoStartResolver {
  let enabled: Promise<boolean> | undefined
  const readEnabled = () =>
    (enabled ??= readAnonymousFeatureFlag(
      { cloudBaseUrl, fetchImpl },
      'sso_enabled'
    ))

  const resolve = async (email: string) => {
    if (!(await readEnabled())) return undefined
    const discovery = await discoverSso(email, {
      fetchImpl,
      baseUrl: cloudBaseUrl
    })
    return discovery.kind === 'sso'
      ? ssoStartUrl({
          email,
          returnTo: CLOUD_RETURN_PATH,
          origin: cloudBaseUrl
        })
      : undefined
  }
  return Object.assign(resolve, { warm: () => void readEnabled() })
}

/** Cloud's SSO start URL for this email, or undefined to sign in with Firebase. */
export const ssoStartUrlFor = createSsoStartResolver({
  cloudBaseUrl: WORKSHOP_CLOUD_BASE_URL,
  fetchImpl: (...args) => globalThis.fetch(...args)
})

export const warmSsoStartFlag = ssoStartUrlFor.warm
