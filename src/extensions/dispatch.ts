import { isCloud } from '@/platform/distribution/types'
import type {
  ComfyExtensionConfigs,
  ComfyExtensionEntrance,
  ComfyExtensionLoadContext
} from './types'
import { formatExtensions, shouldLoadExtension } from './utils'

const extLoadContext: ComfyExtensionLoadContext = {
  get isCloud() {
    return isCloud
  },
  get subscriptionRequired() {
    return !!window.__CONFIG__?.subscription_required
  }
}

export async function dispatchComfyExtensions(options: {
  configs: ComfyExtensionConfigs
  entrance: ComfyExtensionEntrance
}) {
  const { configs, entrance } = options
  const extensions = formatExtensions(entrance, configs)
  for (const extension of Object.values(extensions)) {
    if (shouldLoadExtension(extLoadContext, extension.config)) {
      const module = await extension.entry()
      console.log('✅ extension', extension.name, 'loaded', extension, module)
    } else {
      console.log('❌ extension', extension.name, 'disabled', extension.config)
    }
  }
}
