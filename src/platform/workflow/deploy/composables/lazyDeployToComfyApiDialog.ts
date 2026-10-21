import type { DeployToComfyApiDialogOptions } from '@/platform/workflow/deploy/composables/useDeployToComfyApiDialog'

export async function openDeployToComfyApiDialog(
  options?: DeployToComfyApiDialogOptions
) {
  const { useDeployToComfyApiDialog } =
    await import('@/platform/workflow/deploy/composables/useDeployToComfyApiDialog')
  useDeployToComfyApiDialog().show(options)
}
