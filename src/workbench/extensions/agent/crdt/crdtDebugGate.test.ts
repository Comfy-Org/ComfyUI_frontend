import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadGate(search: string) {
  vi.resetModules()
  window.history.replaceState({}, '', `/${search}`)
  return import('./crdtDebugGate')
}

describe('crdtDebugGate', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lets a tester enable the instrument from a link, and remembers it', async () => {
    await loadGate('?crdtDebug=1')
    const afterReload = await loadGate('')

    expect(afterReload.isCrdtDebugEnabled()).toBe(true)
  })

  it('honours an explicit opt-out even where DEV would enable it', async () => {
    const gate = await loadGate('?crdtDebug=0')

    expect(gate.isCrdtDebugEnabled()).toBe(false)
  })

  it('takes the console verbosity from the same link', async () => {
    const gate = await loadGate('?crdtDebug=trace')

    expect(gate.crdtLogLevel()).toBe('trace')
    expect(gate.isLevelEnabled('trace')).toBe(true)
  })

  it('keeps the panel and the console independent', async () => {
    const gate = await loadGate('?crdtDebug=1')

    expect(gate.isCrdtDebugEnabled()).toBe(true)
    expect(gate.isLevelEnabled('trace')).toBe(false)
    expect(gate.isLevelEnabled('info')).toBe(true)
  })

  it('never silences a warning, even fully opted out', async () => {
    const gate = await loadGate('?crdtDebug=0')

    expect(gate.isLevelEnabled('warn')).toBe(true)
  })
})
