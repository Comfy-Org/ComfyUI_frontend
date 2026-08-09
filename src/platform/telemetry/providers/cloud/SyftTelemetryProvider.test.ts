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

function syftStub(): SyftDataClient {
  const syft = window.syft
  if (!syft || !('identify' in syft)) {
    throw new Error('Expected a full Syft client on window')
  }
  return syft
}

function failScript(
  appendChild: ReturnType<typeof mockScriptAppend>,
  index: number
) {
  const script = appendChild.mock.calls[index]?.[0]
  if (!(script instanceof HTMLScriptElement)) {
    throw new Error('Expected Syft script to be appended')
  }
  script.dispatchEvent(new Event('error'))
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
    expect(appended.src).toBe(SYFT_SRC)
  })

  it('clears the stub after SDK load failure so later calls can retry', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()
    const provider = new SyftTelemetryProvider()

    failScript(appendChild, 0)
    await Promise.resolve()

    expect(window.syft).toBeUndefined()

    provider.trackAuth({
      email: 'retry@example.com',
      is_new_user: false,
      method: 'email'
    })

    expect(appendChild).toHaveBeenCalledTimes(2)
    expect(syftStub().q).toContainEqual([
      'identify',
      'retry@example.com',
      { source: 'login', method: 'email' }
    ])
  })

  it('replays a pending identify with its original traits after SDK load failure', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackAuth({
      email: 'new@example.com',
      is_new_user: true,
      method: 'google'
    })

    failScript(appendChild, 0)
    await Promise.resolve()

    expect(appendChild).toHaveBeenCalledTimes(2)
    expect(syftStub().q).toContainEqual([
      'identify',
      'new@example.com',
      { source: 'signup', method: 'google' }
    ])
  })

  it('replays at most once but still allows a later manual retry', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    mockCurrentUser.userEmail.value = 'restored@example.com'
    const SyftTelemetryProvider = await importProvider()
    const provider = new SyftTelemetryProvider()

    provider.trackUserLoggedIn()

    failScript(appendChild, 0)
    await Promise.resolve()
    failScript(appendChild, 1)
    await Promise.resolve()

    expect(appendChild).toHaveBeenCalledTimes(2)
    expect(window.syft).toBeUndefined()

    provider.trackUserLoggedIn()

    expect(appendChild).toHaveBeenCalledTimes(3)
    expect(syftStub().q).toContainEqual([
      'identify',
      'restored@example.com',
      { source: 'login' }
    ])
  })

  it('leaves an externally installed client untouched on script error', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider().trackAuth({
      email: 'new@example.com',
      is_new_user: true,
      method: 'google'
    })

    const syft = installSyftSpy()

    failScript(appendChild, 0)
    await Promise.resolve()

    expect(window.syft).toBe(syft)
    expect(appendChild).toHaveBeenCalledTimes(1)
  })

  it('rejects pending fetchID promises when the SDK fails to load', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider()
    const pending = syftStub().fetchID?.('anonymousId')

    failScript(appendChild, 0)

    await expect(pending).rejects.toThrow('Script failed to load')
  })

  it('bootstraps on the first call after the source id arrives', async () => {
    const appendChild = mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()
    const provider = new SyftTelemetryProvider()

    expect(appendChild).not.toHaveBeenCalled()
    expect(window.syftc).toBeUndefined()

    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    provider.trackAuth({
      email: 'late@example.com',
      is_new_user: false,
      method: 'email'
    })

    expect(appendChild).toHaveBeenCalledTimes(1)
    expect(window.syftc).toEqual({ sourceId: 'src-123' })
    expect(syftStub().q).toContainEqual([
      'identify',
      'late@example.com',
      { source: 'login', method: 'email' }
    ])
  })

  it('preserves an existing opt-out flag when writing the source id', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    window.syftc = { enabled: false }
    mockScriptAppend()
    const SyftTelemetryProvider = await importProvider()

    new SyftTelemetryProvider()

    expect(window.syftc).toEqual({ enabled: false, sourceId: 'src-123' })
  })

  it('skips identify when Syft installed its disabled-mode client', async () => {
    mockRemoteConfig.value = { syftdata_source_id: 'src-123' }
    const appendChild = mockScriptAppend()
    const disabledClient = { enable: vi.fn() }
    window.syft = disabledClient
    const SyftTelemetryProvider = await importProvider()
    const provider = new SyftTelemetryProvider()

    expect(() =>
      provider.trackAuth({
        email: 'optedout@example.com',
        is_new_user: false,
        method: 'email'
      })
    ).not.toThrow()
    expect(window.syft).toBe(disabledClient)
    expect(appendChild).not.toHaveBeenCalled()
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

    expect(syftStub().q).toContainEqual([
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
    expect(syftStub().q).toContainEqual([
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
