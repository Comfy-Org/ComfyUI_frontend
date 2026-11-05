import type { Component } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const RUN_ON_CLOUD_DIALOG_KEY = 'global-run-on-comfy-cloud'

export function closeRunOnCloudDialog(): boolean {
  const dialogStore = useDialogStore()
  if (!dialogStore.isDialogOpen(RUN_ON_CLOUD_DIALOG_KEY)) return false
  dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  return true
}

function showCloudDialog(component: Component, props: Record<string, unknown>) {
  const dialogStore = useDialogStore()
  const hide = () => dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  dialogStore.showDialog({
    key: RUN_ON_CLOUD_DIALOG_KEY,
    component,
    props: {
      ...props,
      titleId: RUN_ON_CLOUD_DIALOG_KEY,
      onDone: hide,
      onDismiss: hide
    },
    dialogComponentProps: {
      dismissOnPointerDownOutside: true,
      headless: true
    }
  })
}

export async function openRunOnCloudDialog(): Promise<void> {
  const { default: component } =
    await import('@/platform/openOnCloud/components/RunOnCloudDialog.vue')
  showCloudDialog(component, {})
}

export async function openDeploySetupDialog(): Promise<void> {
  const { default: component } =
    await import('@/platform/openOnCloud/components/DeploySetupCard.vue')
  showCloudDialog(component, {
    videoSources: DEPLOY_VIDEO_SOURCES,
    posterSrc: DEPLOY_VIDEO_POSTER_SRC
  })
}
