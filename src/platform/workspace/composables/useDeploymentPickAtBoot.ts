import { until } from '@vueuse/core'

import { t } from '@/i18n'
import { useToast } from '@/components/ui/toast/toastStore'
import { useBootDeploymentFullLabel } from '@/platform/workspace/composables/useDeploymentLabels'
import { takeDeploymentSwitchLanding } from '@/platform/workspace/deploymentSwitchReload'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/**
 * Starts the page's boot listing (FE-2434), so the editor learns which
 * deployment it booted on. Tells the person when their own pick is gone, which
 * ingest says on that one listing only, and where the editor landed after a
 * switch reloaded it.
 */
export async function useDeploymentPickAtBoot(): Promise<void> {
  const landedFromSwitch = takeDeploymentSwitchLanding()
  const store = useDeploymentPickStore()
  await store.loadOnce()
  if (store.goneDeployment === 'pick') {
    useToast().warning(t('deploymentSwitcher.pickGone'), {
      description: t('deploymentSwitcher.pickGoneDetail'),
      duration: 10000
    })
    return
  }
  if (landedFromSwitch) {
    void until(useBootDeploymentFullLabel()).not.toBeUndefined().then(sayLanded)
  }
}

function sayLanded(deployment: string) {
  useToast().success(
    t('deploymentSwitcher.landed', { deployment }, { escapeParameter: false }),
    { duration: 5000 }
  )
}
