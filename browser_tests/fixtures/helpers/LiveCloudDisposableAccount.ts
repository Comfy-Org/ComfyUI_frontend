import { randomUUID } from 'node:crypto'

import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

const firebaseApiKey = 'AIzaSyDa_YMeyzV0SkVe92vBZ1tVikWBmOU5KVE'

const signUpResponseSchema = z.object({ localId: z.string().min(1) })

export async function createDisposableCloudAccount(request: APIRequestContext) {
  const runId = randomUUID()
  const credentials = {
    email: `billing-e2e-checkout-completion-${runId}@comfy.org`,
    password: `BillingE2E-${randomUUID()}!`
  }
  const response = await request
    .post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
      {
        data: {
          ...credentials,
          returnSecureToken: true
        }
      }
    )
    .catch(() => {
      throw new Error('Disposable Cloud account creation failed')
    })
  expect(response.status(), 'Firebase account creation').toBe(200)
  const account = signUpResponseSchema.parse(await response.json())
  return { ...credentials, userId: account.localId }
}
