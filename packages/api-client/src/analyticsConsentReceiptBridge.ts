export const analyticsConsentReceiptKey = 'Comfy.Analytics.PostHogConsent'

export interface AnalyticsConsentReceipt {
  accepted: true
  service: 'posthog'
  policy_version: string
  notice_digest: string
}

export interface ConsentReceiptTransport {
  grant: (receipt: AnalyticsConsentReceipt) => Promise<void>
  revoke: () => Promise<void>
}

export interface ConsentReceiptConfiguration {
  enabled: boolean
  policyVersion: string
  noticeDigest: string
}

/** Creates an unbound bridge for one immutable authenticated actor/workspace session. */
export function createAnalyticsConsentReceiptBridge(
  configuration: ConsentReceiptConfiguration,
  transport: ConsentReceiptTransport,
  setEligible: (eligible: boolean) => void
) {
  let generation = 0
  let disposed = false
  let revocationPending = false
  let tail = Promise.resolve(false)
  const configured =
    
    configuration.enabled &&
    [configuration.policyVersion, configuration.noticeDigest].every(
      (value) =>
        value.trim().length > 0 && new TextEncoder().encode(value).length <= 256
    )
  const receipt: AnalyticsConsentReceipt = {
    accepted: true,
    service: 'posthog',
    policy_version: configuration.policyVersion,
    notice_digest: configuration.noticeDigest
  }
  setEligible(false)

  const isCurrent = (revision: number) => !disposed && revision === generation

  function update(
    explicitPostHogConsent: boolean | undefined
  ): Promise<boolean> {
    const revision = ++generation
    setEligible(false)
    if (disposed || ! configuration.enabled)
      return Promise.resolve(false)
    if (explicitPostHogConsent !== true) revocationPending = true
    if (!configured && !revocationPending) return Promise.resolve(false)
    tail = tail.then(async () => {
      if (revocationPending) {
        try {
          await transport.revoke()
          revocationPending = false
        } catch {
          return false
        }
      }
      if (
        !isCurrent(revision) ||
        !configured ||
        explicitPostHogConsent !== true
      )
        return false
      try {
        await transport.grant({ ...receipt })
      } catch {
        return false
      }
      if (!isCurrent(revision)) return false
      setEligible(true)
      return true
    })
    return tail
  }

  function dispose() {
    disposed = true
    ++generation
    setEligible(false)
  }

  return { update, dispose }
}
