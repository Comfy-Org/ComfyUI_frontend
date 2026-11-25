import { until } from '@vueuse/core'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { canHandOffToCloud } from '@/platform/openOnCloud/localHandoffProtocol'
import { bindLocalOpenOnCloudGrant } from '@/platform/openOnCloud/localOpenOnCloudRollout'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useDialogStore } from '@/stores/dialogStore'
import type { MissingModel } from '@/platform/openOnCloud/stores/localModelUploadStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { openCardDialog } from '@/platform/workspace/openCustomDeploymentDialog'

const RUN_ON_CLOUD_DIALOG_KEY = 'global-run-on-comfy-cloud'

export function closeRunOnCloudDialog({
  keepUploadBatch = false
}: { keepUploadBatch?: boolean } = {}): boolean {
  const dialogStore = useDialogStore()
  const dialog = dialogStore.dialogStack.find(
    ({ key }) => key === RUN_ON_CLOUD_DIALOG_KEY
  )
  if (!dialog || (keepUploadBatch && dialog.contentProps.uploadBatch))
    return false
  dialogStore.closeDialog({ key: RUN_ON_CLOUD_DIALOG_KEY })
  return true
}

async function signInToUpload(): Promise<void> {
  const { flags } = useFeatureFlags()
  const workflows = useWorkflowStore()
  const workflow = workflows.activeWorkflow
  if (!(await useAuthDialogs().showSignInDialog())) return

  const grant = bindLocalOpenOnCloudGrant()
  const canResume = () =>
    grant.isCurrent() &&
    workflows.activeWorkflow === workflow &&
    flags.openOnCloudEnabled &&
    flags.openOnCloudModelUploadEnabled &&
    canHandOffToCloud()

  if (!(await grant.revalidate()) || !canResume()) return
  const check = useCloudWorkflowCheckStore()
  if (check.state.phase !== 'checking') void check.check()

  while (canResume()) {
    await until(() => check.state.phase !== 'checking' || !canResume()).toBe(
      true
    )
    const checked = check.state
    if (!canResume() || checked.phase !== 'answered') return

    const opened = await openRunOnCloudDialog(
      () => canResume() && check.state === checked
    )
    if (opened || check.state === checked) return
  }
}

export function openRunOnCloudDialog(
  isStillWanted: () => boolean,
  {
    uploadBatch
  }: { uploadBatch?: { models: MissingModel[]; owner: string } } = {}
): Promise<boolean> {
  return openCardDialog(
    RUN_ON_CLOUD_DIALOG_KEY,
    () => import('@/platform/openOnCloud/components/RunOnCloudDialog.vue'),
    { uploadBatch, onSignInToUpload: signInToUpload },
    isStillWanted
  )
}

export function openDeploySetupDialog(): Promise<boolean> {
  return openCardDialog(
    RUN_ON_CLOUD_DIALOG_KEY,
    () => import('@/platform/openOnCloud/components/DeploySetupCard.vue'),
    { videoSources: DEPLOY_VIDEO_SOURCES, posterSrc: DEPLOY_VIDEO_POSTER_SRC }
  )
}
