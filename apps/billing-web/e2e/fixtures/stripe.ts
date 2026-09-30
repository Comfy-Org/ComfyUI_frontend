/**
 * A fake `js.stripe.com` at the network boundary: enough of `window.Stripe`
 * for `StripePaymentForm` and the embedded-challenge port to run their real
 * code against, without a request ever reaching Stripe. Elements are inert
 * apart from reporting `ready` on the next task; `createConfirmationToken`
 * and `handleNextAction` always succeed, which is all the current specs need —
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
  // A spec sets window.__e2eStripeLoadErrors before load to make that many
  // payment elements report loaderror instead of ready.
  function fakeElement(kind) {
    const failing = kind === 'payment' && (window.__e2eStripeLoadErrors ?? 0) > 0
    if (failing) window.__e2eStripeLoadErrors -= 1
    return {
      mount() {},
      unmount() {},
      destroy() {},
      on(event, handler) {
        if (event === (failing ? 'loaderror' : 'ready'))
          setTimeout(() => handler({ error: { code: 'e2e_load_error' } }))
      }
    }
  }
  function fakeElements() {
    return {
      create: (kind) => fakeElement(kind),
      update: () => Promise.resolve(),
      submit: () => Promise.resolve({})
    }
  }
  window.Stripe = function fakeStripeFactory() {
    return {
      elements: () => fakeElements(),
      // A spec sets window.__e2eStripeMethodType before load to mint a
      // token for a redirect method such as alipay instead of a card.
      createConfirmationToken: () => {
        window.__e2eFakeStripe.confirmationTokens += 1
        return Promise.resolve({
          confirmationToken: {
            id: 'ctok_e2e_fake',
            payment_method_preview: {
              type: window.__e2eStripeMethodType ?? 'card'
            }
          }
        })
      },
      // The intent's next step as Stripe reports it: an in-page challenge,
      // or the redirect a method such as Alipay finishes on.
      retrievePaymentIntent: () =>
        Promise.resolve({
          paymentIntent: {
            status: 'requires_action',
            next_action: {
              type: window.__e2eStripeRedirectTo
                ? 'alipay_handle_redirect'
                : 'use_stripe_sdk'
            }
          }
        }),
      // A spec sets window.__e2eStripeRedirectTo before load to make the
      // challenge leave the page the way a redirect method does, or
      // window.__e2eStripeHoldNextAction to keep it open until the spec
      // settles it through window.__e2eFakeStripe.releaseNextAction, or
      // window.__e2eStripeIntentSettled to reject the way Stripe does for an
      // intent that no longer requires action.
      handleNextAction: (args) => {
        window.__e2eFakeStripe.nextActions += 1
        window.__e2eFakeStripe.nextActionCalls.push(args)
        if (window.__e2eStripeIntentSettled) {
          const error = new Error(
            'handleNextAction: The PaymentIntent supplied is not in the requires_action state.'
          )
          error.name = 'IntegrationError'
          return Promise.reject(error)
        }
        if (window.__e2eStripeRedirectTo) {
          window.location.assign(window.__e2eStripeRedirectTo)
          return new Promise(() => {})
        }
        if (window.__e2eStripeHoldNextAction) {
          return new Promise((resolve) => {
            window.__e2eFakeStripe.releaseNextAction = resolve
          })
        }
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
