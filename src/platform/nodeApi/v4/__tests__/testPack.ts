import type { ComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import type { ServedPack } from '@/platform/nodeApi/shared/versionHost'
import type { Comfy, PackId } from '@/platform/nodeApi/v4/types'

export const TEST_PACK: ServedPack = {
  segment: 'test-pack',
  id: 'test-pack',
  version: '1.0.0'
}

/** The URL of a module of the pack served at `segment`, under the page's `/extensions/`. */
export function moduleUrl(segment: string, file = 'main.js'): string {
  return new URL(`/extensions/${segment}/${file}`, window.location.href).href
}

/** Gives the host the backend's record of `served` and registers it, as the pack's module would. */
export function registerTestPack(
  { comfy, host }: Pick<ComfyApi, 'comfy' | 'host'>,
  served: ServedPack = TEST_PACK
): PackId {
  host.providePacks([served])
  return comfy.registerPack({ url: moduleUrl(served.segment) })
}

/** The same through the app's store, for the published API. */
export function registerPublishedTestPack(
  comfy: Comfy,
  served: ServedPack = TEST_PACK
): PackId {
  useComfyApiStore().providePacks([served])
  return comfy.registerPack({ url: moduleUrl(served.segment) })
}
