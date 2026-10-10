import { expect } from '@playwright/test'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import type { CancellationFlowDialog } from '@e2e/fixtures/components/CancellationFlowDialog'
import {
  CONTROL_ARM_FLOW,
  OFFER_ARM_FLOW
} from '@e2e/fixtures/data/retentionFlow'
import { RetentionFlowMockHelper } from '@e2e/fixtures/helpers/RetentionFlowMockHelper'

test.describe(
  'Cancellation flow from Plan & Credits',
  { tag: '@cloud' },
  () => {
    test.describe.configure({ timeout: 60_000 })
    let retention: RetentionFlowMockHelper
    let flow: CancellationFlowDialog

    test.beforeEach(({ page }) => {
      retention = new RetentionFlowMockHelper(page)
    })

    test.describe('on the offer arm', () => {
      test.beforeEach(async () => {
        flow = await retention.openCancellation(OFFER_ARM_FLOW)
      })

      test('keeps the plan through the offer after the survey', async () => {
        await expect(flow.surveyHeading).toBeVisible()
        await flow.reason('Too expensive').click()
        await flow.continueCancellingButton.click()
        await expect(flow.offerHeading).toBeVisible()
        await flow.acceptOfferButton.click()
        await expect(flow.appliedHeading).toBeVisible()
        await flow.doneButton.click()
        await flow.waitForHidden()

        expect(retention.events).toEqual([
          { session_id: OFFER_ARM_FLOW.session_id, event: 'flow_opened' },
          { session_id: OFFER_ARM_FLOW.session_id, event: 'offer_shown' }
        ])
        expect(retention.acceptRequests).toEqual([
          { session_id: OFFER_ARM_FLOW.session_id }
        ])
        expect(retention.cancelRequests).toHaveLength(0)
      })
    })

    test.describe('with an expired offer session', () => {
      test.beforeEach(async () => {
        flow = await retention.openCancellation(OFFER_ARM_FLOW, 'expired')
      })

      test('withdraws the offer without a retry, then cancels', async () => {
        await flow.continueCancellingButton.click()
        await flow.acceptOfferButton.click()
        await expect(flow.expiredHeading).toBeVisible()
        await expect(flow.retryButton).toHaveCount(0)
        await flow.continueCancellingButton.click()
        await expect(flow.confirmHeading).toBeVisible()
        await flow.confirmCancelButton.click()
        await expect(flow.cancelledHeading).toBeVisible()

        expect(retention.acceptRequests).toHaveLength(1)
        expect(retention.cancelRequests).toHaveLength(1)
      })
    })

    test.describe('on a short viewport', () => {
      test.use({ viewport: { width: 1280, height: 540 } })

      test.beforeEach(async () => {
        flow = await retention.openCancellation(OFFER_ARM_FLOW)
      })

      test('reaches the actions of every step', async () => {
        await flow.reason('Too expensive').click()
        await flow.continueCancellingButton.click()
        await expect(flow.offerHeading).toBeVisible()
        await flow.continueCancellingButton.click()
        await expect(flow.confirmHeading).toBeVisible()
        await flow.confirmCancelButton.click()
        await expect(flow.cancelledHeading).toBeVisible()
        await flow.doneButton.click()
        await flow.waitForHidden()
      })
    })

    test.describe('on the control arm', () => {
      test.beforeEach(async () => {
        flow = await retention.openCancellation(CONTROL_ARM_FLOW)
      })

      test('goes from the survey to the confirmation', async () => {
        await flow.continueCancellingButton.click()
        await expect(flow.confirmHeading).toBeVisible()
        await expect(flow.offerHeading).toHaveCount(0)
        await flow.confirmCancelButton.click()
        await expect(flow.cancelledHeading).toBeVisible()
        await flow.doneButton.click()
        await flow.waitForHidden()

        expect(retention.events).toEqual([
          { session_id: CONTROL_ARM_FLOW.session_id, event: 'flow_opened' }
        ])
        expect(retention.cancelRequests).toHaveLength(1)
      })
    })
  }
)
