import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import {
  hasExclusiveExtensionHost,
  provideExtensionHost
} from './extensionHostProvider'

interface ExtensionHostInstallContext {
  provideExtensionHost: typeof provideExtensionHost
  comfy: unknown
}

type ExtensionHostInstaller = (
  context: ExtensionHostInstallContext
) => void | Promise<void>

export type ExtensionHostModuleLoader = (url: string) => Promise<unknown>

class ExtensionHostConfigurationError extends Error {}

const importExtensionHostModule: ExtensionHostModuleLoader = async (url) =>
  import(/* @vite-ignore */ url)

function installerFrom(module: unknown): ExtensionHostInstaller | null {
  if (typeof module !== 'object' || module === null) return null
  const install = Reflect.get(module, 'install')
  return typeof install === 'function'
    ? (install.bind(module) as ExtensionHostInstaller)
    : null
}

export async function installConfiguredExtensionHost(
  loadModule: ExtensionHostModuleLoader = importExtensionHostModule
): Promise<boolean> {
  const configuredUrl = remoteConfig.value.extension_host?.module_url
  if (!configuredUrl) return false

  const moduleUrl = new URL(configuredUrl, globalThis.location.href).href
  const installer = installerFrom(await loadModule(moduleUrl))
  if (!installer) {
    throw new ExtensionHostConfigurationError(
      `Extension host module ${moduleUrl} has no install export`
    )
  }

  await installer({
    provideExtensionHost,
    comfy: Reflect.get(globalThis, 'comfy')
  })
  if (!hasExclusiveExtensionHost()) {
    provideExtensionHost(null)
    throw new ExtensionHostConfigurationError(
      `Extension host module ${moduleUrl} is not exclusive`
    )
  }
  return true
}
