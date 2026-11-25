import type { BillingResult } from '@comfyorg/account-core/billing'
import type { ErrorEvent } from '@sentry/vue'
import { describe, expect, it } from 'vitest'

import { sentryBeforeSend } from '@/platform/telemetry/sentryBeforeSend'

import { readOnRail } from './readOnRail'

const settle =
  <T>(result: BillingResult<T>) =>
  () =>
    Promise.resolve(result)

describe('readOnRail', () => {
  it('returns the value of a successful read', async () => {
    await expect(
      readOnRail(settle({ status: 'ok', value: 7 }), 'getBillingBalance')
    ).resolves.toBe(7)
  })

  it('returns nothing for a superseded read', async () => {
    await expect(
      readOnRail(
        settle({ status: 'error', code: 'SUPERSEDED' }),
        'getBillingStatus'
      )
    ).resolves.toBeUndefined()
  })

  it('reports a failed read in the Sentry group of the legacy method it replaces', async () => {
    const error = await readOnRail(
      settle({ status: 'error', code: 'REQUEST_FAILED', httpStatus: 400 }),
      'getBillingStatus'
    ).catch((caught: unknown) => caught)

    const event: ErrorEvent = { type: undefined }
    const reported = sentryBeforeSend(event, { originalException: error })

    expect(reported?.fingerprint).toEqual([
      'WorkspaceApiError',
      'getBillingStatus',
      '400',
      'REQUEST_FAILED'
    ])
    expect(reported?.tags).toMatchObject({
      workspace_api_operation: 'getBillingStatus'
    })
  })
})
