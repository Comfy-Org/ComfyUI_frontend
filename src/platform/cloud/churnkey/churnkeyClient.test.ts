import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChurnkeyAuthResponse } from '@/platform/workspace/api/workspaceApi'

import { ChurnkeyAuthUnavailableError, ChurnkeyEmbedLoadError } from './errors'
import type { ChurnkeyWindow } from './types'

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getChurnkeyAuth: vi.fn()
  }
}))

const featureFlags = vi.hoisted(() => ({ churnkeyAppId: '' }))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: featureFlags })
}))

const { workspaceApi } = await import('@/platform/workspace/api/workspaceApi')
const { isChurnkeyConfigured, prepareChurnkey } =
  await import('./churnkeyClient')

const getChurnkeyAuth = vi.mocked(workspaceApi.getChurnkeyAuth)

type ChurnkeyInit = NonNullable<ChurnkeyWindow['init']>

const AUTH_RESPONSE = {
  customer_id: 'cus_123',
  auth_hash: 'hash_abc',
  mode: 'test'
} as const

describe('churnkeyClient', () => {
  beforeEach(() => {
    featureFlags.churnkeyAppId = 'app-test-123'
    getChurnkeyAuth.mockReset()
  })

  afterEach(() => {
    delete window.churnkey
    vi.restoreAllMocks()
  })

  it('reports isConfigured=false when the churnkey_app_id flag is unset', () => {
    featureFlags.churnkeyAppId = ''
    expect(isChurnkeyConfigured()).toBe(false)
  })

  it('reports isConfigured=true when the churnkey_app_id flag is set', () => {
    featureFlags.churnkeyAppId = 'app-from-flag'
    expect(isChurnkeyConfigured()).toBe(true)
  })

  it('rejects when the churnkey_app_id flag is unset', async () => {
    featureFlags.churnkeyAppId = ''
    await expect(prepareChurnkey()).rejects.toThrow(
      'Churnkey is not configured'
    )
  })

  it('rejects with ChurnkeyAuthUnavailableError when getChurnkeyAuth returns null', async () => {
    window.churnkey = { init: vi.fn<ChurnkeyInit>() }
    getChurnkeyAuth.mockResolvedValue(null)

    await expect(prepareChurnkey()).rejects.toBeInstanceOf(
      ChurnkeyAuthUnavailableError
    )
  })

  it('uses the dev auth override instead of the backend endpoint when set', async () => {
    const init = vi.fn<ChurnkeyInit>()
    window.churnkey = { init }
    const windowWithAuth = window as {
      __CHURNKEY_AUTH_OVERRIDE__?: ChurnkeyAuthResponse
    }
    windowWithAuth.__CHURNKEY_AUTH_OVERRIDE__ = {
      customer_id: 'cus_dev',
      auth_hash: 'dev-hash',
      mode: 'sandbox'
    }

    try {
      const session = await prepareChurnkey()
      void session.show({})

      expect(getChurnkeyAuth).not.toHaveBeenCalled()
      expect(init.mock.calls[0][1]).toMatchObject({
        customerId: 'cus_dev',
        authHash: 'dev-hash',
        mode: 'sandbox'
      })
    } finally {
      delete windowWithAuth.__CHURNKEY_AUTH_OVERRIDE__
    }
  })

  it('forwards customer credentials and provider config to churnkey.init', async () => {
    const init = vi.fn<ChurnkeyInit>()
    window.churnkey = { init }
    getChurnkeyAuth.mockResolvedValue(AUTH_RESPONSE)

    const onCancel = vi.fn()
    const session = await prepareChurnkey()
    const shown = session.show({
      onCancel,
      customerAttributes: { tier: 'PRO', cycle: 'MONTHLY' }
    })

    expect(init).toHaveBeenCalledTimes(1)
    const [action, config] = init.mock.calls[0]
    expect(action).toBe('show')
    expect(config).toMatchObject({
      appId: 'app-test-123',
      authHash: 'hash_abc',
      customerId: 'cus_123',
      provider: 'stripe',
      mode: 'test',
      customerAttributes: { tier: 'PRO', cycle: 'MONTHLY' }
    })
    // No handleCancel - Churnkey handles the Stripe cancellation itself.
    expect(config.handleCancel).toBeUndefined()

    config.onCancel?.('cus_123', 'too_expensive')
    expect(onCancel).toHaveBeenCalledWith('too_expensive')

    config.onClose?.({ status: 'closed' })
    await expect(shown).resolves.toEqual({ status: 'closed' })
  })

  it('adapts handleCancel to drop the customer argument', async () => {
    const init = vi.fn<ChurnkeyInit>()
    window.churnkey = { init }
    getChurnkeyAuth.mockResolvedValue(AUTH_RESPONSE)

    const handleCancel = vi.fn(async () => ({ message: 'ok' }))
    const session = await prepareChurnkey()
    void session.show({ handleCancel })

    const [, config] = init.mock.calls[0]
    await config.handleCancel?.('cus_123', 'too_expensive', 'feedback')
    expect(handleCancel).toHaveBeenCalledWith('too_expensive', 'feedback')
  })

  it('clears Churnkey session state when the modal closes', async () => {
    const init = vi.fn<ChurnkeyInit>()
    const clearState = vi.fn()
    window.churnkey = { init, clearState }
    getChurnkeyAuth.mockResolvedValue(AUTH_RESPONSE)

    const session = await prepareChurnkey()
    const shown = session.show({})

    init.mock.calls[0][1].onClose?.({ status: 'closed' })
    await shown
    expect(clearState).toHaveBeenCalledTimes(1)
  })

  it('rejects show() when churnkey.init throws', async () => {
    window.churnkey = {
      init: vi.fn<ChurnkeyInit>(() => {
        throw new Error('init exploded')
      })
    }
    getChurnkeyAuth.mockResolvedValue(AUTH_RESPONSE)

    const session = await prepareChurnkey()
    await expect(session.show({})).rejects.toThrow('init exploded')
  })

  it('passes the churnkey_app_id flag value as the init config appId', async () => {
    const init = vi.fn<ChurnkeyInit>()
    window.churnkey = { init }
    featureFlags.churnkeyAppId = 'app-from-flag'
    getChurnkeyAuth.mockResolvedValue(AUTH_RESPONSE)

    const session = await prepareChurnkey()
    void session.show({})

    expect(init.mock.calls[0][1]).toMatchObject({ appId: 'app-from-flag' })
  })

  describe('embed script loading', () => {
    function interceptInjectedScripts(): HTMLScriptElement[] {
      const scripts: HTMLScriptElement[] = []
      vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
        scripts.push(...(nodes as HTMLScriptElement[]))
      })
      return scripts
    }

    it('rejects with ChurnkeyEmbedLoadError when the script fails to load', async () => {
      const scripts = interceptInjectedScripts()

      const prepare = prepareChurnkey()
      expect(scripts).toHaveLength(1)
      scripts[0].onerror?.(new Event('error'))

      await expect(prepare).rejects.toBeInstanceOf(ChurnkeyEmbedLoadError)
      expect(getChurnkeyAuth).not.toHaveBeenCalled()
    })

    it('retries the script load on the next launch after a failure', async () => {
      const scripts = interceptInjectedScripts()

      const first = prepareChurnkey()
      scripts[0].onerror?.(new Event('error'))
      await expect(first).rejects.toBeInstanceOf(ChurnkeyEmbedLoadError)

      const second = prepareChurnkey()
      expect(scripts).toHaveLength(2)
      scripts[1].onerror?.(new Event('error'))
      await expect(second).rejects.toBeInstanceOf(ChurnkeyEmbedLoadError)
    })

    it('rejects with ChurnkeyEmbedLoadError when the script loads without defining init', async () => {
      const scripts = interceptInjectedScripts()

      const prepare = prepareChurnkey()
      scripts[0].onload?.call(scripts[0], new Event('load'))

      await expect(prepare).rejects.toBeInstanceOf(ChurnkeyEmbedLoadError)
    })

    it('proceeds to auth once the loaded script provides init', async () => {
      const scripts = interceptInjectedScripts()
      getChurnkeyAuth.mockResolvedValue(AUTH_RESPONSE)

      const prepare = prepareChurnkey()
      expect(scripts[0].src).toContain('appId=app-test-123')
      window.churnkey!.init = vi.fn<ChurnkeyInit>()
      scripts[0].onload?.call(scripts[0], new Event('load'))

      const session = await prepare
      expect(getChurnkeyAuth).toHaveBeenCalledTimes(1)
      expect(session.show).toBeTypeOf('function')
    })
  })
})
