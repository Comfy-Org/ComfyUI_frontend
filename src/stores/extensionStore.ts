import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyExtension } from '@/types/comfy'

/**
 * Display name for an extension pack path.
 *
 * Shared rather than duplicated per consumer: the table text, its accessible
 * label and the pending-change banner all name the same pack, so the decoding
 * and its malformed-encoding fallback have to be applied identically or an
 * encoded name reads differently in each place.
 */
export function extensionPackName(path: string) {
  const name = path.split('/').filter(Boolean).at(-1) ?? path
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

/**
 * These extensions are always active, even if they are disabled in the setting.
 */
const ALWAYS_ENABLED_EXTENSIONS: readonly string[] = []

const ALWAYS_DISABLED_EXTENSIONS: readonly string[] = [
  // pysssss.Locking is replaced by pin/unpin in ComfyUI core.
  // https://github.com/Comfy-Org/litegraph.js/pull/117
  'pysssss.Locking',
  // pysssss.SnapToGrid is replaced by Comfy.Graph.AlwaysSnapToGrid in ComfyUI core.
  // pysssss.SnapToGrid tries to write global app.shiftDown state, which is no longer
  // allowed since v1.3.12.
  // https://github.com/Comfy-Org/ComfyUI_frontend/issues/1176
  'pysssss.SnapToGrid',
  // Favicon status is implemented in ComfyUI core in v1.20.
  // https://github.com/Comfy-Org/ComfyUI_frontend/pull/3880
  'pysssss.FaviconStatus',
  'KJNodes.browserstatus'
]

export const useExtensionStore = defineStore('extension', () => {
  // For legacy reasons, the name uniquely identifies an extension
  const extensionByName = ref<Record<string, ComfyExtension>>({})
  const extensions = computed(() => Object.values(extensionByName.value))
  // Not using computed because disable extension requires reloading of the page.
  // Dynamically update this list won't affect extensions that are already loaded.
  const disabledExtensionNames = ref<Set<string>>(new Set())
  const extensionPackPaths = ref<string[]>([])
  // Boot-time snapshot, for the same reason as `disabledExtensionNames`:
  // disabling a pack only takes effect after a reload, so this is what the
  // panel compares against to decide whether to offer one. It deliberately
  // does not follow the setting, which changes the instant a switch flips.
  const disabledExtensionPackPaths = ref<Set<string>>(new Set())

  // Disabled extension names that are currently not in the extension list.
  // If a node pack is disabled in the backend, we shouldn't remove the configuration
  // of the frontend extension disable list, in case the node pack is re-enabled.
  const inactiveDisabledExtensionNames = computed(() => {
    return Array.from(disabledExtensionNames.value).filter(
      (name) => !(name in extensionByName.value)
    )
  })
  const isExtensionInstalled = (name: string) => name in extensionByName.value

  const isExtensionEnabled = (name: string) =>
    !disabledExtensionNames.value.has(name)
  const enabledExtensions = computed(() => {
    return extensions.value.filter((ext) => isExtensionEnabled(ext.name))
  })

  function isExtensionReadOnly(name: string) {
    return (
      ALWAYS_DISABLED_EXTENSIONS.includes(name) ||
      ALWAYS_ENABLED_EXTENSIONS.includes(name)
    )
  }

  function registerExtension(extension: ComfyExtension) {
    if (!extension.name) {
      throw new Error("Extensions must have a 'name' property.")
    }

    if (extension.name in extensionByName.value) {
      throw new Error(`Extension named '${extension.name}' already registered.`)
    }

    if (disabledExtensionNames.value.has(extension.name)) {
      console.warn(`Extension ${extension.name} is disabled.`)
    }

    extensionByName.value[extension.name] = markRaw(extension)
  }

  function unregisterExtension(name: string) {
    delete extensionByName.value[name]
  }

  function loadDisabledExtensionNames(names: string[]) {
    disabledExtensionNames.value = new Set(names)
    for (const name of ALWAYS_DISABLED_EXTENSIONS) {
      disabledExtensionNames.value.add(name)
    }
    for (const name of ALWAYS_ENABLED_EXTENSIONS) {
      disabledExtensionNames.value.delete(name)
    }
  }

  function loadExtensionPackPaths(paths: string[], disabledPaths: string[]) {
    extensionPackPaths.value = [...new Set(paths)]
    disabledExtensionPackPaths.value = new Set(disabledPaths)
  }

  const isExtensionPackEnabled = (path: string) =>
    !disabledExtensionPackPaths.value.has(path)

  /**
   * The disabled-pack paths as currently persisted, read straight from the
   * setting that owns them. Consumers project their controls from this instead
   * of staging a parallel draft, so a save the setting owner rolls back cannot
   * leave a switch and the stored value disagreeing — and reopening a panel
   * cannot show a different answer than the one that was just displayed.
   */
  const currentDisabledExtensionPackPaths = computed(
    () => new Set(useSettingStore().get('Comfy.Extension.DisabledPacks'))
  )

  const isExtensionPackCurrentlyEnabled = (path: string) =>
    !currentDisabledExtensionPackPaths.value.has(path)

  const pendingPackSaves = ref(0)
  /**
   * True until every pack save has been acknowledged. Reloading while one is
   * outstanding would re-read the list the server still holds and drop the
   * change the switch already shows, so the reload has to wait for this.
   */
  const isSavingExtensionPacks = computed(() => pendingPackSaves.value > 0)

  let packSaveChain: Promise<unknown> = Promise.resolve()

  /**
   * Enable or disable a whole extension pack, persisting through the setting
   * owner and reporting whether the write landed.
   *
   * Saves are chained rather than issued concurrently. The setting holds the
   * whole array, so two overlapping writes can be acknowledged in the opposite
   * order to the clicks that produced them, leaving the later pack enabled
   * while its switch reads off. Each save instead reads the value the previous
   * one persisted and adds or removes exactly this path — which also preserves
   * the paths of packs that are not installed here, with no separate merge.
   */
  async function setExtensionPackEnabled(path: string, enabled: boolean) {
    const settingStore = useSettingStore()
    const write = () => {
      const disabled = new Set(
        settingStore.get('Comfy.Extension.DisabledPacks')
      )
      if (enabled) disabled.delete(path)
      else disabled.add(path)
      return settingStore.setOrRevert('Comfy.Extension.DisabledPacks', [
        ...disabled
      ])
    }

    // Both arms run `write`: a failed save must not stall every later one,
    // and the next save reads the value the server actually holds anyway.
    const run = packSaveChain.then(write, write)
    packSaveChain = run.catch(() => {})
    pendingPackSaves.value++
    try {
      return await run
    } finally {
      pendingPackSaves.value--
    }
  }

  /**
   * Core extensions are extensions that are defined in the core package.
   * See /extensions/core/index.ts for the list.
   */
  const coreExtensionNames = ref<string[]>([])
  function captureCoreExtensions() {
    coreExtensionNames.value = extensions.value.map((ext) => ext.name)
  }

  function isCoreExtension(name: string) {
    return coreExtensionNames.value.includes(name)
  }

  const hasThirdPartyExtensions = computed(() => {
    return extensions.value.some((ext) => !isCoreExtension(ext.name))
  })

  return {
    extensions,
    enabledExtensions,
    extensionPackPaths,
    inactiveDisabledExtensionNames,
    isExtensionInstalled,
    isExtensionEnabled,
    isExtensionReadOnly,
    registerExtension,
    unregisterExtension,
    loadDisabledExtensionNames,
    loadExtensionPackPaths,
    isExtensionPackEnabled,
    isExtensionPackCurrentlyEnabled,
    isSavingExtensionPacks,
    setExtensionPackEnabled,
    captureCoreExtensions,
    isCoreExtension,
    hasThirdPartyExtensions
  }
})
