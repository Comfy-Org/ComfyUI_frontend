import {
  comfyExpect as expect,
  liveCloudBillingFixture as test
} from '@e2e/fixtures/liveCloudBillingFixture'

test.describe('Real Cloud checkout recovery', { tag: ['@cloud-live'] }, () => {
  test('resumes an abandoned no-card checkout using the same billing operation', async ({
    comfyPage,
    checkout,
    billingSession
  }, testInfo) => {
    const operationId =
      await test.step('Leave the checkout pending', async () => {
        await comfyPage.attachScreenshot('preview.png', { runInCI: true })
        return await checkout.abandonCheckout(testInfo)
      })

    await test.step('See the pending checkout recovery action', async () => {
      await billingSession.expectPending(operationId)
      await expect(checkout.resumePayment).toBeEnabled()
      await comfyPage.attachScreenshot('resume-payment.png', { runInCI: true })
    })

    await test.step('Retry the same checkout', async () => {
      const resumedId = await checkout.abandonCheckout(testInfo, true)
      expect(resumedId).toBe(operationId)
      await expect(checkout.resumePayment).toBeEnabled()
      await billingSession.expectPending(operationId)
    })
  })
})
