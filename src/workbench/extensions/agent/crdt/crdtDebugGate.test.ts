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

  it('stays disabled when neither a link nor a saved choice enables it', async () => {
    vi.stubEnv('DEV', false)
    const gate = await loadGate('')

    expect(gate.isCrdtDebugEnabled()).toBe(false)
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

  it('does not reset a verbosity the tester chose in the panel', async () => {
    const gate = await loadGate('?crdtDebug=1')
    gate.setCrdtLogLevel('trace')

    // Reloading the same handed-out link is how a subscribe bug gets
    // reproduced; it must not silently drop the tester back to `info`.
    const afterReload = await loadGate('?crdtDebug=1')
    expect(afterReload.crdtLogLevel()).toBe('trace')
  })

  it('lets a later dismissal survive a reload of the same link', async () => {
    const gate = await loadGate('?crdtDebug=1')
    expect(window.location.search).not.toContain('crdtDebug')

    gate.setCrdtDebugEnabled(false)

    const afterReload = await loadGate(window.location.search)
    expect(afterReload.isCrdtDebugEnabled()).toBe(false)
  })

  it('ignores an empty parameter instead of treating it as enable', async () => {
    const disabled = await loadGate('?crdtDebug=0')
    expect(disabled.isCrdtDebugEnabled()).toBe(false)

    const empty = await loadGate('?crdtDebug=')
    expect(empty.isCrdtDebugEnabled()).toBe(false)
  })

  it('requires the agent product gate as well as debug opt-in', async () => {
    const gate = await loadGate('?crdtDebug=1')

    expect(gate.resolveDebugPanelEnabled(true)).toBe(true)
    expect(gate.resolveDebugPanelEnabled(false)).toBe(false)
  })
})
