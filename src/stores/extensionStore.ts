import { ref, computed, markRaw } from 'vue'
import { defineStore } from 'pinia'
import type { ComfyExtension } from '@/types/comfy'
import { useKeybindingStore } from './keybindingStore'
import { useCommandStore } from './commandStore'
import { useSettingStore } from './settingStore'
import { app } from '@/scripts/app'
import { useMenuItemStore } from './menuItemStore'

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

  const isExtensionEnabled = (name: string) =>
    !disabledExtensionNames.value.has(name)
  const enabledExtensions = computed(() => {
    return extensions.value.filter((ext) => isExtensionEnabled(ext.name))
  })

  function registerExtension(extension: ComfyExtension) {
    if (!extension.name) {
      throw new Error("Extensions must have a 'name' property.")
    }

    if (extensionByName.value[extension.name]) {
      throw new Error(`Extension named '${extension.name}' already registered.`)
    }

    if (disabledExtensionNames.value.has(extension.name)) {
      console.log(`Extension ${extension.name} is disabled.`)
    }

    extensionByName.value[extension.name] = markRaw(extension)
    useKeybindingStore().loadExtensionKeybindings(extension)
    useCommandStore().loadExtensionCommands(extension)
    useMenuItemStore().loadExtensionMenuCommands(extension)

    /*
     * Extensions are currently stored in both extensionStore and app.extensions.
     * Legacy jest tests still depend on app.extensions being populated.
     */
    app.extensions.push(extension)
  }

  function loadDisabledExtensionNames() {
    disabledExtensionNames.value = new Set(
      useSettingStore().get('Comfy.Extension.Disabled')
    )
    // pysssss.Locking is replaced by pin/unpin in ComfyUI core.
    // https://github.com/Comfy-Org/litegraph.js/pull/117
    disabledExtensionNames.value.add('pysssss.Locking')
    // pysssss.SnapToGrid is replaced by Comfy.Graph.AlwaysSnapToGrid in ComfyUI core.
    // pysssss.SnapToGrid tries to write global app.shiftDown state, which is no longer
    // allowed since v1.3.12.
    // https://github.com/Comfy-Org/ComfyUI_frontend/issues/1176
    disabledExtensionNames.value.add('pysssss.SnapToGrid')
  }

  // Some core extensions are registered before the store is initialized, e.g.
  // colorPalette.
  // Register them manually here so the state of app.extensions and
  // extensionByName are in sync.
  for (const ext of app.extensions) {
    extensionByName.value[ext.name] = markRaw(ext)
  }

  return {
    extensions,
    enabledExtensions,
    inactiveDisabledExtensionNames,
    isExtensionEnabled,
    registerExtension,
    loadDisabledExtensionNames
  }
})
