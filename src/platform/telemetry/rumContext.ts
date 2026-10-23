import type { DatadogRum } from '@datadog/browser-rum'

import type { DeployEnv } from '@comfyorg/shared-frontend-utils/telemetry'

export type FrontendBucket = 'canary' | 'stable'

const DATADOG_ENV_BY_HOSTNAME = new Map<string, DeployEnv>([
  ['cloud.comfy.org', 'prod-v2'],
  ['stagingcloud.comfy.org', 'stg-v2'],
  ['testcloud.comfy.org', 'test-v2']
])

let installedRum: DatadogRum | undefined
let resolvedBucket: FrontendBucket | undefined

/**
 * Maps a hostname to the deploy environment name Datadog/backend engineers
 * already use to distinguish prod from testcloud/staging — shared here so a
 * caller identifying "which backend is this" (e.g. a bug-report payload)
 * reads the same classification RUM does, instead of a second hostname list
 * that can drift from this one.
 */
export function resolveDeployEnv(
  hostname = window.location.hostname
): DeployEnv | undefined {
  return (
    DATADOG_ENV_BY_HOSTNAME.get(hostname) ??
    (hostname.endsWith('.testenvs.comfy.org') ? 'test-v2' : undefined)
  )
}

/** Hands the RUM SDK to startup code that must not import it statically. */
export function installDatadogRum(rum: DatadogRum): void {
  installedRum = rum
}

/** The RUM SDK once the cloud entry installed it; `undefined` off cloud. */
export function getDatadogRum(): DatadogRum | undefined {
  return installedRum
}

export function setFrontendBucket(bucket: FrontendBucket): void {
  resolvedBucket = bucket
}

/**
 * The canary/stable split, resolved once from the deploy's own
 * `X-Frontend-Bucket` response header rather than inferred from a release or
 * version string (D25) — other telemetry sinks that want the same fact
 * should read this instead of re-fetching it. `undefined` means the split
 * isn't known yet (probe still pending, failed, or off a tracked version),
 * not 'stable' — collapsing that into a default would mistag reports and
 * corrupt the canary/stable RUM comparison this header exists to support.
 */
export function getFrontendBucket(): FrontendBucket | undefined {
  return resolvedBucket
}
