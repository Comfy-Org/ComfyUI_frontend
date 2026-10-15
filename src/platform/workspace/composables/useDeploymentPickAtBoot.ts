import { t } from '@/i18n'
import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
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
  if (!landedFromSwitch || store.bootDeployment === undefined) return
  useToast().success(
    t(
      'deploymentSwitcher.landed',
      { deployment: useBootDeploymentFullLabel().value },
      { escapeParameter: false }
    ),
    {
      description: useSettingStore().get('Comfy.Workflow.Persist')
        ? t('deploymentSwitcher.landedDetail')
        : undefined,
      duration: 5000
    }
  )
}
