import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/**
 * Waits, at most `DEPLOYMENT_LISTING_BACKSTOP_MS`, for the boot listing to
 * say which deployment this page booted on, so the editor offers that
 * deployment's models. True when it said so (Comfy Cloud included). False
 * when it failed after its retries or did not answer in time: the page then
 * boots on Comfy Cloud's models (`bootOnComfyCloud`).
 */
export async function waitForDeploymentPick(): Promise<boolean> {
  const store = useDeploymentPickStore()
  const listing = store.loadOnce()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const confirmed = await Promise.race([
      listing.then(() => store.bootDeployment !== undefined),
      new Promise<false>((resolve) => {
        timeout = setTimeout(
          () => resolve(false),
          DEPLOYMENT_LISTING_BACKSTOP_MS
        )
      })
    ])
    if (!confirmed) store.bootOnComfyCloud()
    return confirmed
  } finally {
    clearTimeout(timeout)
  }
}
