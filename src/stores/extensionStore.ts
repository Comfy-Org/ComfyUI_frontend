import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ComfyExtension } from '@/types/comfy'
import { useKeybindingStore } from './keybindingStore'
import { useCommandStore } from './commandStore'
import { app } from '@/scripts/app'

export const useExtensionStore = defineStore('extension', () => {
  // For legacy reasons, the name uniquely identifies an extension
  const extensionByName = ref<Record<string, ComfyExtension>>({})
  const extensions = computed(() => Object.values(extensionByName.value))

  function registerExtension(extension: ComfyExtension) {
    if (!extension.name) {
      throw new Error("Extensions must have a 'name' property.")
    }

    // https://github.com/Comfy-Org/litegraph.js/pull/117
    if (extension.name === 'pysssss.Locking') {
      console.log('pysssss.Locking is replaced by pin/unpin in ComfyUI core.')
      return
    }

    if (extensionByName.value[extension.name]) {
      throw new Error(`Extension named '${extension.name}' already registered.`)
    }

    extensionByName.value[extension.name] = extension

    useKeybindingStore().loadExtensionKeybindings(extension)
    useCommandStore().loadExtensionCommands(extension)

    /*
     * Extensions are currently stored in both extensionStore and app.extensions.
     * Legacy jest tests still depend on app.extensions being populated.
     */
    app.extensions.push(extension)
  }

  return {
    extensions,
    registerExtension
  }
})
