/**
 * A fake `js.stripe.com` at the network boundary: enough of `window.Stripe`
 * for `StripePaymentForm` and the embedded-challenge port to run their real
 * code against, without a request ever reaching Stripe. Elements are inert
 * (`mount`/`on`/`destroy` no-ops); `createConfirmationToken` and
 * `handleNextAction` always succeed, which is all the current specs need —
 * a decline or a timeout is modelled on the mocked Cloud's operation, not
 * on the payment provider.
 *
 * Playwright tries the most-recently-added matching route first, so this
 * must be installed after `installMockCloud`'s catch-all `abort` route
 * already exists — install it from a fixture that depends on `cloud`.
 */
import type { BrowserContext } from '@playwright/test'

const FAKE_STRIPE_JS = `
(() => {
  window.__e2eFakeStripe = {
    confirmationTokens: 0,
    nextActions: 0,
    // Every argument the app actually passed to handleNextAction, so a spec
    // can tell "called correctly" from "called with the wrong secret".
    nextActionCalls: []
  }
  function fakeElement() {
    return { mount() {}, unmount() {}, destroy() {}, on() {} }
  }
  function fakeElements() {
    return {
      create: () => fakeElement(),
      update: () => Promise.resolve(),
      submit: () => Promise.resolve({})
    }
  }
  window.Stripe = function fakeStripeFactory() {
    return {
      elements: () => fakeElements(),
      createConfirmationToken: () => {
        window.__e2eFakeStripe.confirmationTokens += 1
        return Promise.resolve({
          confirmationToken: { id: 'ctok_e2e_fake' }
        })
      },
      handleNextAction: (args) => {
        window.__e2eFakeStripe.nextActions += 1
        window.__e2eFakeStripe.nextActionCalls.push(args)
        return Promise.resolve({ paymentIntent: { status: 'succeeded' } })
      }
    }
  }
})()
`

export async function installFakeStripe(
  context: BrowserContext
): Promise<void> {
  await context.route('https://js.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: FAKE_STRIPE_JS
    })
  )
}
