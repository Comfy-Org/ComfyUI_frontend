import { settingStoreSetup } from '@comfyorg/settings-core/settingStore'
import type { SettingParams } from '@comfyorg/settings-core/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'

import { api } from '@/scripts/api'

export const useSettingStore = defineStore('setting', () => {
  const settings = settingStoreSetup(api)
  let pendingCallbacks: Map<string, () => Promise<void>> | undefined
  let editorSignal: AbortSignal | undefined

  function deferExtensionSettingCallbacks(signal: AbortSignal) {
    if (signal.aborted) return
    editorSignal = signal
    pendingCallbacks = new Map()
    signal.addEventListener(
      'abort',
      () => {
        if (editorSignal === signal) pendingCallbacks?.clear()
      },
      { once: true }
    )
  }

  async function activateExtensionSettingCallbacks() {
    const callbacks = pendingCallbacks
    pendingCallbacks = undefined
    await Promise.all(Array.from(callbacks?.values() ?? [], (run) => run()))
  }

  function addExtensionSetting(setting: SettingParams) {
    if (!setting.onChange) {
      settings.addSetting(setting)
      return
    }

    async function invoke(newValue: unknown, oldValue?: unknown) {
      if (editorSignal?.aborted) return
      if (pendingCallbacks) {
        pendingCallbacks.set(setting.id, () =>
          invoke(settings.get(setting.id), undefined)
        )
        return
      }
      try {
        await setting.onChange?.(newValue, oldValue)
      } catch (error) {
        reportError(error, {
          errorType: 'failure_running_extension_setting_callback',
          surface: 'platform',
          level: 'warning',
          tags: { setting: setting.id }
        })
      }
    }

    settings.addSetting({ ...setting, onChange: invoke })
  }

  return {
    ...settings,
    addExtensionSetting,
    deferExtensionSettingCallbacks,
    activateExtensionSettingCallbacks
  }
})
