import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BillingOpStatusResponse,
  SavedPaymentMethod
} from './workspaceApi'

const {
  mockAxiosInstance,
  mockGetWorkspaceAuthHeaderOrThrow,
  mockGetFirebaseAuthHeaderOrThrow
} = vi.hoisted(() => ({
  mockAxiosInstance: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: { response: { use: vi.fn() } }
  },
  mockGetWorkspaceAuthHeaderOrThrow: vi.fn(),
  mockGetFirebaseAuthHeaderOrThrow: vi.fn()
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn((err: unknown) => {
      return (
        err !== null &&
        typeof err === 'object' &&
        'isAxiosError' in err &&
        (err as Record<string, unknown>).isAxiosError === true
      )
    })
  }
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => key)
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `/api${path}`)
  }
}))

vi.mock('./workspaceApiUrl', () => ({
  workspaceApiUrl: (path: string) => `/api${path}`
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getWorkspaceAuthHeaderOrThrow: mockGetWorkspaceAuthHeaderOrThrow,
    getFirebaseAuthHeaderOrThrow: mockGetFirebaseAuthHeaderOrThrow
  })
}))

import { workspaceApi } from './workspaceApi'

const AUTH_HEADER = { Authorization: 'Bearer test-token' }

describe('workspaceApi', () => {
  beforeEach(() => {
    mockGetWorkspaceAuthHeaderOrThrow.mockResolvedValue(AUTH_HEADER)
    mockGetFirebaseAuthHeaderOrThrow.mockResolvedValue(AUTH_HEADER)
  })

  describe('authentication', () => {
    it('propagates error when workspace authentication rejects', async () => {
      const authError = new Error('toastMessages.userNotAuthenticated')
      mockGetWorkspaceAuthHeaderOrThrow.mockRejectedValue(authError)

      await expect(workspaceApi.list()).rejects.toBe(authError)
    })

    it('propagates error when getFirebaseAuthHeaderOrThrow rejects', async () => {
      const authError = new Error('toastMessages.userNotAuthenticated')
      mockGetFirebaseAuthHeaderOrThrow.mockRejectedValue(authError)

      await expect(workspaceApi.acceptInvite('token')).rejects.toBe(authError)
    })
  })

  describe('error handling', () => {
    it('wraps axios errors into WorkspaceApiError', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 403, data: { message: 'Forbidden' } },
        message: 'Request failed'
      }
      mockAxiosInstance.get.mockRejectedValue(axiosErr)

      await expect(workspaceApi.list()).rejects.toMatchObject({
        name: 'WorkspaceApiError',
        status: 403,
        message: 'Forbidden'
      })
    })

    it('falls back to err.message when response data has no message', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 500, data: {} },
        message: 'Network Error'
      }
      mockAxiosInstance.get.mockRejectedValue(axiosErr)

      await expect(workspaceApi.list()).rejects.toMatchObject({
        message: 'Network Error',
        status: 500
      })
    })

    it('carries the typed error code through', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'Already cancelled', code: 'ALREADY_CANCELED' }
        },
        message: 'Request failed'
      }
      mockAxiosInstance.get.mockRejectedValue(axiosErr)

      await expect(workspaceApi.list()).rejects.toMatchObject({
        code: 'ALREADY_CANCELED',
        status: 400
      })
    })

    it('drops a non-string code so callers cannot match on a surprise', async () => {
      const axiosErr = {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Bad', code: { a: 1 } } },
        message: 'Request failed'
      }
      mockAxiosInstance.get.mockRejectedValue(axiosErr)

      await expect(workspaceApi.list()).rejects.toMatchObject({
        code: undefined,
        message: 'Bad'
      })
    })

    it('rethrows non-axios errors as-is', async () => {
      const err = new TypeError('unexpected')
      mockAxiosInstance.get.mockRejectedValue(err)

      await expect(workspaceApi.list()).rejects.toBe(err)
    })
  })

  describe('workspace CRUD', () => {
    it('list() sends GET /workspaces with auth header', async () => {
      const data = { workspaces: [] }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.list()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/workspaces', {
        headers: AUTH_HEADER
      })
      expect(result).toEqual(data)
    })

    it('create() sends POST /workspaces with payload', async () => {
      const workspace = { id: '1', name: 'ws', role: 'owner' }
      mockAxiosInstance.post.mockResolvedValue({ data: workspace })

      const result = await workspaceApi.create({ name: 'ws' })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/workspaces',
        { name: 'ws' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(workspace)
    })

    it('update() sends PATCH /workspaces/:id with payload', async () => {
      const workspace = { id: 'ws-1', name: 'renamed' }
      mockAxiosInstance.patch.mockResolvedValue({ data: workspace })

      const result = await workspaceApi.update('ws-1', { name: 'renamed' })

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/api/workspaces/ws-1',
        { name: 'renamed' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(workspace)
    })

    it('delete() sends DELETE /workspaces/:id', async () => {
      mockAxiosInstance.delete.mockResolvedValue({})

      await workspaceApi.delete('ws-1')

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/workspaces/ws-1',
        {
          headers: AUTH_HEADER
        }
      )
    })

    it('leave() sends POST /workspace/leave', async () => {
      mockAxiosInstance.post.mockResolvedValue({})

      await workspaceApi.leave()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/workspace/leave',
        null,
        { headers: AUTH_HEADER }
      )
    })
  })

  describe('member management', () => {
    it('listMembers() sends GET with params', async () => {
      const data = {
        members: [],
        pagination: { offset: 0, limit: 10, total: 0 }
      }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.listMembers({
        offset: 0,
        limit: 10
      })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/workspace/members',
        {
          headers: AUTH_HEADER,
          params: { offset: 0, limit: 10 }
        }
      )
      expect(result).toEqual(data)
    })

    it('removeMember() sends DELETE /workspace/members/:userId', async () => {
      mockAxiosInstance.delete.mockResolvedValue({})

      await workspaceApi.removeMember('user-42')

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/workspace/members/user-42',
        { headers: AUTH_HEADER }
      )
    })

    it('updateMemberRole() sends PATCH /workspace/members/:userId with the role', async () => {
      const updated = {
        id: 'user-42',
        name: 'Jane',
        email: 'jane@test.comfy.org',
        joined_at: '2025-01-03T00:00:00Z',
        role: 'owner',
        is_original_owner: false
      }
      mockAxiosInstance.patch.mockResolvedValue({ data: updated })

      const result = await workspaceApi.updateMemberRole('user-42', 'owner')

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        '/api/workspace/members/user-42',
        { role: 'owner' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(updated)
    })
  })

  describe('invite management', () => {
    it('listInvites() sends GET /workspace/invites', async () => {
      const data = { invites: [] }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.listInvites()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/workspace/invites',
        {
          headers: AUTH_HEADER
        }
      )
      expect(result).toEqual(data)
    })

    it('createInvite() sends POST /workspace/invites', async () => {
      const invite = { id: 'inv-1', email: 'a@b.com' }
      mockAxiosInstance.post.mockResolvedValue({ data: invite })

      const result = await workspaceApi.createInvite({ email: 'a@b.com' })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/workspace/invites',
        { email: 'a@b.com' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(invite)
    })

    it('revokeInvite() sends DELETE /workspace/invites/:id', async () => {
      mockAxiosInstance.delete.mockResolvedValue({})

      await workspaceApi.revokeInvite('inv-1')

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/api/workspace/invites/inv-1',
        { headers: AUTH_HEADER }
      )
    })

    it('resendInvite() sends POST /workspace/invites/:id/resend', async () => {
      const invite = {
        id: 'inv-1',
        email: 'a@b.com',
        invited_at: '2024-02-01T00:00:00Z',
        expires_at: '2024-02-08T00:00:00Z'
      }
      mockAxiosInstance.post.mockResolvedValue({ data: invite })

      const result = await workspaceApi.resendInvite('inv-1')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/workspace/invites/inv-1/resend',
        null,
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(invite)
    })

    it('acceptInvite() uses firebase auth and POST /invites/:token/accept', async () => {
      const data = { workspace_id: 'ws-1', workspace_name: 'Team' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.acceptInvite('abc-token')

      expect(mockGetFirebaseAuthHeaderOrThrow).toHaveBeenCalled()
      expect(mockGetWorkspaceAuthHeaderOrThrow).not.toHaveBeenCalled()
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/invites/abc-token/accept',
        null,
        { headers: AUTH_HEADER, __skipUnifiedRemint: true }
      )
      expect(result).toEqual(data)
    })
  })

  describe('billing', () => {
    it('getBillingStatus() sends GET /billing/status and returns the body unchanged', async () => {
      const data = { is_active: true, has_funds: true }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingStatus()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/status',
        {
          headers: AUTH_HEADER
        }
      )
      expect(result).toEqual(data)
    })

    it('getBillingBalance() sends GET /billing/balance', async () => {
      const data = { amount_micros: 5000000, currency: 'USD' }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingBalance()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/balance',
        {
          headers: AUTH_HEADER
        }
      )
      expect(result).toEqual(data)
    })

    it('getBillingCapabilities() sends GET /billing/capabilities', async () => {
      const controller = new AbortController()
      const data = {
        resolved_for: { user_id: 'user-1', workspace_id: 'workspace-1' },
        capabilities: {
          can_subscribe_self_serve: true,
          can_top_up: false,
          can_cancel: true,
          can_reactivate: true,
          can_change_seats: true,
          can_invite_members: true,
          can_downgrade_to_personal: false
        }
      }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingCapabilities(
        controller.signal
      )

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/capabilities',
        { headers: AUTH_HEADER, timeout: 10_000, signal: controller.signal }
      )
      expect(result).toEqual(data)
    })

    it('getBillingPlans() sends GET /billing/plans', async () => {
      const data = { plans: [] }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingPlans()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/billing/plans', {
        headers: AUTH_HEADER
      })
      expect(result).toEqual(data)
    })

    it('getChurnkeyAuth() returns validated Stripe-provider credentials', async () => {
      const data = {
        customer_id: 'cus_test_1',
        auth_hash: 'hash-1',
        mode: 'test'
      }
      mockAxiosInstance.get.mockResolvedValue({ data })

      await expect(workspaceApi.getChurnkeyAuth()).resolves.toEqual(data)
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/churnkey/auth',
        { headers: AUTH_HEADER }
      )
    })

    it('getChurnkeyAuth() rejects malformed credentials', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          customer_id: 'cus_test_1',
          auth_hash: '',
          mode: 'test'
        }
      })

      await expect(workspaceApi.getChurnkeyAuth()).rejects.toMatchObject({
        name: 'ZodError'
      })
    })

    it('getChurnkeyAuth() normalizes Axios failures', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 503,
          data: { message: 'Churnkey auth unavailable', code: 'UNAVAILABLE' }
        },
        message: 'Request failed',
        config: { headers: AUTH_HEADER }
      })

      await expect(workspaceApi.getChurnkeyAuth()).rejects.toMatchObject({
        name: 'WorkspaceApiError',
        status: 503,
        code: 'UNAVAILABLE',
        message: 'Churnkey auth unavailable'
      })
    })
  })

  describe('subscription', () => {
    it('listSavedPaymentMethods() returns masked methods from GET', async () => {
      const data: SavedPaymentMethod[] = [
        {
          type: 'card',
          id: 'pm_saved',
          brand: 'visa',
          last4: '4242',
          is_default: true
        }
      ]
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.listSavedPaymentMethods()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/payment-methods',
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('previewSubscribe() sends the promotion code only when applied', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { allowed: true } })

      await workspaceApi.previewSubscribe('pro-monthly', {
        promotionCode: 'SAVE20'
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/preview-subscribe',
        expect.objectContaining({ promotion_code: 'SAVE20' }),
        { headers: AUTH_HEADER }
      )
    })

    it('subscribe() echoes the quote and selected saved method', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { billing_op_id: 'op-quote', status: 'subscribed' }
      })

      await workspaceApi.subscribe('pro-monthly', {
        promotionCode: 'SAVE20',
        quoteId: 'quote_123',
        quoteVersion: 2,
        savedPaymentMethodId: 'pm_saved'
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscribe',
        expect.objectContaining({
          promotion_code: 'SAVE20',
          quote_id: 'quote_123',
          quote_version: 2,
          saved_payment_method_id: 'pm_saved'
        }),
        { headers: AUTH_HEADER }
      )
    })

    it('subscribe() omits a promotion code when none is applied', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { billing_op_id: 'op-no-promo', status: 'subscribed' }
      })

      await workspaceApi.subscribe('pro-monthly')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscribe',
        expect.objectContaining({ promotion_code: undefined }),
        { headers: AUTH_HEADER }
      )
    })

    it('subscribe() rejects mutually exclusive payment credentials', async () => {
      await expect(
        workspaceApi.subscribe('pro-monthly', {
          confirmationToken: 'ctoken_1',
          savedPaymentMethodId: 'pm_saved'
        })
      ).rejects.toThrow(
        'confirmationToken and savedPaymentMethodId are mutually exclusive'
      )

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })

    it('subscribe() omits an empty credential from the request', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: {} })

      await workspaceApi.subscribe('pro-monthly', { confirmationToken: '' })

      const body = mockAxiosInstance.post.mock.calls[0][1]
      expect(body).not.toHaveProperty('confirmation_token', '')
      expect(body.confirmation_token).toBeUndefined()

      mockAxiosInstance.post.mockResolvedValueOnce({ data: {} })
      await workspaceApi.subscribe('pro-monthly', { savedPaymentMethodId: '' })

      const savedBody = mockAxiosInstance.post.mock.calls[1][1]
      expect(savedBody).not.toHaveProperty('saved_payment_method_id', '')
      expect(savedBody.saved_payment_method_id).toBeUndefined()
    })

    it('subscribe() rejects an empty credential alongside a saved one', async () => {
      await expect(
        workspaceApi.subscribe('pro-monthly', {
          confirmationToken: '',
          savedPaymentMethodId: 'pm_saved'
        })
      ).rejects.toThrow(
        'confirmationToken and savedPaymentMethodId are mutually exclusive'
      )

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })

    it('previewSubscribe() sends fields defined by the ingest contract', async () => {
      const data = { allowed: true, transition_type: 'new_subscription' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.previewSubscribe(
        'team_per_credit_annual',
        {
          teamCreditStopId: 'team_700'
        }
      )

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/preview-subscribe',
        {
          plan_slug: 'team_per_credit_annual',
          team_credit_stop_id: 'team_700'
        },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('subscribe() sends POST with plan_slug and optional URLs', async () => {
      const data = { billing_op_id: 'op-1', status: 'subscribed' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.subscribe('pro-monthly', {
        confirmationToken: 'ctoken_1',
        returnUrl: 'https://return.url',
        cancelUrl: 'https://cancel.url'
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscribe',
        {
          plan_slug: 'pro-monthly',
          confirmation_token: 'ctoken_1',
          return_url: 'https://return.url',
          cancel_url: 'https://cancel.url',
          team_credit_stop_id: undefined,
          billing_cycle: undefined
        },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('subscribe() sends team_credit_stop_id and billing_cycle for team plans', async () => {
      const data = { billing_op_id: 'op-1b', status: 'needs_payment_method' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.subscribe('team_per_credit_annual', {
        teamCreditStopId: 'team_700',
        billingCycle: 'yearly'
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscribe',
        {
          plan_slug: 'team_per_credit_annual',
          confirmation_token: undefined,
          return_url: undefined,
          cancel_url: undefined,
          team_credit_stop_id: 'team_700',
          billing_cycle: 'yearly'
        },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('subscribe() sends confirm_reactivation when reactivating a cancelled subscription', async () => {
      const data = { billing_op_id: 'op-1c', status: 'subscribed' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.subscribe('pro-monthly', {
        confirmReactivation: true,
        prorationAt: '2026-07-29T12:00:00Z'
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscribe',
        expect.objectContaining({
          plan_slug: 'pro-monthly',
          confirm_reactivation: true,
          proration_at: '2026-07-29T12:00:00Z'
        }),
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('cancelSubscription() sends POST with idempotency_key', async () => {
      const data = { billing_op_id: 'op-2', cancel_at: '2026-05-01' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.cancelSubscription('key-1')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscription/cancel',
        { idempotency_key: 'key-1' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('resubscribe() sends POST /billing/subscription/resubscribe', async () => {
      const data = { billing_op_id: 'op-3', status: 'active' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.resubscribe('key-2')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscription/resubscribe',
        { idempotency_key: 'key-2' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })
  })

  describe('payment', () => {
    it('getPaymentPortalUrl() sends POST with return_url', async () => {
      const data = { url: 'https://stripe.com/portal' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.getPaymentPortalUrl(
        'https://app.com/settings'
      )

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/payment-portal',
        { return_url: 'https://app.com/settings' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('createTopup() sends POST with amount_cents and idempotency_key', async () => {
      const data = {
        billing_op_id: 'op-4',
        topup_id: 'top-1',
        status: 'pending',
        amount_cents: 1000
      }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.createTopup(1000, 'key-3')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/topup',
        { amount_cents: 1000, idempotency_key: 'key-3' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })
  })

  describe('billing events', () => {
    it('getBillingEvents() sends GET with params', async () => {
      const data = { total: 0, events: [], page: 1, limit: 10, totalPages: 0 }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingEvents({
        page: 1,
        limit: 10
      })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/events',
        {
          headers: AUTH_HEADER,
          params: { page: 1, limit: 10 }
        }
      )
      expect(result).toEqual(data)
    })

    it('getBillingOpStatus() sends GET /billing/ops/:id', async () => {
      const data = {
        id: 'op-1',
        status: 'pending',
        authentication_state: 'failed_retryable',
        decline_reason: 'card_declined',
        payment_intent_client_secret: 'pi_secret_current',
        started_at: '2026-01-01T00:00:00Z'
      } satisfies BillingOpStatusResponse
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingOpStatus('op-1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/ops/op-1',
        {
          headers: AUTH_HEADER,
          timeout: 30_000
        }
      )
      expect(result).toEqual(data)
    })
  })
})
