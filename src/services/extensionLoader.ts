import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

export function shouldLoadExtension(
  extension: string,
  isCloudBuild: boolean
): boolean {
  if (extension.includes('extensions/core')) return false
  return !isCloudBuild || !INLINED_CLOUD_EXTENSIONS.has(extension)
}

/**
 * Loads the core extensions, then every extension served by the backend, in
 * parallel. Core extensions load first because custom extensions may depend
 * on them.
 */
export async function loadExtensions() {
  const extensionStore = useExtensionStore()
  extensionStore.loadDisabledExtensionNames(
    useSettingStore().get('Comfy.Extension.Disabled')
  )

  const extensions = await api.getExtensions()

  await bootstrapTracer.settle(
    'bootstrap/extensions-load-core',
    () => import('@/extensions/core/index')
  )
  extensionStore.captureCoreExtensions()
  await bootstrapTracer.settle('bootstrap/extensions-load-custom', () =>
    Promise.all(
      extensions
        .filter((extension) =>
          shouldLoadExtension(extension, __DISTRIBUTION__ === 'cloud')
        )
        .map(async (ext) => {
          try {
            await import(/* @vite-ignore */ api.fileURL(ext))
          } catch (error) {
            console.error('Error loading extension', ext, error)
            reportError(error, {
              errorType: 'extension_load_failed',
              level: 'warning'
            })
          }
        })
    )
  )
}
