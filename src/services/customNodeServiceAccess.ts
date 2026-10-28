import type { ComfyExtension } from '@/types/comfy'

interface CustomNodeServiceAccess {
  invokeExtensions(
    method: 'onNodeOutputsUpdated',
    ...args: Parameters<NonNullable<ComfyExtension['onNodeOutputsUpdated']>>
  ): unknown
}

/** `useCustomNodeService` for `queueStore`, which `customNodeService` reaches through the widget stores. */
export let useCustomNodeServiceAccess: () => CustomNodeServiceAccess

/** Called by `customNodeService` when it loads. */
export function provideCustomNodeService(
  useService: () => CustomNodeServiceAccess
): void {
  useCustomNodeServiceAccess = useService
}
