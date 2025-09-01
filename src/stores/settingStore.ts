import _ from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Settings } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { SettingParams } from '@/types/settingTypes'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { compareVersions, isSemVer } from '@/utils/formatUtil'

export const getSettingInfo = (setting: SettingParams) => {
  const parts = setting.category || setting.id.split('.')
  return {
    category: parts[0] ?? 'Other',
    subCategory: parts[1] ?? 'Other'
  }
}

export interface SettingTreeNode extends TreeNode {
  data?: SettingParams
}

function tryMigrateDeprecatedValue(
  setting: SettingParams | undefined,
  value: unknown
) {
  return setting?.migrateDeprecatedValue?.(value) ?? value
}

function onChange(
  setting: SettingParams | undefined,
  newValue: unknown,
  oldValue: unknown
) {
  if (setting?.onChange) {
    setting.onChange(newValue, oldValue)
  }
  // Backward compatibility with old settings dialog.
  // Some extensions still listens event emitted by the old settings dialog.
  // @ts-expect-error 'setting' is possibly 'undefined'.ts(18048)
  app.ui.settings.dispatchChange(setting.id, newValue, oldValue)
}

export const useSettingStore = defineStore('setting', () => {
  const settingValues = ref<Record<string, any>>({})
  const settingsById = ref<Record<string, SettingParams>>({})

  /**
   * Check if a setting's value exists, i.e. if the user has set it manually.
   * @param key - The key of the setting to check.
   * @returns Whether the setting exists.
   */
  function exists(key: string) {
    return settingValues.value[key] !== undefined
  }

  /**
   * Set a setting value.
   * @param key - The key of the setting to set.
   * @param value - The value to set.
   */
  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    // Clone the incoming value to prevent external mutations
    const clonedValue = _.cloneDeep(value)
    const newValue = tryMigrateDeprecatedValue(
      settingsById.value[key],
      clonedValue
    )
    const oldValue = get(key)
    if (newValue === oldValue) return

    onChange(settingsById.value[key], newValue, oldValue)
    settingValues.value[key] = newValue
    await api.storeSetting(key, newValue)
  }

  /**
   * Get a setting value.
   * @param key - The key of the setting to get.
   * @returns The value of the setting.
   */
  function get<K extends keyof Settings>(key: K): Settings[K] {
    // Clone the value when returning to prevent external mutations
    return _.cloneDeep(settingValues.value[key] ?? getDefaultValue(key))
  }

  /**
   * Gets the setting params, asserting the type that is intentionally left off
   * of {@link settingsById}.
   * @param key The key of the setting to get.
   * @returns The setting.
   */
  function getSettingById<K extends keyof Settings>(
    key: K
  ): SettingParams<Settings[K]> | undefined {
    return settingsById.value[key] as SettingParams<Settings[K]> | undefined
  }

  /**
   * Get the default value of a setting.
   * @param key - The key of the setting to get.
   * @returns The default value of the setting.
   */
  function getDefaultValue<K extends keyof Settings>(
    key: K
  ): Settings[K] | undefined {
    // Assertion: settingsById is not typed.
    const param = getSettingById(key)

    if (param === undefined) return

    const versionedDefault = getVersionedDefaultValue(key, param)

    if (versionedDefault) {
      return versionedDefault
    }

    return typeof param.defaultValue === 'function'
      ? param.defaultValue()
      : param.defaultValue
  }

  function getVersionedDefaultValue<
    K extends keyof Settings,
    TValue = Settings[K]
  >(key: K, param: SettingParams<TValue> | undefined): TValue | null {
    // get default versioned value, skipping if the key is 'Comfy.InstalledVersion' to prevent infinite loop
    const defaultsByInstallVersion = param?.defaultsByInstallVersion
    if (defaultsByInstallVersion && key !== 'Comfy.InstalledVersion') {
      const installedVersion = get('Comfy.InstalledVersion')

      if (installedVersion) {
        const sortedVersions = Object.keys(defaultsByInstallVersion).sort(
          (a, b) => compareVersions(b, a)
        )

        for (const version of sortedVersions) {
          // Ensure the version is in a valid format before comparing
          if (!isSemVer(version)) {
            continue
          }

          if (compareVersions(installedVersion, version) >= 0) {
            const versionedDefault = defaultsByInstallVersion[version]
            return typeof versionedDefault === 'function'
              ? versionedDefault()
              : versionedDefault
          }
        }
      }
    }

    return null
  }

  /**
   * Register a setting.
   * @param setting - The setting to register.
   */
  function addSetting(setting: SettingParams) {
    if (!setting.id) {
      throw new Error('Settings must have an ID')
    }
    if (setting.id in settingsById.value) {
      throw new Error(`Setting ${setting.id} must have a unique ID.`)
    }

    settingsById.value[setting.id] = setting

    if (settingValues.value[setting.id] !== undefined) {
      settingValues.value[setting.id] = tryMigrateDeprecatedValue(
        setting,
        settingValues.value[setting.id]
      )
    }
    onChange(setting, get(setting.id), undefined)
  }

  /*
   * Load setting values from server.
   * This needs to be called before any setting is registered.
   */
  async function loadSettingValues() {
    if (Object.keys(settingsById.value).length) {
      throw new Error(
        'Setting values must be loaded before any setting is registered.'
      )
    }
    settingValues.value = await api.getSettings()

    // Migrate old zoom threshold setting to new font size setting
    await migrateZoomThresholdToFontSize()
  }

  /**
   * Migrate the old zoom threshold setting to the new font size setting.
   * Maps zoom threshold (0.1-1.0) to font size (1-24px).
   */
  async function migrateZoomThresholdToFontSize() {
    const oldKey = 'LiteGraph.Canvas.LowQualityRenderingZoomThreshold'
    const newKey = 'LiteGraph.Canvas.MinFontSizeForLOD'

    // Only migrate if old setting exists and new setting doesn't
    if (
      settingValues.value[oldKey] !== undefined &&
      settingValues.value[newKey] === undefined
    ) {
      const oldValue = settingValues.value[oldKey] as number

      // Convert zoom threshold to approximate font size
      // Old: 0.1 = switch to LOD at 0.1 zoom (far out, keep detail longest)
      //      1.0 = switch to LOD at 1.0 zoom (close in, switch earliest)
      // New: 0 = LOD disabled (not used in migration as old setting always had LOD enabled)
      //      Small font size (1px) = keep detail longest
      //      Large font size (24px) = switch to LOD earliest
      // This maps: Old range: 0.1 to 1.0 (span of 0.9) - New range: 1px to 24px (span of 23px)
      // So: 0.1 -> 1px, 1.0 -> 24px (direct relationship)
      const mappedFontSize = Math.round(1 + (oldValue - 0.1) * (23 / 0.9))
      const clampedFontSize = Math.max(1, Math.min(24, mappedFontSize))

      // Set the new value
      settingValues.value[newKey] = clampedFontSize

      // Remove the old setting to prevent confusion
      delete settingValues.value[oldKey]

      // Store the migrated setting
      await api.storeSetting(newKey, clampedFontSize)
      await api.storeSetting(oldKey, undefined)
    }
  }

  return {
    settingValues,
    settingsById,
    addSetting,
    loadSettingValues,
    set,
    get,
    exists,
    getDefaultValue
  }
})
