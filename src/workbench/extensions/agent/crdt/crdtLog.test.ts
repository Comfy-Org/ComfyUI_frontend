import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { startCrdtLog, wireLog, clearDevEvents, devEvents } from './crdtLog'

describe('crdtLog', () => {
  beforeEach(() => {
    localStorage.clear()
    remoteConfig.value = { 'Comfy.Agent.CrdtDebug': true }
    useSettingStore().settingValues['Comfy.Agent.CrdtDebug.Level'] = 'info'
    clearDevEvents()
  })

  it('leaves storage, history and listeners alone at import', async () => {
    window.history.replaceState({}, '', '/?crdtDebug=trace')
    const setItem = vi.spyOn(localStorage, 'setItem')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const addEventListener = vi.spyOn(window, 'addEventListener')
    vi.resetModules()

    await import('./crdtLog')

    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'storage')
    ).toEqual([])
    expect(setItem).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?crdtDebug=trace')
  })

  it('installs one storage listener on start and removes it on dispose', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const stop = startCrdtLog()
    onTestFinished(stop)
    const added = add.mock.calls.filter(([type]) => type === 'storage')
    expect(added).toHaveLength(1)

    stop()

    expect(remove.mock.calls.filter(([type]) => type === 'storage')).toEqual(
      added
    )
  })

  it('observes cross-tab verbosity changes only while started', () => {
    const stop = startCrdtLog()
    onTestFinished(stop)
    wireLog.trace('ws_out', 'before')
    expect(console.debug).not.toHaveBeenCalled()

    localStorage.setItem('Comfy.Agent.CrdtDebug.level', 'trace')
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'Comfy.Agent.CrdtDebug.level' })
    )
    wireLog.trace('ws_out', 'after')
    expect(console.debug).toHaveBeenCalledOnce()

    stop()
    localStorage.setItem('Comfy.Agent.CrdtDebug.level', 'warn')
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'Comfy.Agent.CrdtDebug.level' })
    )
    wireLog.trace('ws_out', 'disposed')
    expect(console.debug).toHaveBeenCalledTimes(2)
  })

  it('rereads verbosity changed while no logger was running', () => {
    startCrdtLog()()
    localStorage.setItem('Comfy.Agent.CrdtDebug.level', 'trace')
    onTestFinished(startCrdtLog())

    wireLog.trace('ws_out', 'restarted')

    expect(console.debug).toHaveBeenCalledOnce()
  })

  it('keeps following other tabs while another owner is running', () => {
    const stopFirst = startCrdtLog()
    onTestFinished(stopFirst)
    onTestFinished(startCrdtLog())
    stopFirst()
    localStorage.setItem('Comfy.Agent.CrdtDebug.level', 'trace')
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'Comfy.Agent.CrdtDebug.level' })
    )

    wireLog.trace('ws_out', 'remaining owner')

    expect(console.debug).toHaveBeenCalledOnce()
  })

  it.for(['warn', 'info', 'debug', 'trace'] as const)(
    'emits no %s events when the feature flag is off',
    (level) => {
      remoteConfig.value = { 'Comfy.Agent.CrdtDebug': false }

      wireLog[level]('doc_update', 'updated')

      expect(console.warn).not.toHaveBeenCalled()
      expect(console.info).not.toHaveBeenCalled()
      expect(console.debug).not.toHaveBeenCalled()
      expect(devEvents.value).toHaveLength(0)
    }
  )
  it('applies the level setting to console output while retaining the transcript', () => {
    wireLog.info('doc_update', 'updated')
    wireLog.trace('ws_out', 'frame')
    expect(console.info).toHaveBeenCalledOnce()
    expect(console.debug).not.toHaveBeenCalled()
    useSettingStore().settingValues['Comfy.Agent.CrdtDebug.Level'] = 'trace'
    wireLog.trace('ws_out', 'frame')
    expect(console.debug).toHaveBeenCalledOnce()
    expect(devEvents.value).toHaveLength(3)
  })
})
