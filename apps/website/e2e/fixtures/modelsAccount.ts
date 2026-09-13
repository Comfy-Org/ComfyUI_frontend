import type {
  BillingBalanceResponse,
  ExchangeTokenResponse
} from '@comfyorg/ingest-types'

import { test as base } from './blockExternalMedia'

export const MODEL_PATH = '/models/bfl--flux-2-max--generate-images/'

function jsonRoute(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

export const test = base.extend<{
  modelsAccount: { email: string; password: string }
}>({
  modelsAccount: [
    async ({ context }, use) => {
      const email = 'models-e2e@test.comfy.org'
      await context.route('**/cdn-cgi/trace', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'loc=US\n'
        })
      )
      await context.route('**/t.comfy.org/**', (route) =>
        /\/(flags|decide)\//.test(route.request().url())
          ? route.fulfill(
              jsonRoute({
                featureFlags: { 'workshop-auth': true },
                featureFlagPayloads: {}
              })
            )
          : route.abort('blockedbyclient')
      )
      await context.route('**/api/auth/token', (route) =>
        route.fulfill(
          jsonRoute({
            token: 'mock-workspace-jwt',
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            workspace: {
              id: 'ws-personal',
              name: 'Personal',
              type: 'personal'
            },
            role: 'owner',
            permissions: []
          } satisfies ExchangeTokenResponse)
        )
      )
      await context.route('**/api/billing/balance', (route) =>
        route.fulfill(
          jsonRoute({
            amount_micros: 583_200,
            effective_balance_micros: 583_200,
            currency: 'usd'
          } satisfies BillingBalanceResponse)
        )
      )
      await context.route('**/customers', (route) =>
        route.fulfill(jsonRoute({ id: 'e2e-customer-id' }, 201))
      )
      await context.route('**/identitytoolkit.googleapis.com/**', (route) => {
        if (route.request().url().includes('accounts:signInWithPassword'))
          return route.fulfill(
            jsonRoute({
              localId: 'e2e-models-user',
              email,
              idToken: 'mock-firebase-id-token',
              registered: true,
              refreshToken: 'mock-refresh-token',
              expiresIn: '3600'
            })
          )
        if (route.request().url().includes('accounts:lookup'))
          return route.fulfill(
            jsonRoute({
              users: [
                { localId: 'e2e-models-user', email, emailVerified: true }
              ]
            })
          )
        return route.fallback()
      })
      await context.route('**/securetoken.googleapis.com/**', (route) =>
        route.fulfill(
          jsonRoute({
            access_token: 'mock-firebase-id-token',
            expires_in: '3600',
            token_type: 'Bearer',
            refresh_token: 'mock-refresh-token',
            id_token: 'mock-firebase-id-token',
            user_id: 'e2e-models-user',
            project_id: 'dreamboothy-dev'
          })
        )
      )
      await use({ email, password: 'correct-horse-battery-staple' })
    },
    { auto: true }
  ]
})
