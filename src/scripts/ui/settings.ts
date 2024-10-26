import { api } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { ComfyDialog } from './dialog'
import type { Setting, SettingParams } from '@/types/settingTypes'
import type { Settings } from '@/types/apiTypes'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'

export class ComfySettingsDialog extends ComfyDialog<HTMLDialogElement> {
  app: ComfyApp
  settingsValues: any
  settingsLookup: Record<string, Setting>
  settingsParamLookup: Record<string, SettingParams>

  constructor(app: ComfyApp) {
    super()
    this.app = app
    this.settingsValues = {}
    this.settingsLookup = {}
    this.settingsParamLookup = {}
  }

  get settings() {
    return Object.values(this.settingsLookup)
  }

  private tryMigrateDeprecatedValue(id: string, value: any) {
    if (this.app.vueAppReady) {
      const settingStore = useSettingStore()
      const setting = settingStore.settings[id]
      if (setting?.migrateDeprecatedValue) {
        return setting.migrateDeprecatedValue(value)
      }
    }
    return value
  }

  #dispatchChange<T>(id: string, value: T, oldValue?: T) {
    // Keep the settingStore updated. Not using `store.set` as it would trigger
    // setSettingValue again.
    // `load` re-dispatch the change for any settings added before load so
    // settingStore is always up to date.
    if (this.app.vueAppReady) {
      useSettingStore().settingValues[id] = value
    }

    this.dispatchEvent(
      new CustomEvent(id + '.change', {
        detail: {
          value,
          oldValue
        }
      })
    )
  }

  async load() {
    if (this.app.storageLocation === 'browser') {
      this.settingsValues = localStorage
    } else {
      this.settingsValues = await api.getSettings()
    }

    // Trigger onChange for any settings added before load
    for (const id in this.settingsLookup) {
      const compatId = this.getId(id)
      this.settingsValues[compatId] = this.tryMigrateDeprecatedValue(
        id,
        this.settingsValues[compatId]
      )
      const value = this.settingsValues[compatId]
      this.settingsLookup[id].onChange?.(value)
      this.#dispatchChange(id, value)
    }
  }

  getId(id: string) {
    if (this.app.storageLocation === 'browser') {
      id = 'Comfy.Settings.' + id
    }
    return id
  }

  getSettingValue<K extends keyof Settings>(
    id: K,
    defaultValue?: Settings[K]
  ): Settings[K] {
    let value = this.settingsValues[this.getId(id)]
    if (value != null) {
      if (this.app.storageLocation === 'browser') {
        try {
          value = JSON.parse(value)
        } catch (error) {}
      }
    }
    return (value ?? defaultValue) as Settings[K]
  }

  getSettingDefaultValue(id: string) {
    const param = this.settingsParamLookup[id]
    return param?.defaultValue
  }

  async setSettingValueAsync<K extends keyof Settings>(
    id: K,
    value: Settings[K]
  ) {
    value = this.tryMigrateDeprecatedValue(id, value)

    const json = JSON.stringify(value)
    localStorage['Comfy.Settings.' + id] = json // backwards compatibility for extensions keep setting in storage

    let oldValue = this.getSettingValue(id, undefined)
    this.settingsValues[this.getId(id)] = value

    if (id in this.settingsLookup) {
      this.settingsLookup[id].onChange?.(value, oldValue)
    }
    this.#dispatchChange(id, value, oldValue)

    await api.storeSetting(id, value)
  }

  setSettingValue<K extends keyof Settings>(id: K, value: Settings[K]) {
    this.setSettingValueAsync(id, value).catch((err) => {
      useToastStore().addAlert(`Error saving setting '${id}': ${err}`)
    })
  }

  refreshSetting(id: keyof Settings) {
    const value = this.getSettingValue(id)
    this.settingsLookup[id].onChange?.(value)
    this.#dispatchChange(id, value)
  }

  /**
   * Deprecated for external callers/extensions. Use `ComfyExtension.settings` field instead.
   * Example:
   * ```ts
   * app.registerExtension({
   *   name: 'My Extension',
   *   settings: [
   *     {
   *       id: 'My.Setting',
   *       name: 'My Setting',
   *       type: 'text',
   *       defaultValue: 'Hello, world!'
   *     }
   *   ]
   * })
   * ```
   */
  addSetting(params: SettingParams) {
    const { id, name, type, defaultValue, onChange } = params
    if (!id) {
      throw new Error('Settings must have an ID')
    }

    if (id in this.settingsLookup) {
      throw new Error(`Setting ${id} of type ${type} must have a unique ID.`)
    }

    let skipOnChange = false
    let value = this.getSettingValue(id)
    if (value == null) {
      if (this.app.isNewUserSession) {
        // Check if we have a localStorage value but not a setting value and we are a new user
        const localValue = localStorage['Comfy.Settings.' + id]
        if (localValue) {
          value = JSON.parse(localValue)
          this.setSettingValue(id, value) // Store on the server
        }
      }
      if (value == null) {
        value = defaultValue
      }
    }

    // Trigger initial setting of value
    if (!skipOnChange) {
      onChange?.(value, undefined)
      this.#dispatchChange(id, value)
    }

    this.settingsParamLookup[id] = params
    if (this.app.vueAppReady) {
      useSettingStore().settings[id] = params
    }
    this.settingsLookup[id] = {
      id,
      onChange,
      name,
      render: () => {
        console.warn('[ComfyUI] Setting render is deprecated', id)
      }
    } as Setting

    const self = this
    return {
      get value() {
        return self.getSettingValue(id, defaultValue)
      },
      set value(v) {
        self.setSettingValue(id, v)
      }
    }
  }
}
