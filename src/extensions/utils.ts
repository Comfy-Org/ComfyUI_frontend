import type {
  ComfyExtensionConfig,
  ComfyExtensionConfigs,
  ComfyExtensionEntrance,
  ComfyExtensionLoadContext,
  ComfyExtensionPackages
} from './types'

export function defineComfyExtConfig(
  config: ComfyExtensionConfig
): ComfyExtensionConfig {
  return config
}

export function formatExtensions(
  entrance: ComfyExtensionEntrance,
  configs: ComfyExtensionConfigs
): ComfyExtensionPackages {
  const pkgs: ComfyExtensionPackages = {}
  for (const [entryPath, entry] of Object.entries(entrance)) {
    const pathArr = entryPath.split('/')
    const name = pathArr.at(-2)!
    const path = pathArr.slice(0, -1).join('/')
    if (!name) {
      console.error(`Extension`, path, `has no name`)
      continue
    }
    if (!entry) {
      console.error(`Extension`, path, `has no entrance`)
      continue
    }

    const config = configs[`${path}/comfy.ext.config.ts`]
    if (!config) {
      console.warn(`⚠️ Extension`, path, `has no config`)
    }
    pkgs[name] = { name, path, config, entry }
  }
  return pkgs
}

export function shouldLoadExtension(
  ctx: ComfyExtensionLoadContext,
  extConfig: ComfyExtensionConfig | undefined
): boolean {
  // No Config -> Load Extension
  if (!extConfig) return true

  // Cloud Only Extension
  const { comfyCloud } = extConfig
  if (comfyCloud) {
    if (!ctx.isCloud) return false
    if (comfyCloud === true) return true
    return comfyCloud.subscriptionRequired && ctx.subscriptionRequired
  }

  // Default Extension -> Load Extension
  return true
}
