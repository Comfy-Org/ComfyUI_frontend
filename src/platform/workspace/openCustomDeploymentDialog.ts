import { nextTick } from 'vue'
import type { Component } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import { CUSTOM_DEPLOYMENT_BRIEF } from '@/platform/workspace/customDeploymentBrief'
import { customDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'
import { useDialogStore } from '@/stores/dialogStore'

async function openCardDialog(
  key: string,
  load: () => Promise<{ default: Component }>,
  props: Record<string, unknown>
): Promise<boolean> {
  const card = await load().then(
    (module) => module.default,
    (error: unknown) => {
      useErrorHandling().toastErrorHandler(error)
      return null
    }
  )
  if (card === null) return false
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key })
  dialogStore.showDialog({
    key,
    component: card,
    props: { ...props, onDone: hide, onDismiss: hide },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true
    }
  })
  return true
}

function openCustomDeploymentDialog(
  key: string,
  pitch: CustomDeploymentPitch
): Promise<boolean> {
  return openCardDialog(
    key,
    () => import('@/platform/workspace/components/CustomDeploymentCard.vue'),
    {
      pitch,
      videoSources: DEPLOY_VIDEO_SOURCES,
      posterSrc: DEPLOY_VIDEO_POSTER_SRC
    }
  )
}

/** Opens the Create a custom deployment dialog; false if it could not load. */
export function openCreateCustomDeploymentDialog(): Promise<boolean> {
  return openCustomDeploymentDialog(
    'global-create-custom-deployment',
    customDeploymentPitch()
  )
}

/** Opens the Extensions dialog on Comfy Cloud; false if it could not load. */
export function openDeployCustomNodesDialog(): Promise<boolean> {
  return openCustomDeploymentDialog('global-deploy-custom-nodes', {
    title: t('deploymentSwitcher.deployCustomNodes.title'),
    body: t('deploymentSwitcher.deployCustomNodes.body'),
    points: [
      t('deploymentSwitcher.deployCustomNodes.pointNodes'),
      t('deploymentSwitcher.customDeployment.pointGpu'),
      t('deploymentSwitcher.customDeployment.pointApi')
    ],
    platformLabel: t('deployToComfyApi.deployOnPlatform'),
    brief: CUSTOM_DEPLOYMENT_BRIEF
  })
}

const WORKFLOW_NEEDS_DEPLOYMENT_KEY = 'global-workflow-needs-deployment'

function loadWorkflowNeedsDeploymentCard() {
  return import('@/platform/workspace/components/WorkflowNeedsDeploymentCard.vue')
}

/** Preloads the workflow deployment dialog; false if loading fails. */
export function preloadWorkflowNeedsDeploymentDialog(): Promise<boolean> {
  return loadWorkflowNeedsDeploymentCard().then(
    () => true,
    () => false
  )
}

/** Opens the workflow deployment dialog, replacing an earlier one. */
export async function openWorkflowNeedsDeploymentDialog(): Promise<boolean> {
  const dialogStore = useDialogStore()
  if (dialogStore.isDialogOpen(WORKFLOW_NEEDS_DEPLOYMENT_KEY)) {
    dialogStore.closeDialog({ key: WORKFLOW_NEEDS_DEPLOYMENT_KEY })
    await nextTick()
  }
  return openCardDialog(
    WORKFLOW_NEEDS_DEPLOYMENT_KEY,
    loadWorkflowNeedsDeploymentCard,
    {}
  )
}
