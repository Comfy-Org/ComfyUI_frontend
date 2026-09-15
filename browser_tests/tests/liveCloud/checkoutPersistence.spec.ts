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
      const operationId =
        await test.step('Leave the checkout pending', async () => {
          const operationId = await checkout.abandonCheckout(testInfo)
          await billingSession.expectPending(operationId)
          await expect(checkout.resumePayment).toBeEnabled()
          return operationId
        })

      await test.step('Reload and reopen the checkout', async () => {
        await comfyPage.page.reload()
        await checkout.open()
        await expect(checkout.resumePayment).toBeEnabled()
        await comfyPage.attachScreenshot('checkout-after-reload.png', {
          runInCI: true
        })
      })

      await test.step('Resume the same checkout after reload', async () => {
        const resumedId = await checkout.abandonCheckout(testInfo, true)
        expect(resumedId).toBe(operationId)
        await billingSession.expectPending(operationId)
        await expect(checkout.resumePayment).toBeEnabled()
      })
    })

    test('reuses the pending operation after signing in from a fresh browser context', async ({
      comfyPage,
      checkout,
      billingSession,
      freshBillingSession
    }, testInfo) => {
      const operationId =
        await test.step('Leave the checkout pending', async () => {
          const operationId = await checkout.abandonCheckout(testInfo)
          await billingSession.expectPending(operationId)
          return operationId
        })

      const fresh =
        await test.step('Sign in from a fresh browser context', async () => {
          await comfyPage.page.close()
          const fresh = await freshBillingSession()
          await fresh.billingSession.assertNoCardAccount(testInfo)
          await fresh.billingSession.expectPending(operationId)
          await fresh.checkout.open()
          return fresh
        })

      await test.step('Resume the same checkout in the fresh context', async () => {
        const resumedId = await fresh.checkout.abandonCheckout(testInfo)
        expect(resumedId).toBe(operationId)
        await fresh.billingSession.expectPending(operationId)
        await expect(fresh.checkout.resumePayment).toBeEnabled()
        await fresh.comfyPage.attachScreenshot(
          'checkout-in-fresh-context.png',
          { runInCI: true }
        )
      })
    })
  }
)
