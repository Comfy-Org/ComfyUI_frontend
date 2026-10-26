import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/**
 * Starts the page's boot listing (FE-2434), so the editor learns which
 * deployment it booted on, and tells the person when that listing says their
 * own pick is gone. Ingest says so on that one listing only, while clearing
 * the pick, so without this a person who never opens the switcher would not
 * learn that this browser now runs on Comfy Cloud.
 */
export async function useDeploymentPickAtBoot(): Promise<void> {
  const store = useDeploymentPickStore()
  await store.loadOnce()
  if (store.goneDeployment !== 'pick') return
  useToastStore().add({
    severity: 'warn',
    summary: t('deploymentSwitcher.pickGone'),
    detail: t('deploymentSwitcher.pickGoneDetail'),
    life: 10000
  })
}
