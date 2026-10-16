import { t } from '@/i18n'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'
import { useDialogStore } from '@/stores/dialogStore'

async function openCustomDeploymentDialog(
  key: string,
  pitch: CustomDeploymentPitch
): Promise<void> {
  const { default: CustomDeploymentCard } =
    await import('@/platform/workspace/components/CustomDeploymentCard.vue')
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key })
  dialogStore.showDialog({
    key,
    component: CustomDeploymentCard,
    props: {
      pitch,
      videoSources: DEPLOY_VIDEO_SOURCES,
      posterSrc: DEPLOY_VIDEO_POSTER_SRC,
      onDone: hide,
      onDismiss: hide
    },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true
    }
  })
}

/** Opens the dialog behind Create a custom deployment in the Run on list. */
export function openCreateCustomDeploymentDialog(): Promise<void> {
  return openCustomDeploymentDialog('global-create-custom-deployment', {
    title: t('deploymentSwitcher.customDeployment.title'),
    body: t('deploymentSwitcher.customDeployment.body'),
    points: [
      t('deploymentSwitcher.customDeployment.pointNodes'),
      t('deploymentSwitcher.customDeployment.pointGpu'),
      t('deploymentSwitcher.customDeployment.pointApi')
    ],
    platformLabel: t('deploymentSwitcher.customDeployment.createOnPlatform')
  })
}

/** Opens the dialog the Extensions button shows on Comfy Cloud. */
export function openDeployCustomNodesDialog(): Promise<void> {
  return openCustomDeploymentDialog('global-deploy-custom-nodes', {
    title: t('deploymentSwitcher.deployCustomNodes.title'),
    body: t('deploymentSwitcher.deployCustomNodes.body'),
    points: [
      t('deploymentSwitcher.deployCustomNodes.pointNodes'),
      t('deploymentSwitcher.customDeployment.pointGpu'),
      t('deploymentSwitcher.customDeployment.pointApi')
    ],
    platformLabel: t('deployToComfyApi.deployOnPlatform')
  })
}
