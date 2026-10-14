import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export async function waitForDeploymentPick(): Promise<boolean> {
  const store = useDeploymentPickStore()
  const listing = store.loadOnce()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      listing.then(() => store.bootDeployment !== undefined),
      new Promise<false>((resolve) => {
        timeout = setTimeout(
          () => resolve(false),
          DEPLOYMENT_LISTING_BACKSTOP_MS
        )
      })
    ])
  } finally {
    clearTimeout(timeout)
  }
}
