import type { ComfyExtension } from '@/types/comfy'

interface ExtensionServiceAccess {
  invokeExtensions(
    method: 'onNodeOutputsUpdated',
    ...args: Parameters<NonNullable<ComfyExtension['onNodeOutputsUpdated']>>
  ): unknown
}

/** `useExtensionService` for `queueStore`, which `extensionService` reaches through the widget stores. */
export let useExtensionServiceAccess: () => ExtensionServiceAccess

/** Called by `extensionService` when it loads. */
export function provideExtensionService(
  useService: () => ExtensionServiceAccess
): void {
  useExtensionServiceAccess = useService
}
