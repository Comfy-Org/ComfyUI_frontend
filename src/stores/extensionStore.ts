import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'

import type { ComfyExtension } from '@/types/comfy'

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

  /**
   * Register an extension with the store.
   *
   * @returns `true` if the extension was registered, `false` if an extension
   * with the same name was already registered and this one was skipped.
   */
  function registerExtension(extension: ComfyExtension): boolean {
    if (!extension.name) {
      throw new Error("Extensions must have a 'name' property.")
    }

    if (Object.hasOwn(extensionByName.value, extension.name)) {
      // Duplicate registrations are usually caused by the same extension file
      // being served under two URLs (so the module executes twice) or by two
      // node packs shipping a copy of the same extension file. The first
      // registration already did all the work, so keep it and skip this one.
      // Warn instead of throwing so the rest of the re-executed module (and
      // the dynamic import that triggered it) doesn't fail. settingStore and
      // commandStore handle duplicates the same way.
      console.warn(
        `Extension named '${extension.name}' already registered. Skipping duplicate registration.`
      )
      return false
    }

    if (disabledExtensionNames.value.has(extension.name)) {
      console.warn(`Extension ${extension.name} is disabled.`)
    }

    extensionByName.value[extension.name] = markRaw(extension)
    return true
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
    inactiveDisabledExtensionNames,
    isExtensionInstalled,
    isExtensionEnabled,
    isExtensionReadOnly,
    registerExtension,
    loadDisabledExtensionNames,
    captureCoreExtensions,
    isCoreExtension,
    hasThirdPartyExtensions
  }
})
