import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAxiosInstance,
  mockGetAuthHeaderOrThrow,
  mockGetFirebaseAuthHeaderOrThrow
} = vi.hoisted(() => ({
  mockAxiosInstance: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  },
  mockGetAuthHeaderOrThrow: vi.fn(),
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

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getAuthHeaderOrThrow: mockGetAuthHeaderOrThrow,
    getFirebaseAuthHeaderOrThrow: mockGetFirebaseAuthHeaderOrThrow
  })
}))

import { workspaceApi } from './workspaceApi'

const AUTH_HEADER = { Authorization: 'Bearer test-token' }

describe('workspaceApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthHeaderOrThrow.mockResolvedValue(AUTH_HEADER)
    mockGetFirebaseAuthHeaderOrThrow.mockResolvedValue(AUTH_HEADER)
  })

  describe('authentication', () => {
    it('propagates error when getAuthHeaderOrThrow rejects', async () => {
      const authError = new Error('toastMessages.userNotAuthenticated')
      mockGetAuthHeaderOrThrow.mockRejectedValue(authError)

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

    it('acceptInvite() uses firebase auth and POST /invites/:token/accept', async () => {
      const data = { workspace_id: 'ws-1', workspace_name: 'Team' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.acceptInvite('abc-token')

      expect(mockGetFirebaseAuthHeaderOrThrow).toHaveBeenCalled()
      expect(mockGetAuthHeaderOrThrow).not.toHaveBeenCalled()
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/invites/abc-token/accept',
        null,
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })
  })

  describe('billing', () => {
    it('getBillingStatus() sends GET /billing/status', async () => {
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

    it('getBillingPlans() sends GET /billing/plans', async () => {
      const data = { plans: [] }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingPlans()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/billing/plans', {
        headers: AUTH_HEADER
      })
      expect(result).toEqual(data)
    })
  })

  describe('subscription', () => {
    it('previewSubscribe() sends POST with plan_slug', async () => {
      const data = { allowed: true, transition_type: 'new_subscription' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.previewSubscribe('pro-monthly')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/preview-subscribe',
        { plan_slug: 'pro-monthly' },
        { headers: AUTH_HEADER }
      )
      expect(result).toEqual(data)
    })

    it('subscribe() sends POST with plan_slug and optional URLs', async () => {
      const data = { billing_op_id: 'op-1', status: 'subscribed' }
      mockAxiosInstance.post.mockResolvedValue({ data })

      const result = await workspaceApi.subscribe(
        'pro-monthly',
        'https://return.url',
        'https://cancel.url'
      )

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/billing/subscribe',
        {
          plan_slug: 'pro-monthly',
          return_url: 'https://return.url',
          cancel_url: 'https://cancel.url'
        },
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
        status: 'succeeded',
        started_at: '2026-01-01'
      }
      mockAxiosInstance.get.mockResolvedValue({ data })

      const result = await workspaceApi.getBillingOpStatus('op-1')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/billing/ops/op-1',
        {
          headers: AUTH_HEADER
        }
      )
      expect(result).toEqual(data)
    })
  })
})
