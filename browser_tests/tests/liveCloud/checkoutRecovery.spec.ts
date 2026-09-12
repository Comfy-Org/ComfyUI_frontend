import {
  comfyExpect as expect,
  liveCloudBillingFixture as test
} from '@e2e/fixtures/liveCloudBillingFixture'

test.describe('Real Cloud checkout recovery', { tag: ['@cloud-live'] }, () => {
  test('resumes an abandoned no-card checkout using the same billing operation', async ({
    checkout,
    billingSession
  }, testInfo) => {
    await checkout.attachScreenshot('preview.png')
    const operationId = await checkout.abandonCheckout(testInfo)
    await billingSession.expectPending(operationId)
    await expect(checkout.resumePayment).toBeEnabled()
    await checkout.attachScreenshot('resume-payment.png')

    const resumedId = await checkout.abandonCheckout(testInfo, true)
    expect(resumedId).toBe(operationId)
    await expect(checkout.resumePayment).toBeEnabled()
    await billingSession.expectPending(operationId)
  })
})
