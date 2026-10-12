import { beforeEach, describe, expect, it } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { wireLog, clearDevEvents, devEvents } from './crdtLog'

describe('crdtLog', () => {
  beforeEach(() => {
    remoteConfig.value = { 'Comfy.Agent.CrdtDebug': true }
    useSettingStore().settingValues['Comfy.Agent.CrdtDebug.Level'] = 'info'
    clearDevEvents()
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
