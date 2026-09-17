import {
  abandonCheckout,
  expectPending
} from '@e2e/tests/liveCloud/helpers/unpaidCheckout'
import {
  comfyExpect as expect,
  liveCloudCheckoutFixture as test
} from '@e2e/fixtures/liveCloudCheckoutFixture'

test.describe('Real Cloud checkout recovery', { tag: ['@cloud-live'] }, () => {
  test('resumes an abandoned no-card checkout using the same billing operation', async ({
    comfyPage,
    checkout,
    billingSession
  }, testInfo) => {
    const operationId =
      await test.step('Leave the checkout pending', async () => {
        await comfyPage.attachScreenshot('preview.png', { runInCI: true })
        return await abandonCheckout(checkout, testInfo)
      })

    await test.step('See the pending checkout recovery action', async () => {
      await expectPending(billingSession, operationId)
      await expect(checkout.resumePayment).toBeEnabled()
      await comfyPage.attachScreenshot('resume-payment.png', { runInCI: true })
    })

    await test.step('Retry the same checkout', async () => {
      const resumedId = await abandonCheckout(checkout, testInfo)
      expect(resumedId).toBe(operationId)
      await expect(checkout.resumePayment).toBeEnabled()
      await expectPending(billingSession, operationId)
    })
  })
})
