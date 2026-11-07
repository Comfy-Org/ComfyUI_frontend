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

/** The Datadog deploy environment for a hostname, or `undefined` when untracked. */
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

/** The canary/stable bucket from `X-Frontend-Bucket`; `undefined` until known. */
export function getFrontendBucket(): FrontendBucket | undefined {
  return resolvedBucket
}
