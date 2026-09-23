import { randomUUID } from 'node:crypto'

import {
  zCreateTopupCheckoutResponse,
  zExchangeTokenResponse
} from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { modelCases } from '../../acceptance/cases'
import {
  runAndVerify,
  test,
  useOwnInputs,
  waitForBalance
} from '../../acceptance/fixtures'
import {
  expectedCharge,
  liveSettings,
  requiredSetting
} from '../../acceptance/settings'

const topupDollars = 10

for (const model of modelCases.filter((model) => model.smoke)) {
  test(`${model.slug}: new visitor signs up, pays, and receives a result`, async ({
    page,
    billing
  }, testInfo) => {
    expect(
      liveSettings().environment,
      'Checkout acceptance requires the payment sandbox'
    ).toBe('test')
    expectedCharge(model.slug, 'own')
    const domain = requiredSetting('WORKSHOP_SIGNUP_EMAIL_DOMAIN')
    const email = z.string().email().parse(`workshop-${randomUUID()}@${domain}`)
    const path = `/models/${model.slug}/`
    await page.goto(path)
    await useOwnInputs(page, model)
    await page.getByTestId('run-button').click()
    await page.getByRole('link', { name: 'Sign up', exact: true }).click()
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(email)
    await page
      .getByLabel('Password', { exact: true })
      .fill(requiredSetting('WORKSHOP_SIGNUP_PASSWORD'))
    await page
      .getByLabel('Confirm Password', { exact: true })
      .fill(requiredSetting('WORKSHOP_SIGNUP_PASSWORD'))
    const session = page.waitForResponse(
      (response) =>
        response.url() === `${liveSettings().cloud}/api/auth/token` &&
        response.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    const tokenResponse = await session
    expect(
      tokenResponse.ok(),
      `Token exchange HTTP ${tokenResponse.status()}`
    ).toBe(true)
    const identity = zExchangeTokenResponse.parse(await tokenResponse.json())
    expect(identity.role).toBe('owner')
    expect(identity.workspace.type).toBe('personal')
    await expect(page).toHaveURL(new URL(path, liveSettings().site).href)
    await expect(page.getByTestId(`field-${model.promptField}`)).toHaveValue(
      model.prompt
    )
    await waitForBalance(billing.balance, 0)
    await page.getByTestId('run-button').click()
    await expect(page.getByTestId('buy-credits-dialog')).toBeVisible()
    await page.getByTestId(`buy-credits-pack-${topupDollars}`).click()
    const checkoutResponse = page.waitForResponse(
      (response) =>
        response.url() ===
          `${liveSettings().cloud}/api/billing/topup/checkout` &&
        response.request().method() === 'POST'
    )
    const popup = page.waitForEvent('popup')
    await page.getByTestId('buy-credits-continue').click()
    const response = await checkoutResponse
    expect(response.ok(), `Checkout HTTP ${response.status()}`).toBe(true)
    const checkout = zCreateTopupCheckoutResponse.parse(await response.json())
    expect(checkout.session_id).toMatch(/^cs_test_/)
    expect(new URL(checkout.checkout_url).origin).toBe(
      'https://checkout.stripe.com'
    )
    const payment = await popup
    await expect(payment).toHaveURL(checkout.checkout_url)
    await payment
      .getByLabel('Card number', { exact: true })
      .fill('4242424242424242')
    await payment.getByLabel('Expiration', { exact: true }).fill('1235')
    await payment.getByLabel('CVC', { exact: true }).fill('123')
    await payment
      .getByLabel('Cardholder name', { exact: true })
      .fill('Workshop Acceptance')
    await payment.getByRole('button', { name: /^Pay/ }).click()
    await waitForBalance(billing.balance, topupDollars * 100)
    await expect(page.getByTestId('buy-credits-resume')).toBeVisible({
      timeout: 120_000
    })
    await page.getByTestId('buy-credits-resume').click()
    await expect(page.getByTestId(`field-${model.promptField}`)).toHaveValue(
      model.prompt
    )
    await runAndVerify(page, billing, model, 'own', testInfo)
    await testInfo.attach('purchase', {
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: checkout.session_id,
        creditedCents: topupDollars * 100
      })
    })
  })
}
