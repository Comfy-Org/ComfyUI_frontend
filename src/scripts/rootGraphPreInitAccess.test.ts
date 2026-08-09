import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useResolvedSelectedInputs } from '@/components/builder/useResolvedSelectedInputs'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { useFavoritedWidgetsStore } from '@/stores/workspace/favoritedWidgetsStore'

const PRE_INIT_MESSAGE = 'ComfyApp graph accessed before initialization'

function countPreInitLogs(calls: unknown[][]) {
  return calls.filter((call) => call[0] === PRE_INIT_MESSAGE).length
}

describe('rootGraph access before ComfyApp.setup', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the graph as not ready without logging', () => {
    expect(app.isGraphReady).toBe(false)
    expect(countPreInitLogs(consoleError.mock.calls)).toBe(0)
  })

  it('still reports direct rootGraph reads as a defect', () => {
    void app.rootGraph
    expect(countPreInitLogs(consoleError.mock.calls)).toBe(1)
  })

  it.each([
    ['appMode store', useAppModeStore],
    ['favoritedWidgets store', useFavoritedWidgetsStore],
    ['resolvedSelectedInputs composable', useResolvedSelectedInputs]
  ])('constructs the %s without reading rootGraph', (_name, construct) => {
    construct()
    expect(countPreInitLogs(consoleError.mock.calls)).toBe(0)
  })
})
