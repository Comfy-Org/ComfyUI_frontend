import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockApi = { getRawLogs: ReturnType<typeof vi.fn> }

const mockState = vi.hoisted<{ api: MockApi }>(() => ({
  api: { getRawLogs: undefined as never }
}))

vi.mock('@/scripts/api', () => ({
  get api() {
    return mockState.api
  }
}))

function sample(path: string): string {
  return `[DEPRECATION WARNING] Detected import of deprecated legacy API: ${path}. This is likely caused by a custom node extension using outdated APIs. Please update your extensions or contact the extension author for an updated version.`
}

describe('backfillServerDeprecations', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetModules()
    mockState.api = { getRawLogs: vi.fn() }
  })

  it('seeds pre-load deprecation messages from the raw log buffer', async () => {
    mockState.api.getRawLogs.mockResolvedValue({
      entries: [
        { t: 't', m: 'unrelated startup message' },
        { t: 't', m: sample('/scripts/ui/legacy.js') }
      ]
    })

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    await backfillServerDeprecations()

    const store = useDeprecationWarningsStore()
    expect(store.warnings).toHaveLength(1)
    expect(store.warnings[0].message).toBe(
      'Legacy API import: /scripts/ui/legacy.js'
    )
  })

  it('extracts paths containing internal dots without truncation', async () => {
    mockState.api.getRawLogs.mockResolvedValue({
      entries: [{ t: 't', m: sample('/scripts/ui.foo.bar.js') }]
    })

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    await backfillServerDeprecations()

    expect(useDeprecationWarningsStore().warnings[0]?.message).toBe(
      'Legacy API import: /scripts/ui.foo.bar.js'
    )
  })

  it('falls back to the raw line (without the legacy-API suggestion) for entries that do not match the template', async () => {
    mockState.api.getRawLogs.mockResolvedValue({
      entries: [{ t: 't', m: '[DEPRECATION WARNING] something unexpected' }]
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    await backfillServerDeprecations()
    warnSpy.mockRestore()

    const [warning] = useDeprecationWarningsStore().warnings
    expect(warning?.message).toBe('[DEPRECATION WARNING] something unexpected')
    expect(warning?.suggestion).toBeUndefined()
  })

  it('ignores non-deprecation log entries', async () => {
    mockState.api.getRawLogs.mockResolvedValue({
      entries: [
        { t: 't', m: 'got prompt' },
        { t: 't', m: '[INFO] something else' }
      ]
    })

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    await backfillServerDeprecations()

    expect(useDeprecationWarningsStore().warnings).toHaveLength(0)
  })

  it('swallows getRawLogs failures gracefully and logs the error', async () => {
    const failure = new Error('401 unauthenticated')
    mockState.api.getRawLogs.mockRejectedValue(failure)

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await backfillServerDeprecations()

    expect(useDeprecationWarningsStore().warnings).toHaveLength(0)
    expect(errSpy).toHaveBeenCalledExactlyOnceWith(
      'Failed to fetch initial server logs for deprecations:',
      failure
    )
    errSpy.mockRestore()
  })

  it('only fetches once after a successful backfill', async () => {
    const api = mockState.api
    api.getRawLogs.mockResolvedValue({ entries: [] })

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')

    await backfillServerDeprecations()
    await backfillServerDeprecations()
    await backfillServerDeprecations()

    expect(api.getRawLogs).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent callers to a single fetch', async () => {
    const api = mockState.api
    api.getRawLogs.mockResolvedValue({ entries: [] })

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')

    await Promise.all([
      backfillServerDeprecations(),
      backfillServerDeprecations(),
      backfillServerDeprecations()
    ])

    expect(api.getRawLogs).toHaveBeenCalledTimes(1)
  })

  it('retries on a subsequent call after a failure', async () => {
    const api = mockState.api
    api.getRawLogs
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ entries: [] })

    const { backfillServerDeprecations } =
      await import('@/platform/dev/backfillServerDeprecations')

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await backfillServerDeprecations()
    await backfillServerDeprecations()
    errSpy.mockRestore()

    expect(api.getRawLogs).toHaveBeenCalledTimes(2)
  })
})
