import { randomUUID } from 'node:crypto'

import { expect } from '@playwright/test'
import {
  zCreateTopupCheckoutResponse,
  zExchangeTokenResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import { modelCases } from './cases'
import { runAndVerify, test, useOwnInputs } from './fixtures'
import { expectedCharge, liveSettings, requiredSetting } from './settings'

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
        response.ok()
    )
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    const identity = zExchangeTokenResponse.parse(await (await session).json())
    expect(identity.role).toBe('owner')
    expect(identity.workspace.type).toBe('personal')
    await expect(page).toHaveURL(new URL(path, liveSettings().site).href)
    await expect(page.getByTestId(`field-${model.promptField}`)).toHaveValue(
      model.prompt
    )
    await expect.poll(() => billing.balance()).toBe(0)
    await page.getByTestId('run-button').click()
    await expect(page.getByTestId('buy-credits-dialog')).toBeVisible()
    await page.getByTestId('buy-credits-pack-10').click()
    const checkoutResponse = page.waitForResponse(
      (response) =>
        response.url() ===
          `${liveSettings().cloud}/api/billing/topup/checkout` && response.ok()
    )
    const popup = page.waitForEvent('popup')
    await page.getByTestId('buy-credits-continue').click()
    const checkout = zCreateTopupCheckoutResponse.parse(
      await (await checkoutResponse).json()
    )
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
    await expect
      .poll(() => billing.balance(), { timeout: 120_000 })
      .toBe(10_000_000)
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
        creditedMicros: 10_000_000
      })
    })
  })
}
