import {
  comfyExpect as expect,
  liveCloudBillingFixture as test
} from '@e2e/fixtures/liveCloudBillingFixture'

test.describe(
  'Real Cloud checkout persistence',
  { tag: ['@cloud-live'] },
  () => {
    test('resumes the same pending checkout after reloading the page', async ({
      comfyPage,
      checkout,
      billingSession
    }, testInfo) => {
      const operationId = await checkout.abandonCheckout(testInfo)
      await billingSession.expectPending(operationId)
      await expect(checkout.resumePayment).toBeEnabled()

      await comfyPage.page.reload()
      await checkout.open()
      await expect(checkout.resumePayment).toBeEnabled()
      await checkout.attachScreenshot('checkout-after-reload.png')

      const resumedId = await checkout.abandonCheckout(testInfo, true)
      expect(resumedId).toBe(operationId)
      await billingSession.expectPending(operationId)
      await expect(checkout.resumePayment).toBeEnabled()
    })

    test('reuses the pending operation after signing in from a fresh browser context', async ({
      comfyPage,
      checkout,
      billingSession,
      freshBillingSession
    }, testInfo) => {
      const operationId = await checkout.abandonCheckout(testInfo)
      await billingSession.expectPending(operationId)
      await comfyPage.page.close()

      const fresh = await freshBillingSession()
      await fresh.billingSession.assertNoCardAccount(testInfo)
      await fresh.billingSession.expectPending(operationId)
      await fresh.checkout.open()

      const resumedId = await fresh.checkout.abandonCheckout(testInfo)
      expect(resumedId).toBe(operationId)
      await fresh.billingSession.expectPending(operationId)
      await expect(fresh.checkout.resumePayment).toBeEnabled()
      await fresh.checkout.attachScreenshot('checkout-in-fresh-context.png')
    })
  }
)
