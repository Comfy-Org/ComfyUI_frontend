# Billing web browser tests

Use `test` and `expect` from `./fixtures/test`, not `@playwright/test`. Its
`cloud` fixture is automatic: before a page loads anything, the Firebase
identity endpoints, the Cloud token exchange and every billing route are
answered from `fixtures/cloud.ts`, and any other origin is refused. A spec that
passes here has not contacted a real service.

`cloud.scenario` is what the mocked Cloud holds — status, balance,
capabilities, the plan catalog, saved cards, the subscription preview and
operation states. Change it before navigating, or from a `cloud.reply` handler
to model a mutation the server would make. `cloud.requests` records every
billing and token request for assertions on what the app sent.

`signIn(path)` opens an entry link, goes through the email form against the
mocked identity, and resolves once the app is back on that link.

The app under test is a production build with the `test` Cloud family, a
Firebase project that exists only in these fixtures, and a fake Stripe
publishable key (`fixtures/env.ts`) so the embedded checkout can mount.
Nothing from a local `.env` reaches it. Real Stripe.js is never loaded:
`fixtures/stripe.ts`'s `installFakeStripe` fakes `js.stripe.com` for specs
that submit a payment (see `checkout.spec.ts`); other specs never reach the
checkout form's payment-method-configuration gate, so they never call
`loadStripe` in the first place.

```sh
pnpm --filter @comfyorg/billing-web test:e2e
pnpm --filter @comfyorg/billing-web test:e2e:local   # one worker, trace and video on
```
