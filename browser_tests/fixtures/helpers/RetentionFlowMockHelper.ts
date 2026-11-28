import type { Page } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  ErrorResponse,
  RetentionAcceptance,
  RetentionAcceptRequest,
  RetentionFlowEventRequest,
  RetentionFlowResponse
} from '@comfyorg/ingest-types'

import { CancellationFlowDialog } from '@e2e/fixtures/components/CancellationFlowDialog'
import {
  CANCELLATION_SURVEY_REMOTE_CONFIG,
  PERSONAL_PRO_BILLING_STATUS
} from '@e2e/fixtures/data/retentionFlow'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

/** How `/api/billing/retention/accept` answers: start a discount, or refuse a session that expired. */
type RetentionAcceptMock = 'applies' | 'expired'

/**
 * Boots a Personal Pro owner with the Cloud cancellation flow stubbed (the
 * survey's remote config, the retention session, its events and accept, and
 * the cancel route) and records what the app sent.
 */
export class RetentionFlowMockHelper {
  readonly events: RetentionFlowEventRequest[] = []
  readonly acceptRequests: RetentionAcceptRequest[] = []
  readonly cancelRequests: CancelSubscriptionRequest[] = []

  constructor(private readonly page: Page) {}

  async openCancellation(
    flow: RetentionFlowResponse,
    accept: RetentionAcceptMock = 'applies'
  ): Promise<CancellationFlowDialog> {
    const workspaceMocks = new CloudWorkspaceMockHelper(this.page)
    await workspaceMocks.setup(
      [],
      workspace('personal', 'owner'),
      PERSONAL_PRO_BILLING_STATUS
    )
    await this.mockRetention(flow, accept)
    const dialog = new CancellationFlowDialog(this.page)
    await dialog.openFrom(await workspaceMocks.openPlanAndCreditsSettings())
    return dialog
  }

  private async mockRetention(
    flow: RetentionFlowResponse,
    accept: RetentionAcceptMock
  ): Promise<void> {
    const { page } = this
    await page.route('**/api/features', (r) =>
      r.fulfill(jsonRoute(CANCELLATION_SURVEY_REMOTE_CONFIG))
    )
    await page.route('**/api/billing/retention/prepare', (r) =>
      r.fulfill(jsonRoute(flow))
    )
    await page.route('**/api/billing/retention/events', (r) => {
      this.events.push(r.request().postDataJSON())
      return r.fulfill({ status: 204 })
    })
    await page.route('**/api/billing/retention/accept', (r) => {
      this.acceptRequests.push(r.request().postDataJSON())
      if (accept === 'expired') {
        const refusal: ErrorResponse = {
          code: 'RETENTION_SESSION_STALE',
          message: 'reopen cancellation to refresh this offer'
        }
        return r.fulfill({ ...jsonRoute(refusal), status: 409 })
      }
      const acceptance: RetentionAcceptance = {
        billing_op_id: 'op-retention-e2e',
        status: 'pending'
      }
      return r.fulfill({ ...jsonRoute(acceptance), status: 202 })
    })
    await page.route('**/api/billing/subscription/cancel', (r) => {
      this.cancelRequests.push(r.request().postDataJSON() ?? {})
      const cancelled: CancelSubscriptionResponse = {
        billing_op_id: 'op-cancel-e2e',
        cancel_at: '2099-02-20T00:00:00Z'
      }
      return r.fulfill(jsonRoute(cancelled))
    })
    await page.route('**/api/billing/ops/**', (r) => {
      const settled: BillingOpStatusResponse = {
        id: new URL(r.request().url()).pathname.split('/').pop() ?? '',
        status: 'succeeded',
        started_at: '2099-01-01T00:00:00Z',
        completed_at: '2099-01-01T00:00:05Z'
      }
      return r.fulfill(jsonRoute(settled))
    })
  }
}
