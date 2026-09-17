import {
  abandonCheckout,
  expectPending
} from '@e2e/tests/liveCloud/helpers/unpaidCheckout'
import {
  comfyExpect as expect,
  liveCloudCheckoutFixture as test
} from '@e2e/fixtures/liveCloudCheckoutFixture'

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
          const operationId = await abandonCheckout(checkout, testInfo)
          await expectPending(billingSession, operationId)
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
        const resumedId = await abandonCheckout(checkout, testInfo)
        expect(resumedId).toBe(operationId)
        await expectPending(billingSession, operationId)
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
          const operationId = await abandonCheckout(checkout, testInfo)
          await expectPending(billingSession, operationId)
          return operationId
        })

      const fresh =
        await test.step('Sign in from a fresh browser context', async () => {
          await comfyPage.page.close()
          const fresh = await freshBillingSession()
          await fresh.billingSession.assertNoCardAccount(testInfo)
          await fresh.checkout.open()
          return fresh
        })

      await test.step('Resume the same checkout in the fresh context', async () => {
        const resumedId = await abandonCheckout(fresh.checkout, testInfo)
        expect(resumedId).toBe(operationId)
        await expectPending(fresh.billingSession, operationId)
        await expect(fresh.checkout.resumePayment).toBeEnabled()
        await fresh.comfyPage.attachScreenshot(
          'checkout-in-fresh-context.png',
          { runInCI: true }
        )
      })
    })
  }
)
