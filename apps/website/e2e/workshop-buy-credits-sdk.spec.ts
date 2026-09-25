import { expect } from '@playwright/test'

import {
  CHECKOUT_CREATED,
  CHECKOUT_NOT_DEPLOYED,
  CLOUD_CREDITS_URL,
  FEATURES_FLAG_OFF,
  FEATURES_FLAG_ON,
  FEATURES_UNAVAILABLE,
  STRIPE_CHECKOUT_URL,
  buyFiftyDollars,
  describeCheckoutPost,
  openBuyCredits,
  signIn,
  stubBuyCredits
} from './fixtures/buyCredits'
import { test } from './fixtures/modelsAccount'

const WORKSHOP_RETURN_URL =
  '<origin>/checkout-return?workshopTopUpReturn=<attempt>'

test.describe('Buy credits across billing_sdk_topup_enabled', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  for (const scenario of [
    {
      name: 'the site issues the checkout request while the flag is off',
      features: FEATURES_FLAG_OFF,
      expected: {
        featureReads: 1,
        capabilityReads: 0,
        checkoutPosts: [
          {
            method: 'POST',
            authorization: 'Bearer mock-workspace-jwt',
            sendsIdempotencyKeyHeader: false,
            headerEchoesBodyKey: false,
            carriesIdempotencyKey: true,
            amountCents: 5000,
            returnUrl: WORKSHOP_RETURN_URL
          }
        ]
      }
    },
    {
      name: 'the billing SDK issues the checkout request while the flag is on',
      features: FEATURES_FLAG_ON,
      expected: {
        featureReads: 1,
        capabilityReads: 1,
        checkoutPosts: [
          {
            method: 'POST',
            authorization: 'Bearer mock-workspace-jwt',
            sendsIdempotencyKeyHeader: true,
            headerEchoesBodyKey: true,
            carriesIdempotencyKey: true,
            amountCents: 5000,
            returnUrl: WORKSHOP_RETURN_URL
          }
        ]
      }
    },
    {
      name: 'the site issues the checkout request when the flag read fails',
      features: FEATURES_UNAVAILABLE,
      expected: {
        featureReads: 1,
        capabilityReads: 0,
        checkoutPosts: [
          {
            method: 'POST',
            authorization: 'Bearer mock-workspace-jwt',
            sendsIdempotencyKeyHeader: false,
            headerEchoesBodyKey: false,
            carriesIdempotencyKey: true,
            amountCents: 5000,
            returnUrl: WORKSHOP_RETURN_URL
          }
        ]
      }
    }
  ]) {
    test(scenario.name, async ({ page, context, modelsAccount }) => {
      const traffic = await stubBuyCredits(context, {
        features: scenario.features,
        checkout: CHECKOUT_CREATED
      })

      await signIn(page, modelsAccount)
      await openBuyCredits(page)
      const checkoutTab = await buyFiftyDollars(page)

      const openCheckout = page.getByTestId('buy-credits-open-checkout')
      await expect(openCheckout).toBeVisible()
      await expect(openCheckout).toHaveAttribute('href', STRIPE_CHECKOUT_URL)
      await expect.poll(() => checkoutTab.url()).toBe(STRIPE_CHECKOUT_URL)

      const origin = new URL(page.url()).origin
      expect({
        featureReads: traffic.featureReads.length,
        capabilityReads: traffic.capabilityReads.length,
        checkoutPosts: traffic.checkoutPosts.map((post) =>
          describeCheckoutPost(origin, post)
        )
      }).toEqual(scenario.expected)
    })
  }

  test('falls back to the site request when the hosted route is missing', async ({
    page,
    context,
    modelsAccount
  }) => {
    const traffic = await stubBuyCredits(context, {
      features: FEATURES_FLAG_ON,
      checkout: CHECKOUT_NOT_DEPLOYED
    })

    await signIn(page, modelsAccount)
    await openBuyCredits(page)
    const checkoutTab = await buyFiftyDollars(page)

    const openCheckout = page.getByTestId('buy-credits-open-checkout')
    await expect(openCheckout).toBeVisible()
    await expect(openCheckout).toHaveAttribute('href', CLOUD_CREDITS_URL)
    await expect.poll(() => checkoutTab.url()).toBe(CLOUD_CREDITS_URL)

    const origin = new URL(page.url()).origin
    expect(
      traffic.checkoutPosts.map((post) => describeCheckoutPost(origin, post))
    ).toEqual([
      {
        method: 'POST',
        authorization: 'Bearer mock-workspace-jwt',
        sendsIdempotencyKeyHeader: true,
        headerEchoesBodyKey: true,
        carriesIdempotencyKey: true,
        amountCents: 5000,
        returnUrl: WORKSHOP_RETURN_URL
      },
      {
        method: 'POST',
        authorization: 'Bearer mock-workspace-jwt',
        sendsIdempotencyKeyHeader: false,
        headerEchoesBodyKey: false,
        carriesIdempotencyKey: true,
        amountCents: 5000,
        returnUrl: WORKSHOP_RETURN_URL
      },
      {
        method: 'POST',
        authorization: 'Bearer mock-workspace-jwt',
        sendsIdempotencyKeyHeader: false,
        headerEchoesBodyKey: false,
        carriesIdempotencyKey: true,
        amountCents: 5000,
        returnUrl: CLOUD_CREDITS_URL
      }
    ])
  })

  test('reads the flag once a session, and never before a checkout starts', async ({
    page,
    context,
    modelsAccount
  }) => {
    const traffic = await stubBuyCredits(context, {
      features: FEATURES_FLAG_ON,
      checkout: CHECKOUT_NOT_DEPLOYED
    })

    await signIn(page, modelsAccount)
    await openBuyCredits(page)
    expect(traffic.featureReads).toHaveLength(0)

    await buyFiftyDollars(page)
    await expect(page.getByTestId('buy-credits-open-checkout')).toBeVisible()
    expect(traffic.featureReads).toHaveLength(1)

    await page.getByTestId('buy-credits-checkout-close').click()
    await openBuyCredits(page)
    await buyFiftyDollars(page)
    await expect(page.getByTestId('buy-credits-open-checkout')).toBeVisible()

    expect({
      featureReads: traffic.featureReads.length,
      checkoutPosts: traffic.checkoutPosts.length
    }).toEqual({ featureReads: 1, checkoutPosts: 6 })
  })
})
