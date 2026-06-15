import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockUserState = vi.hoisted(() => ({
  onUserResolved: vi.fn(),
  userEmail: { value: undefined as string | undefined }
}))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => mockUserState
}))

const SYFT_SRC = 'https://cdn.sy-d.io/syftnext/syft.umd.js'

type ConfigWindow = { __CONFIG__?: { syftdata_source_id?: string } }

const importProvider = async () => {
  const { SyftTelemetryProvider } =
    await import('@/platform/telemetry/providers/cloud/SyftTelemetryProvider')
  return SyftTelemetryProvider
}

const querySyftScripts = () =>
  document.querySelectorAll(`script[src="${SYFT_SRC}"]`)

describe('SyftTelemetryProvider', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    querySyftScripts().forEach((el) => el.remove())
    delete window.syft
    delete window.syftc
    delete (window as ConfigWindow).__CONFIG__
    mockUserState.userEmail.value = undefined
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  describe('initialization', () => {
    it('warns and skips snippet load when no source id is configured', async () => {
      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider()

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Syft source id')
      )
      expect(window.syft).toBeUndefined()
      expect(querySyftScripts()).toHaveLength(0)
      expect(mockUserState.onUserResolved).toHaveBeenCalled()
    })

    it('installs the queue stub and injects the snippet script', async () => {
      ;(window as ConfigWindow).__CONFIG__ = { syftdata_source_id: 'src-123' }
      const appendChild = vi.spyOn(document.head, 'appendChild')

      try {
        const SyftTelemetryProvider = await importProvider()
        new SyftTelemetryProvider()

        expect(window.syftc).toEqual({ sourceId: 'src-123' })
        expect(window.syft?.q).toEqual([])
        const appended = appendChild.mock.calls[0]?.[0]
        expect(appended).toBeInstanceOf(HTMLScriptElement)
        expect((appended as HTMLScriptElement).src).toBe(SYFT_SRC)
      } finally {
        appendChild.mockRestore()
      }
    })

    it('queues identify calls made before the script loads', async () => {
      ;(window as ConfigWindow).__CONFIG__ = { syftdata_source_id: 'src-123' }

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider()
      window.syft?.identify('user@example.com', { source: 'login' })

      expect(window.syft?.q).toContainEqual([
        'identify',
        'user@example.com',
        { source: 'login' }
      ])
    })

    it('preserves an existing window.syft and script (GTM-loaded)', async () => {
      ;(window as ConfigWindow).__CONFIG__ = { syftdata_source_id: 'src-123' }
      const gtmSyft = {
        identify: vi.fn(),
        signup: vi.fn(),
        track: vi.fn(),
        page: vi.fn()
      }
      window.syft = gtmSyft
      const gtmScript = document.createElement('script')
      gtmScript.src = SYFT_SRC
      document.head.appendChild(gtmScript)

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider()

      expect(window.syft).toBe(gtmSyft)
      expect(querySyftScripts()).toHaveLength(1)
    })

    it('identifies with email and login source on user resolve', async () => {
      ;(window as ConfigWindow).__CONFIG__ = { syftdata_source_id: 'src-123' }
      mockUserState.userEmail.value = 'user@example.com'

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider()
      const resolveCallback = mockUserState.onUserResolved.mock.calls[0][0]
      resolveCallback()

      expect(window.syft?.q).toContainEqual([
        'identify',
        'user@example.com',
        { source: 'login' }
      ])
    })

    it('skips identify on user resolve when email is unavailable', async () => {
      ;(window as ConfigWindow).__CONFIG__ = { syftdata_source_id: 'src-123' }

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider()
      const resolveCallback = mockUserState.onUserResolved.mock.calls[0][0]
      resolveCallback()

      expect(window.syft?.q).toEqual([])
    })
  })

  describe('trackAuth', () => {
    const installSyftSpy = () => {
      const syftSpy = {
        identify: vi.fn(),
        signup: vi.fn(),
        track: vi.fn(),
        page: vi.fn()
      }
      window.syft = syftSpy
      return syftSpy
    }

    it('calls signup for new users with method and signup source', async () => {
      const syftSpy = installSyftSpy()

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider().trackAuth({
        method: 'google',
        is_new_user: true,
        email: 'new@example.com'
      })

      expect(syftSpy.signup).toHaveBeenCalledWith('new@example.com', {
        source: 'signup',
        method: 'google'
      })
      expect(syftSpy.identify).not.toHaveBeenCalled()
    })

    it('calls identify for returning users with login source', async () => {
      const syftSpy = installSyftSpy()

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider().trackAuth({
        method: 'github',
        is_new_user: false,
        email: 'back@example.com'
      })

      expect(syftSpy.identify).toHaveBeenCalledWith('back@example.com', {
        source: 'login',
        method: 'github'
      })
      expect(syftSpy.signup).not.toHaveBeenCalled()
    })

    it('defaults to login source when new vs returning is unknown', async () => {
      const syftSpy = installSyftSpy()

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider().trackAuth({
        method: 'email',
        email: 'who@example.com'
      })

      expect(syftSpy.identify).toHaveBeenCalledWith('who@example.com', {
        source: 'login',
        method: 'email'
      })
      expect(syftSpy.signup).not.toHaveBeenCalled()
    })

    it('does nothing without an email', async () => {
      const syftSpy = installSyftSpy()

      const SyftTelemetryProvider = await importProvider()
      new SyftTelemetryProvider().trackAuth({
        method: 'email',
        is_new_user: true
      })

      expect(syftSpy.signup).not.toHaveBeenCalled()
      expect(syftSpy.identify).not.toHaveBeenCalled()
    })
  })
})
