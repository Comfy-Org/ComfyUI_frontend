import type { RouteLocationNormalized } from 'vue-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type Guard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: (arg?: unknown) => void
) => Promise<void> | void

const mocks = vi.hoisted(() => ({
  guards: [] as Guard[],
  isSessionSuspended: vi.fn(() => false),
  getAuthHeader: vi.fn<() => Promise<string | null>>()
}))

// Capturing the registered guard is the only way to exercise it: the router is
// constructed at module scope and never exported as a testable unit.
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    createWebHistory: vi.fn(() => ({})),
    createRouter: vi.fn(() => ({
      beforeEach: (guard: Guard) => mocks.guards.push(guard),
      afterEach: vi.fn(),
      currentRoute: { value: { query: {} } },
      push: vi.fn(),
      replace: vi.fn(),
      resolve: vi.fn(() => ({ href: '/' }))
    }))
  }
})

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  isSessionSuspended: mocks.isSessionSuspended
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isInitialized: true,
    getAuthHeader: mocks.getAuthHeader
  })
}))

vi.mock('@/stores/userStore', () => ({ useUserStore: () => ({}) }))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: {} })
}))
vi.mock('@/platform/telemetry', () => ({ useTelemetry: () => null }))
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showSignInDialog: vi.fn() })
}))
vi.mock('@/platform/cloud/oauth/oauthState', () => ({
  captureOAuthRequestId: vi.fn()
}))
vi.mock('@/platform/cloud/onboarding/desktopLoginRedemption', () => ({
  installDesktopLoginRedemption: vi.fn()
}))
vi.mock('@/platform/navigation/preservedQueryTracker', () => ({
  installPreservedQueryTracker: vi.fn()
}))
vi.mock('@/platform/workflow/sharing/utils/shareAuthAttribution', () => ({
  preserveLoggedOutShareAuthAttribution: vi.fn()
}))

async function loadGuard() {
  mocks.guards.length = 0
  vi.resetModules()
  await import('@/router')
  const guard = mocks.guards.at(-1)
  if (!guard) throw new Error('router registered no navigation guard')
  return guard
}

function canvasRoute(): RouteLocationNormalized {
  return {
    name: 'GraphView',
    path: '/',
    fullPath: '/',
    query: {},
    meta: { requiresAuth: true }
  } as unknown as RouteLocationNormalized
}

// The router pulls in a large module graph; the first transform dominates.
beforeAll(async () => {
  await loadGuard()
}, 60_000)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isSessionSuspended.mockReturnValue(false)
  mocks.getAuthHeader.mockResolvedValue(null)
})

describe('cloud auth guard', () => {
  /**
   * The design's central promise is that an expired session suspends in place
   * and never navigates. The guard sees no credential either way, so without
   * this branch an ordinary canvas gesture (entering a subgraph pushes a route)
   * unmounts the canvas and destroys the unsaved work the banner just told
   * the user to export.
   */
  it('leaves a suspended session where it is, so unsaved work survives', async () => {
    mocks.isSessionSuspended.mockReturnValue(true)
    const guard = await loadGuard()
    const next = vi.fn()

    await guard(canvasRoute(), canvasRoute(), next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })

  it('still sends a genuinely signed-out visitor to login', async () => {
    const guard = await loadGuard()
    const next = vi.fn()

    await guard(canvasRoute(), canvasRoute(), next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'cloud-login' })
    )
  })

  it('does not disturb a signed-in user', async () => {
    mocks.getAuthHeader.mockResolvedValue('Bearer token')
    const guard = await loadGuard()
    const next = vi.fn()

    await guard(canvasRoute(), canvasRoute(), next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith()
  })
})
