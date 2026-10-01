import type { RumEvent } from '@datadog/browser-rum'
// eslint-disable-next-line no-restricted-imports -- billing web's telemetry layer owns the RUM sink that reportBillingWebError() and billing events go through
import { datadogRum } from '@datadog/browser-rum'

import type { DeployEnv } from '@comfyorg/shared-frontend-utils/telemetry'
import {
  COMFY_RUM_APPLICATION,
  isRumErrorNoise,
  redactSensitiveText,
  REPORTED_ERROR_PREFIX,
  stripUrlQuery
} from '@comfyorg/shared-frontend-utils/telemetry'

import type { BillingWebEnv } from '@/config/env'
import { resolveHostEnv } from '@/config/env'

export interface BillingWebRumOptions {
  readonly hostname: string | undefined
  readonly version: string
}

interface ScrubbableView {
  url: string
  referrer?: string
}

/** The fields of a RUM event this origin rewrites before it leaves the page. */
export type ScrubbableRumEvent =
  | {
      type: 'error'
      view: ScrubbableView
      error: {
        message: string
        stack?: string
        source?: string
        resource?: { url: string }
        causes?: readonly { message: string; stack?: string }[]
      }
    }
  | { type: 'resource'; view: ScrubbableView; resource: { url: string } }
  | {
      type: 'action'
      view: ScrubbableView
      action: { target?: { name: string } }
    }
  | {
      type: Exclude<RumEvent['type'], 'error' | 'resource' | 'action'>
      view: ScrubbableView
    }

export interface ReportBillingWebErrorOptions {
  readonly errorType: string
  readonly context?: Readonly<Record<string, string | number | boolean>>
}

const DEPLOY_ENV_BY_BILLING_WEB_ENV: Readonly<
  Record<BillingWebEnv, DeployEnv>
> = {
  production: 'prod-v2',
  staging: 'stg-v2',
  test: 'test-v2'
}

/**
 * Only the three billing hosts report, each under the Cloud family it talks
 * to, so a preview or local build never lands in a deployed environment.
 */
export function initBillingWebRum({
  hostname,
  version
}: BillingWebRumOptions): void {
  const family = resolveHostEnv(hostname)
  if (!family || datadogRum.getInitConfiguration()) return

  datadogRum.init({
    ...COMFY_RUM_APPLICATION,
    service: 'comfy-billing-web',
    env: DEPLOY_ENV_BY_BILLING_WEB_ENV[family],
    version,
    beforeSend: billingWebRumBeforeSend,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0
  })
}

type ScrubbableError = Extract<ScrubbableRumEvent, { type: 'error' }>['error']

function changesUnderRedaction(text: string | undefined): boolean {
  return text !== undefined && redactSensitiveText(text) !== text
}

/** RUM ignores beforeSend writes to an error's causes, so a sensitive cause can only be dropped with its error. */
function hasSensitiveCause({ causes = [] }: ScrubbableError): boolean {
  return causes.some(
    ({ message, stack }) =>
      changesUnderRedaction(message) || changesUnderRedaction(stack)
  )
}

function scrubError(error: ScrubbableError): void {
  error.message = redactSensitiveText(error.message)
  if (error.stack) error.stack = redactSensitiveText(error.stack)
  if (error.resource) error.resource.url = stripUrlQuery(error.resource.url)
}

function scrubPayload(event: ScrubbableRumEvent): void {
  switch (event.type) {
    case 'error':
      scrubError(event.error)
      return
    case 'resource':
      event.resource.url = stripUrlQuery(event.resource.url)
      return
    case 'action':
      if (event.action.target)
        event.action.target.name = redactSensitiveText(event.action.target.name)
  }
}

/**
 * A Stripe return lands here with a client secret in the query, and element
 * text can carry the signed-in email, so neither reaches RUM.
 */
export function billingWebRumBeforeSend(event: ScrubbableRumEvent): boolean {
  if (
    event.type === 'error' &&
    (isRumErrorNoise(event.error) || hasSensitiveCause(event.error))
  )
    return false

  event.view.url = stripUrlQuery(event.view.url)
  if (event.view.referrer)
    event.view.referrer = stripUrlQuery(event.view.referrer)
  scrubPayload(event)
  return true
}

export function addRumAction(name: string, context: object): void {
  if (datadogRum.getInitConfiguration()) datadogRum.addAction(name, context)
}

/** Never throws: a failing reporter must not become a second failure in the billing flow. */
export function reportBillingWebError(
  cause: unknown,
  { errorType, context }: ReportBillingWebErrorOptions
): void {
  try {
    console.error(`${REPORTED_ERROR_PREFIX}${errorType}`, cause)
    const error = cause instanceof Error ? cause : new Error(String(cause))
    datadogRum.addError(
      Object.assign(new Error(error.message), {
        name: errorType,
        stack: error.stack
      }),
      {
        ...context,
        error_type: errorType,
        surface: 'billing',
        billing_surface: 'billing_web'
      }
    )
  } catch {
    return
  }
}
