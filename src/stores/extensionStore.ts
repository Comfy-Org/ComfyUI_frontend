import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { SettingWriteResult } from '@/platform/settings/types'
import type { ComfyExtension } from '@/types/comfy'

/** Display name for an extension pack path. */
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
  const bootDisabledExtensionPackPaths = ref<Set<string>>(new Set())

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
    bootDisabledExtensionPackPaths.value = new Set(disabledPaths)
  }

  const wasExtensionPackEnabledAtBoot = (path: string) =>
    !bootDisabledExtensionPackPaths.value.has(path)

  const disabledExtensionPackPaths = computed(
    () => new Set(useSettingStore().get('Comfy.Extension.DisabledPacks'))
  )

  const isExtensionPackEnabled = (path: string) =>
    !disabledExtensionPackPaths.value.has(path)

  const unacknowledgedPackSaves = ref(0)
  const isSavingExtensionPacks = computed(
    () => unacknowledgedPackSaves.value > 0
  )

  let packSaveChain: Promise<unknown> = Promise.resolve()

  /** Enable or disable a whole pack, serialized behind any save still in flight. */
  async function setExtensionPackEnabled(
    path: string,
    enabled: boolean
  ): Promise<SettingWriteResult> {
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

    const run = packSaveChain.then(write)
    packSaveChain = run.catch(() => {})
    unacknowledgedPackSaves.value++
    try {
      return await run
    } finally {
      unacknowledgedPackSaves.value--
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
    wasExtensionPackEnabledAtBoot,
    isExtensionPackEnabled,
    isSavingExtensionPacks,
    setExtensionPackEnabled,
    captureCoreExtensions,
    isCoreExtension,
    hasThirdPartyExtensions
  }
})
