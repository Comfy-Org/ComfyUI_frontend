import { t } from '@/i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

const pendingDisables = new Set<string>()
let disableChain: Promise<void> = Promise.resolve()

export function useAgentExtensionActions() {
  const extensionStore = useExtensionStore()

  async function disableExtensionNow(extension: ComfyExtension) {
    if (!extensionStore.isExtensionEnabled(extension.name)) return false

    const status = await extensionStore.setExtensionsEnabled(
      [extension.name],
      false
    )
    if (status !== 'saved' && status !== 'unchanged') {
      useToast().error(t('g.agentExtensionDisableFailed'))
      return false
    }

    window.location.reload()
    return true
  }

  async function disableExtension(extension: ComfyExtension) {
    if (pendingDisables.has(extension.name)) return false
    pendingDisables.add(extension.name)

    const result = disableChain.then(() => disableExtensionNow(extension))
    disableChain = result.then(
      () => undefined,
      () => undefined
    )
    try {
      return await result
    } finally {
      pendingDisables.delete(extension.name)
    }
  }

  return { disableExtension }
}
