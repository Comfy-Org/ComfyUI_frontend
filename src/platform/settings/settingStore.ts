import { retry } from 'es-toolkit'
import { cloneDeep } from 'es-toolkit/compat'
import { until, useAsyncState } from '@vueuse/core'
import { defineStore } from 'pinia'
import { compare, valid } from 'semver'
import { ref } from 'vue'

import { CANVAS_NAVIGATION_PRESETS } from '@/platform/settings/constants/canvasNavigation'
import type { SettingParams } from '@/platform/settings/types'
import { useTelemetry } from '@/platform/telemetry'
import type { SettingChangedMetadata } from '@/platform/telemetry/types'
import type { Settings } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { TreeNode } from '@/types/treeExplorerTypes'

export const getSettingInfo = (setting: SettingParams) => {
  const parts = setting.category || setting.id.split('.')
  return {
    category: parts[0] ?? 'Other',
    subCategory: parts[1] ?? 'Other'
  }
}

export type SettingTreeNode = TreeNode<SettingParams>

interface AppliedSetting<TValue> {
  previousValue: TValue
  newValue: TValue
}

function tryMigrateDeprecatedValue(
  setting: SettingParams | undefined,
  value: unknown
) {
  return setting?.migrateDeprecatedValue?.(value) ?? value
}

/**
 * Runs the handler, absorbing both a synchronous throw and a rejected promise.
 * `SettingParams.onChange` is extension-facing public API and its caller
 * persists the setting only after awaiting it, so letting a third-party
 * failure escape would discard the user's own change without saving it.
 *
 * Logged at `warn` for the same reason {@link ComfyApi.wrapListener} is: RUM
 * collects `console.error`, so reporting third-party faults there would just
 * relocate the noise this guard exists to remove.
 */
async function callHandler(
  setting: SettingParams | undefined,
  newValue: unknown,
  oldValue: unknown
) {
  try {
    await setting?.onChange?.(newValue, oldValue)
  } catch (error) {
    console.warn(`[settings] onChange handler for ${setting?.id} failed`, error)
  }
}

async function onChange(
  setting: SettingParams | undefined,
  newValue: unknown,
  oldValue: unknown
) {
  // Started before dispatchChange so extensions keep observing the change at
  // the same point, but awaited afterwards: a handler that cascades into other
  // settings must finish writing them before the caller writes this one, or
  // the two requests race in the backend's read-modify-write.
  const handled = callHandler(setting, newValue, oldValue)
  // Backward compatibility with old settings dialog.
  // Some extensions still listens event emitted by the old settings dialog.
  if (setting) {
    app.ui.settings.dispatchChange(setting.id, newValue, oldValue)
  }
  await handled
}

/**
 * Migrations run inside the boot-critical settings loader, where a rejection
 * becomes `settingStore.error` and GraphCanvas rethrows it before any core
 * setting registers — turning a failed write into an app that will not start.
 * The migrated value is already in memory and the server still holds the
 * un-migrated state, so swallowing the failure leaves the next load to retry.
 */
async function persistMigration(write: () => Promise<unknown>) {
  try {
    await write()
  } catch (error) {
    console.warn(
      '[settings] Failed to persist migration; retrying on next load',
      error
    )
  }
}

function settingChangedEvent<K extends keyof Settings>(
  setting: SettingParams | undefined,
  key: K,
  applied: AppliedSetting<Settings[K]>
): SettingChangedMetadata | undefined {
  if (!setting) return undefined

  const telemetry = setting.telemetry
  const isVisible = setting.type !== 'hidden'
  const trackChanges = telemetry?.trackChanges ?? isVisible
  if (!trackChanges) return undefined

  const includeValues = telemetry?.includeValues ?? isVisible
  return includeValues
    ? {
        setting_id: key,
        previous_value: applied.previousValue,
        new_value: applied.newValue
      }
    : { setting_id: key }
}

export const useSettingStore = defineStore('setting', () => {
  const settingValues = ref<Partial<Settings>>({})
  const settingsById = ref<Record<string, SettingParams>>({})
  const latestWrite = new Map<keyof Settings, number>()

  const {
    isReady,
    isLoading,
    error,
    execute: loadSettingValues
  } = useAsyncState(
    async () => {
      if (Object.keys(settingsById.value).length) {
        throw new Error(
          'Setting values must be loaded before any setting is registered.'
        )
      }
      settingValues.value = await retry(() => api.getSettings(), {
        retries: 3,
        delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000)
      })
      await migrateZoomThresholdToFontSize()
      await migrateCanvasNavigationOverrides()
    },
    undefined,
    { immediate: false }
  )

  async function load(): Promise<void> {
    if (isReady.value) return

    if (isLoading.value) {
      await until(isLoading).toBe(false)
      return
    }

    await loadSettingValues()
  }

  /**
   * Check if a setting's value exists, i.e. if the user has set it manually.
   * @param key - The key of the setting to check.
   * @returns Whether the setting exists.
   */
  function exists<K extends keyof Settings>(key: K) {
    return settingValues.value[key] !== undefined
  }

  /**
   * Apply a setting value locally: clone, migrate, update the in-memory
   * store, and fire onChange. Returns the migrated value, or `undefined`
   * when the value is unchanged and was skipped.
   *
   * The store is updated before `onChange` runs so that handlers reading
   * this setting — including handlers of other settings this one cascades
   * into — observe the new value rather than the one it replaced.
   */
  async function applySettingLocally<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ): Promise<AppliedSetting<Settings[K]> | undefined> {
    const clonedValue = cloneDeep(value)
    const newValue = tryMigrateDeprecatedValue(
      settingsById.value[key],
      clonedValue
    )
    const oldValue = get(key)
    if (newValue === oldValue) return undefined

    const typedNewValue = newValue as Settings[K]
    settingValues.value[key] = typedNewValue
    const write = (latestWrite.get(key) ?? 0) + 1
    latestWrite.set(key, write)

    await onChange(settingsById.value[key], newValue, oldValue)

    // Handlers are awaited, so a slow one lets a later change to this key land
    // first. That change owns the value now; persisting ours would revert it.
    if (latestWrite.get(key) !== write) return undefined
    return {
      previousValue: oldValue,
      newValue: typedNewValue
    }
  }

  /**
   * Set a setting value.
   * @param key - The key of the setting to set.
   * @param value - The value to set.
   */
  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    const applied = await applySettingLocally(key, value)
    if (applied === undefined) return
    await api.storeSetting(key, applied.newValue)

    const event = settingChangedEvent(settingsById.value[key], key, applied)
    if (event) useTelemetry()?.trackSettingChanged(event)
  }

  /**
   * Set multiple setting values in a single API call.
   * @param settings - A partial settings object with key-value pairs to set.
   */
  async function setMany(settings: Partial<Settings>) {
    const updatedSettings: Partial<Settings> = {}
    const telemetryEvents: SettingChangedMetadata[] = []

    for (const key of Object.keys(settings) as (keyof Settings)[]) {
      const applied = await applySettingLocally(
        key,
        settings[key] as Settings[typeof key]
      )
      if (applied !== undefined) {
        updatedSettings[key] = applied.newValue
        const event = settingChangedEvent(settingsById.value[key], key, applied)
        if (event) telemetryEvents.push(event)
      }
    }

    if (Object.keys(updatedSettings).length > 0) {
      await api.storeSettings(updatedSettings)
      const telemetry = useTelemetry()
      for (const event of telemetryEvents) {
        telemetry?.trackSettingChanged(event)
      }
    }
  }

  /**
   * Get a setting value.
   * @param key - The key of the setting to get.
   * @returns The value of the setting.
   */
  function get<K extends keyof Settings>(key: K): Settings[K] {
    // Clone the value when returning to prevent external mutations
    return cloneDeep(settingValues.value[key] ?? getDefaultValue(key)!)
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

    const defaultValue = param.defaultValue
    return typeof defaultValue === 'function'
      ? (defaultValue as () => Settings[K])()
      : defaultValue
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
          (a, b) => compare(b, a)
        )

        for (const version of sortedVersions) {
          // Ensure the version is in a valid format before comparing
          if (!valid(version)) {
            continue
          }

          if (compare(installedVersion, version) >= 0) {
            const versionedDefault =
              defaultsByInstallVersion[
                version as keyof typeof defaultsByInstallVersion
              ]
            if (versionedDefault !== undefined) {
              return typeof versionedDefault === 'function'
                ? versionedDefault()
                : versionedDefault
            }
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
      // Setting already registered - skip to allow component remounting
      // TODO: Add store reset methods to bootstrapStore and settingStore, then
      // replace window.location.reload() with router.push() in SidebarLogoutIcon.vue
      console.warn(`Setting already registered: ${setting.id}`)
      return
    }

    settingsById.value[setting.id] = setting

    if (settingValues.value[setting.id] !== undefined) {
      settingValues.value[setting.id] = tryMigrateDeprecatedValue(
        setting,
        settingValues.value[setting.id]
      )
    }
    void onChange(setting, get(setting.id), undefined)
  }

  /**
   * A Navigation Mode preset stored before the Left Mouse Click Behavior and
   * Mouse Wheel Scroll settings shipped in 1.27.4 is the only record of that
   * choice. Materialise the overrides it implies before anything can read
   * their defaults, which describe a different preset and would otherwise
   * demote the stored mode to 'custom'.
   *
   * Runs from `load()` rather than the settings' own `onChange` so it is
   * awaited, and so it does not depend on the order `CORE_SETTINGS` happens
   * to register these three settings in.
   */
  async function migrateCanvasNavigationOverrides() {
    const storedMode = settingValues.value['Comfy.Canvas.NavigationMode']
    const preset =
      typeof storedMode === 'string'
        ? CANVAS_NAVIGATION_PRESETS[storedMode]
        : undefined
    if (!preset) return

    const unset: Partial<Settings> = {}
    for (const id of Object.keys(preset) as (keyof Settings)[]) {
      if (settingValues.value[id] === undefined) {
        Object.assign(unset, { [id]: preset[id] })
      }
    }
    if (!Object.keys(unset).length) return

    Object.assign(settingValues.value, unset)
    await persistMigration(() => api.storeSettings(unset))
  }

  /**
   * Migrate the old zoom threshold setting to the new font size setting.
   * Preserves the exact zoom threshold behavior by converting it to equivalent font size.
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

      // Convert zoom threshold to equivalent font size to preserve exact behavior
      // The threshold formula is: threshold = font_size / (14 * sqrt(DPR))
      // For DPR=1: threshold = font_size / 14
      // Therefore: font_size = threshold * 14
      //
      // Examples:
      // - Old 0.6 threshold → 0.6 * 14 = 8.4px → rounds to 8px (preserves ~60% zoom threshold)
      // - Old 0.5 threshold → 0.5 * 14 = 7px (preserves 50% zoom threshold)
      // - Old 1.0 threshold → 1.0 * 14 = 14px (preserves 100% zoom threshold)
      const mappedFontSize = Math.round(oldValue * 14)
      const clampedFontSize = Math.max(1, Math.min(24, mappedFontSize))

      // Set the new value
      settingValues.value[newKey] = clampedFontSize

      // Remove the old setting to prevent confusion
      delete settingValues.value[oldKey]

      // Store the migrated setting
      await persistMigration(async () => {
        await api.storeSetting(newKey, clampedFontSize)
        await api.storeSetting(oldKey, undefined)
      })
    }
  }

  return {
    settingValues,
    settingsById,
    isReady,
    isLoading,
    error,
    load,
    addSetting,
    set,
    setMany,
    get,
    exists,
    getDefaultValue
  }
})
