import { retry } from 'es-toolkit'
import { cloneDeep } from 'es-toolkit/compat'
import { createEventHook, until, useAsyncState } from '@vueuse/core'
import { compare, valid } from 'semver'
import { ref } from 'vue'
import type { Ref } from 'vue'

import { CANVAS_NAVIGATION_PRESETS } from './canvasNavigation'
import type { SettingParams, Settings } from './types'
import { useTelemetry } from '@comfyorg/telemetry'
import type { SettingChangedMetadata } from '@comfyorg/telemetry/types'

export const getSettingInfo = (setting: SettingParams) => {
  const parts = setting.category || setting.id.split('.')
  return {
    category: parts[0] ?? 'Other',
    subCategory: parts[1] ?? 'Other'
  }
}

interface SettingChange {
  id: string
  value: unknown
  oldValue: unknown
}

interface AppliedSetting<TValue> {
  previousValue: TValue
  newValue: TValue
  writeToken: number
}

type RevertibleSettingId = 'Comfy.Extension.DisabledPacks'

type SettingWriteOutcome =
  | { status: 'saved' | 'unchanged' }
  | { status: 'refused'; statusCode: number; statusText: string }
  | { status: 'indeterminate'; statusCode: number; statusText: string }
  | { status: 'unconfirmed'; cause: unknown }

const PRE_STORAGE_REFUSAL_STATUSES = new Set([
  400, 404, 405, 413, 414, 415, 422, 431
])

function resolveDefaultValue<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value
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
  oldValue: unknown,
  notify: (change: SettingChange) => void
) {
  // Started before notifying so extensions keep observing the change at the
  // same point, but awaited afterwards: a handler that cascades into other
  // settings must finish writing them before the caller writes this one, or
  // the two requests race in the backend's read-modify-write.
  const handled = callHandler(setting, newValue, oldValue)
  if (setting) {
    notify({ id: setting.id, value: newValue, oldValue })
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

/** The backend calls the setting store persists through. */
export interface SettingPersistence {
  getSettings(options: { skipStatusRetry: boolean }): Promise<Partial<Settings>>
  storeSetting(
    id: keyof Settings,
    value: Settings[keyof Settings]
  ): Promise<Response>
  storeSettings(settings: Partial<Settings>): Promise<unknown>
}

/** The setting store's state and actions, persisting through the given port. */
export function settingStoreSetup(persistence: SettingPersistence) {
  const settingValues: Ref<Partial<Settings>> = ref({})
  const settingsById = ref<Record<string, SettingParams>>({})
  const latestWrite = new Map<keyof Settings, number>()
  const settingChanged = createEventHook<SettingChange>()

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
      settingValues.value = await retry(
        () => persistence.getSettings({ skipStatusRetry: true }),
        {
          retries: 3,
          delay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000)
        }
      )
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
  function exists(key: keyof Settings) {
    return settingValues.value[key] !== undefined
  }

  /**
   * Apply a setting value in memory and fire onChange, without persisting it.
   * @returns The migrated value, or `undefined` when it was already current.
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
    const writeToken = (latestWrite.get(key) ?? 0) + 1
    latestWrite.set(key, writeToken)

    await onChange(
      settingsById.value[key],
      newValue,
      oldValue,
      settingChanged.trigger
    )

    if (latestWrite.get(key) !== writeToken) return undefined
    return {
      previousValue: oldValue,
      newValue: typedNewValue,
      writeToken
    }
  }

  async function revertSettingLocally<K extends keyof Settings>(
    key: K,
    hadValue: boolean,
    applied: AppliedSetting<Settings[K]>
  ) {
    if (latestWrite.get(key) !== applied.writeToken) return
    if (hadValue) settingValues.value[key] = applied.previousValue
    else delete settingValues.value[key]
    await onChange(
      settingsById.value[key],
      applied.previousValue,
      applied.newValue,
      settingChanged.trigger
    )
  }

  async function setWithOutcome<K extends RevertibleSettingId>(
    key: K,
    value: Settings[K]
  ): Promise<SettingWriteOutcome> {
    const hadValue = exists(key)
    const applied = await applySettingLocally(key, value)
    if (applied === undefined) return { status: 'unchanged' }

    let response: Response
    try {
      response = await persistence.storeSetting(key, applied.newValue)
    } catch (cause) {
      return { status: 'unconfirmed', cause }
    }

    if (!response.ok) {
      const status = PRE_STORAGE_REFUSAL_STATUSES.has(response.status)
        ? 'refused'
        : 'indeterminate'
      if (status === 'refused') {
        await revertSettingLocally(key, hadValue, applied)
      }
      return {
        status,
        statusCode: response.status,
        statusText: response.statusText
      }
    }

    const event = settingChangedEvent(settingsById.value[key], key, applied)
    if (event) useTelemetry()?.trackSettingChanged(event)
    return { status: 'saved' }
  }

  /**
   * Set a setting value.
   * @param key - The key of the setting to set.
   * @param value - The value to set.
   */
  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    const applied = await applySettingLocally(key, value)
    if (applied === undefined) return
    await persistence.storeSetting(key, applied.newValue)

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
      const applied = await applySettingLocally(key, settings[key])
      if (applied !== undefined) {
        Object.assign(updatedSettings, { [key]: applied.newValue })
        const event = settingChangedEvent(settingsById.value[key], key, applied)
        if (event) telemetryEvents.push(event)
      }
    }

    if (Object.keys(updatedSettings).length > 0) {
      await persistence.storeSettings(updatedSettings)
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

    return versionedDefault ?? resolveDefaultValue(param.defaultValue)
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
    if (setting.id in settingsById.value) {
      // Setting already registered - skip to allow component remounting
      // TODO: Add store reset methods to bootstrapStore and settingStore, then
      // replace window.location.reload() with router.push() in SidebarLogoutIcon.vue
      console.warn(`Setting already registered: ${setting.id}`)
      return
    }

    settingsById.value[setting.id] = setting

    if (settingValues.value[setting.id] !== undefined) {
      Object.assign(settingValues.value, {
        [setting.id]: tryMigrateDeprecatedValue(
          setting,
          settingValues.value[setting.id]
        )
      })
    }
    void onChange(setting, get(setting.id), undefined, settingChanged.trigger)
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
    await persistMigration(() => persistence.storeSettings(unset))
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
      const oldValue = settingValues.value[oldKey]

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
        await persistence.storeSetting(newKey, clampedFontSize)
        await persistence.storeSetting(oldKey, undefined)
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
    applySettingLocally,
    set,
    setWithOutcome,
    setMany,
    get,
    exists,
    getDefaultValue,
    onSettingChanged: settingChanged.on
  }
}
