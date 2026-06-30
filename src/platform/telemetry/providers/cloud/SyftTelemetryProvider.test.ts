import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCurrentUser = vi.hoisted(() => ({
  userEmail: { value: undefined as string | undefined },
  useCurrentUser: vi.fn()
}))

const mockRemoteConfig = vi.hoisted(() => ({
  value: {} as { syftdata_source_id?: string }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: mockCurrentUser.useCurrentUser
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mockRemoteConfig
}))

const SYFT_SRC = 'https://cdn.sy-d.io/syftnext/syft.umd.js'

async function importProvider() {
  const { SyftTelemetryProvider } =
    await import('@/platform/telemetry/providers/cloud/SyftTelemetryProvider')
  return SyftTelemetryProvider
}

function installSyftSpy(): SyftDataClient {
  const syft = {
    identify: vi.fn(),
    signup: vi.fn(),
    track: vi.fn(),
    page: vi.fn()
  } satisfies SyftDataClient

  window.syft = syft
  return syft
}

function mockScriptAppend() {
  return vi
    .spyOn(document.head, 'appendChild')
    .mockImplementation(<T extends Node>(node: T) => node)
}

describe('SyftTelemetryProvider', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.head.innerHTML = ''
    window.__CONFIG__ = {}
    mockRemoteConfig.value = {}
    window.syft = undefined
    window.syftc = undefined
    mockCurrentUser.userEmail.value = undefined
    mockCurrentUser.useCurrentUser.mockReturnValue({
      userEmail: mockCurrentUser.userEmail
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the Syft SDK once when a source id is configured', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider()

    expect(appendChild).toHaveBeenCalledTimes(1)
    const appended = appendChild.mock.calls[0]?.[0]
    if (!(appended instanceof HTMLScriptElement)) {
      throw new Error('Expected Syft script to be appended')
    }

    expect(window.syftc).toEqual({ sourceId: 'src-123' })
    expect(window.syft?.q).toEqual([])
    expect(appended.src).toBe(SYFT_SRC)
  })

  it('clears the stub after SDK load failure so later calls can retry', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()
    const provider = new SyftTelemetryProvider()

    const failedScript = appendChild.mock.calls[0]?.[0]
    if (!(failedScript instanceof HTMLScriptElement)) {
      throw new Error('Expected Syft script to be appended')
    }

    failedScript.dispatchEvent(new Event('error'))
    await Promise.resolve()

    expect(window.syft).toBeUndefined()

    provider.trackAuth({
      email: 'retry@example.com',
      is_new_user: false,
      method: 'email'
    })

    expect(appendChild).toHaveBeenCalledTimes(2)
    expect(window.syft?.q).toContainEqual([
      'identify',
      'retry@example.com',
      { source: 'login', method: 'email' }
    ])
  })

  it('does not touch the current user store during construction', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider()

    expect(mockCurrentUser.useCurrentUser).not.toHaveBeenCalled()
  })

  it('preserves an existing GTM-loaded Syft client and script', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const syft = installSyftSpy()
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider()

    expect(window.syft).toBe(syft)
    expect(appendChild).not.toHaveBeenCalled()
  })

  it('identifies new auth users with signup source and normalized email', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackAuth({
      email: ' New@Example.COM ',
      is_new_user: true,
      method: 'google'
    })

    expect(window.syft?.q).toContainEqual([
      'identify',
      'new@example.com',
      { source: 'signup', method: 'google' }
    ])
  })

  it('identifies returning auth users with login source', async () => {
    const syft = installSyftSpy()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackAuth({
      email: 'back@example.com',
      is_new_user: false,
      method: 'github'
    })

    expect(syft.identify).toHaveBeenCalledWith('back@example.com', {
      source: 'login',
      method: 'github'
    })
    expect(syft.signup).not.toHaveBeenCalled()
  })

  it('defaults unknown auth state to login source', async () => {
    const syft = installSyftSpy()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackAuth({
      email: 'unknown@example.com',
      method: 'email'
    })

    expect(syft.identify).toHaveBeenCalledWith('unknown@example.com', {
      source: 'login',
      method: 'email'
    })
  })

  it('skips auth tracking when email is unavailable', async () => {
    const syft = installSyftSpy()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackAuth({
      is_new_user: true,
      method: 'email'
    })

    expect(syft.identify).not.toHaveBeenCalled()
    expect(syft.signup).not.toHaveBeenCalled()
  })

  it('identifies restored sessions from the current user store', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    mockScriptAppend()
    mockCurrentUser.userEmail.value = 'Restored@Example.com'
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackUserLoggedIn()

    expect(mockCurrentUser.useCurrentUser).toHaveBeenCalled()
    expect(window.syft?.q).toContainEqual([
      'identify',
      'restored@example.com',
      { source: 'login' }
    ])
  })

  it('does not immediately re-identify the same email after auth tracking', async () => {
    const syft = installSyftSpy()
    mockCurrentUser.userEmail.value = 'new@example.com'
    const SyftTelemetryProvider = await importProvider()
    const provider = new SyftTelemetryProvider()

    provider.trackAuth({
      email: 'new@example.com',
      is_new_user: true,
      method: 'google'
    })
    provider.trackUserLoggedIn()

    expect(syft.identify).toHaveBeenCalledTimes(1)
    expect(syft.identify).toHaveBeenCalledWith('new@example.com', {
      source: 'signup',
      method: 'google'
    })
    expect(syft.signup).not.toHaveBeenCalled()
  })
})
