import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadPage() {
  vi.resetModules()
  return import('./unsyncedHumanOps')
}

describe('unsyncedHumanOps', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('carries unsynced workflows across reloads until a page subscribes to them', async () => {
    const before = await loadPage()
    before.recordUnsyncedHumanOps('tab-1', ['wf-a'])

    const afterFirstReload = await loadPage()
    expect(afterFirstReload.hasUnsyncedHumanOps('wf-a')).toBe(true)
    expect(afterFirstReload.hasUnsyncedHumanOps('wf-b')).toBe(false)

    const afterSecondReload = await loadPage()
    expect(afterSecondReload.hasUnsyncedHumanOps('wf-a')).toBe(true)
    afterSecondReload.forgetUnsyncedAtLoad('wf-a')
    expect(afterSecondReload.hasUnsyncedHumanOps('wf-a')).toBe(false)

    expect((await loadPage()).hasUnsyncedHumanOps('wf-a')).toBe(false)
  })

  it('keeps a carried workflow when this page records only its own edits', async () => {
    const before = await loadPage()
    before.recordUnsyncedHumanOps('tab-1', ['wf-a'])

    const after = await loadPage()
    after.recordUnsyncedHumanOps('tab-2', ['wf-b'])
    after.recordUnsyncedHumanOps('tab-2', [])

    expect((await loadPage()).hasUnsyncedHumanOps('wf-a')).toBe(true)
  })

  it('reports a workflow until every recorder that saw it records it synced', async () => {
    const page = await loadPage()
    page.recordUnsyncedHumanOps('tab-1', ['wf-a'])
    page.recordUnsyncedHumanOps('tab-2', ['wf-a'])
    page.recordUnsyncedHumanOps('tab-1', [])
    expect(page.hasUnsyncedHumanOps('wf-a')).toBe(true)

    page.recordUnsyncedHumanOps('tab-2', [])
    expect(page.hasUnsyncedHumanOps('wf-a')).toBe(false)
    expect((await loadPage()).hasUnsyncedHumanOps('wf-a')).toBe(false)
  })
})
