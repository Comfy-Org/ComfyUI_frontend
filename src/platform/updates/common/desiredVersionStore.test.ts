import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDesiredVersionStore } from './desiredVersionStore'

const probeMock = vi.hoisted(() => vi.fn())

vi.mock('./frontendVersionProbe', () => ({
  probeFrontendVersion: probeMock
}))

describe('useDesiredVersionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    probeMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports no new version before the first probe', () => {
    const store = useDesiredVersionStore()
    expect(store.hasNewVersion).toBe(false)
    expect(store.desiredVersion).toBeNull()
    expect(store.runningVersion).toBe(__COMFYUI_FRONTEND_COMMIT__)
  })

  it('reports no new version when the desired version matches the running bundle', async () => {
    probeMock.mockResolvedValue({
      version: __COMFYUI_FRONTEND_COMMIT__,
      bucket: 'stable'
    })
    const store = useDesiredVersionStore()

    await store.refresh()

    expect(store.desiredVersion).toBe(__COMFYUI_FRONTEND_COMMIT__)
    expect(store.hasNewVersion).toBe(false)
  })

  it('detects drift when the desired version differs from the running bundle', async () => {
    probeMock.mockResolvedValue({ version: 'a-newer-commit', bucket: 'stable' })
    const store = useDesiredVersionStore()

    await store.refresh()

    expect(store.desiredVersion).toBe('a-newer-commit')
    expect(store.hasNewVersion).toBe(true)
  })

  it('never treats a missing desired version as drift', async () => {
    probeMock.mockResolvedValue({ version: null, bucket: 'stable' })
    const store = useDesiredVersionStore()

    await store.refresh()

    expect(store.desiredVersion).toBeNull()
    expect(store.hasNewVersion).toBe(false)
  })

  it('keeps the last known drift when a later probe fails', async () => {
    const store = useDesiredVersionStore()

    probeMock.mockResolvedValueOnce({ version: 'a-newer-commit', bucket: null })
    await store.refresh()
    expect(store.hasNewVersion).toBe(true)

    probeMock.mockRejectedValueOnce(new Error('network error'))
    await store.refresh()
    expect(store.hasNewVersion).toBe(true)

    probeMock.mockResolvedValueOnce(null)
    await store.refresh()
    expect(store.hasNewVersion).toBe(true)
  })
})
