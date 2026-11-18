import { createBillingApi } from '@comfyorg/billing-core'
import type { SubscribeOptions } from '@comfyorg/billing-core'
import axios from 'axios'
import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'

function createClient() {
  const adapter = vi.fn<AxiosAdapter>(async (config) => ({
    config,
    data: { billing_op_id: 'op-subscribe', status: 'subscribed' },
    status: 200,
    statusText: 'OK',
    headers: {}
  }))
  const api = createBillingApi({
    client: axios.create({ adapter }),
    requestAuth: async () => ({ headers: { Authorization: 'Bearer test' } }),
    resolveUrl: (path) => `https://billing.example${path}`,
    handleError: (error) => {
      throw error
    },
    trackBillingEvent: vi.fn()
  })
  return { api, adapter }
}

describe('billing client payment credentials', () => {
  it.for([
    {
      options: { confirmationToken: 'ctoken_selected' },
      credentials: { confirmation_token: 'ctoken_selected' }
    },
    {
      options: { savedPaymentMethodId: 'pm_saved' },
      credentials: { saved_payment_method_id: 'pm_saved' }
    },
    {
      options: { confirmationToken: '', savedPaymentMethodId: 'pm_saved' },
      credentials: { saved_payment_method_id: 'pm_saved' }
    },
    {
      options: {
        confirmationToken: 'ctoken_selected',
        savedPaymentMethodId: ''
      },
      credentials: { confirmation_token: 'ctoken_selected' }
    },
    { options: { confirmationToken: '' }, credentials: {} },
    { options: { savedPaymentMethodId: '' }, credentials: {} }
  ] satisfies { options: SubscribeOptions; credentials: object }[])(
    'serializes only usable credentials from $options',
    async ({ options, credentials }) => {
      const { api, adapter } = createClient()

      await expect(api.subscribe('pro-monthly', options)).resolves.toEqual({
        billing_op_id: 'op-subscribe',
        status: 'subscribed'
      })

      expect(JSON.parse(String(adapter.mock.calls[0][0].data))).toEqual({
        plan_slug: 'pro-monthly',
        ...credentials
      })
    }
  )

  it('rejects ambiguous credentials before sending a request', async () => {
    const { api, adapter } = createClient()

    await expect(
      api.subscribe('pro-monthly', {
        confirmationToken: 'ctoken_selected',
        savedPaymentMethodId: 'pm_saved'
      })
    ).rejects.toThrow(
      'confirmationToken and savedPaymentMethodId are mutually exclusive'
    )
    expect(adapter).not.toHaveBeenCalled()
  })
})
