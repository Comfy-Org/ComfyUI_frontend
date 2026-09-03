import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadGate(search: string) {
  vi.resetModules()
  window.history.replaceState({}, '', `/${search}`)
  return import('./crdtDebugGate')
}

/**
 * happy-dom's `window.location` is same-origin-only (replaceState refuses a
 * cross-origin URL), so a production-hostname load is faked by stubbing the
 * `location` global instead of navigating to it — same technique the
 * `initDatadogRum` hostname tests use for the same reason. A plain object
 * (not a spread `Location` instance) so nothing depends on the prototype.
 */
async function loadGateOnHostname(search: string, hostname: string) {
  vi.resetModules()
  vi.stubGlobal('location', {
    hostname,
    search,
    href: `https://${hostname}/${search}`
  })
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

  it('identifies the production hostname and nothing else', async () => {
    const gate = await loadGate('')

    expect(gate.isProductionHostname('cloud.comfy.org')).toBe(true)
    expect(gate.isProductionHostname('stagingcloud.comfy.org')).toBe(false)
    expect(gate.isProductionHostname('testcloud.comfy.org')).toBe(false)
    expect(gate.isProductionHostname('localhost')).toBe(false)
    expect(gate.isProductionHostname('pr-16365.testenvs.comfy.org')).toBe(false)
  })

  it('refuses to enable from a link on the production hostname', async () => {
    // Without the stub, `isCrdtDebugEnabled()`'s DEV fallback would mask a
    // broken gate: vitest runs with DEV true, same trap the first test in
    // this file guards against.
    vi.stubEnv('DEV', false)
    const gate = await loadGateOnHostname('?crdtDebug=1', 'cloud.comfy.org')

    expect(gate.isCrdtDebugEnabled()).toBe(false)
  })

  it('refuses a previously persisted enable choice on production', async () => {
    localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
    const gate = await loadGateOnHostname('', 'cloud.comfy.org')

    expect(gate.isCrdtDebugEnabled()).toBe(false)
  })

  it('still honours an explicit opt-out link on the production hostname', async () => {
    // A stray opt-out must never be the one query value this gate refuses to
    // apply — production must always be able to turn ITSELF back off.
    const gate = await loadGateOnHostname('?crdtDebug=0', 'cloud.comfy.org')

    expect(gate.isCrdtDebugEnabled()).toBe(false)
  })

  it('still strips the query param when refusing to enable on production', async () => {
    // The stubbed `location` used to reach a production hostname is a plain
    // object, not a live binding, so `window.location.search` after the fact
    // reflects the real (unstubbed) location rather than the mutation this
    // module made — spy on the call instead of re-reading location.
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    await loadGateOnHostname('?crdtDebug=1', 'cloud.comfy.org')

    expect(replaceStateSpy).toHaveBeenCalled()
    const [, , consumedUrl] = replaceStateSpy.mock.calls.at(-1)!
    expect(String(consumedUrl)).not.toContain('crdtDebug')
  })

  it('enables normally from the same link off the production hostname', async () => {
    const gate = await loadGateOnHostname('?crdtDebug=1', 'testcloud.comfy.org')

    expect(gate.isCrdtDebugEnabled()).toBe(true)
  })
})
