export async function openDeployToComfyApiDialog() {
  const { useDeployToComfyApiDialog } =
    await import('@/platform/workflow/deploy/composables/useDeployToComfyApiDialog')
  useDeployToComfyApiDialog().show()
}
