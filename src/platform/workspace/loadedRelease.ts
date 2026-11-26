import { PromptExecutionError } from '@comfyorg/api-client/ComfyApi'

import { safeSessionStorage } from '@comfyorg/shared-frontend-utils/safeStorage'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { fullDeploymentLabel } from '@/platform/workspace/composables/useDeploymentLabels'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import {
  releaseNoticeId,
  useReleaseNoticeStore
} from '@/platform/workspace/stores/releaseNoticeStore'

const KEPT_RELEASE_KEY = 'Comfy.Deployment.ReleaseForReload'
const RELEASE_CHANGED = 'RELEASE_CHANGED'
const RUN_NOTICE_OWNER = 'refusedRun'

interface KeptRelease {
  deploymentId: string
  staleReleaseIds: string[]
  releaseId: string
}

let keptForThisPage: KeptRelease | null = null

function isKeptRelease(value: unknown): value is KeptRelease {
  return (
    typeof value === 'object' &&
    value !== null &&
    'deploymentId' in value &&
    typeof value.deploymentId === 'string' &&
    'staleReleaseIds' in value &&
    Array.isArray(value.staleReleaseIds) &&
    value.staleReleaseIds.every((id) => typeof id === 'string') &&
    'releaseId' in value &&
    typeof value.releaseId === 'string'
  )
}

function keepForReload(kept: KeptRelease) {
  try {
    safeSessionStorage.setItem(KEPT_RELEASE_KEY, JSON.stringify(kept))
  } catch {
    return
  }
}

export function takeReleaseKeptForReload(): void {
  keptForThisPage = null
  const outcome = safeSessionStorage.read(KEPT_RELEASE_KEY)
  if (!outcome.ok || !safeSessionStorage.remove(KEPT_RELEASE_KEY).ok) return
  try {
    const kept: unknown =
      outcome.value === null ? null : JSON.parse(outcome.value)
    if (isKeptRelease(kept)) keptForThisPage = kept
  } catch {
    return
  }
}

export function loadedReleaseId(): string | undefined {
  if (!isCloud || !useFeatureFlags().flags.customDeploymentsEditorEnabled)
    return undefined
  const boot = useDeploymentPickStore().bootDeployment
  if (!boot) return undefined
  const kept = keptForThisPage
  return kept?.deploymentId === boot.deployment_id &&
    kept.staleReleaseIds.includes(boot.release_id)
    ? kept.releaseId
    : boot.release_id
}

function changedReleaseId(error: unknown): string | null | undefined {
  if (!(error instanceof PromptExecutionError) || error.status !== 409)
    return undefined
  const body: unknown = error.response.error
  if (typeof body !== 'object' || body === null) return undefined
  if (!('type' in body) || body.type !== RELEASE_CHANGED) return undefined
  return 'release_id' in body && typeof body.release_id === 'string'
    ? body.release_id
    : null
}

async function reloadOntoNewRelease(deployment: string) {
  if (!(await confirmUnsavedWorkBeforeSwitch(deployment, { reload: true })))
    return
  const store = useDeploymentPickStore()
  if (store.isSwitching) return
  skipLeavePromptOnce()
  reloadForDeploymentSwitch(() => void store.load())
}

interface ReleaseNotice {
  title: string
  target: string
}

function releaseNotice(releaseId: string | null): ReleaseNotice {
  const store = useDeploymentPickStore()
  const runsOn = store.pickedDeployment
  if (!runsOn || releaseId === null || runsOn.release_id !== releaseId)
    return {
      title: t('deploymentSwitcher.releaseChangedRunUnknown'),
      target: t('deploymentSwitcher.releaseChangedRunUnknownTarget')
    }
  const deployment = fullDeploymentLabel(runsOn)
  const version = runsOn.release_version
  const title =
    version === undefined
      ? t(
          'deploymentSwitcher.releaseChangedRunNoVersion',
          { deployment },
          { escapeParameter: false }
        )
      : t(
          'deploymentSwitcher.releaseChangedRun',
          { deployment, version },
          { escapeParameter: false }
        )
  return { title, target: deployment }
}

export function handledReleaseChange(error: unknown): boolean {
  const releaseId = changedReleaseId(error)
  if (releaseId === undefined) return false
  const store = useDeploymentPickStore()
  const boot = store.bootDeployment
  if (boot && releaseId !== null) {
    const listed = store.deployments.find(
      (candidate) => candidate.deployment_id === boot.deployment_id
    )
    const previous =
      keptForThisPage?.deploymentId === boot.deployment_id
        ? keptForThisPage
        : undefined
    const sent = previous?.staleReleaseIds.includes(boot.release_id)
      ? previous.releaseId
      : undefined
    keepForReload({
      deploymentId: boot.deployment_id,
      staleReleaseIds: [
        ...new Set(
          [
            ...(previous?.staleReleaseIds ?? []),
            sent,
            boot.release_id,
            listed?.release_id
          ].filter((id): id is string => id !== undefined)
        )
      ],
      releaseId
    })
  }
  const notice = releaseNotice(releaseId)
  useReleaseNoticeStore().markShown(RUN_NOTICE_OWNER)
  useToast().info(notice.title, {
    id: releaseNoticeId,
    action: {
      label: t('deploymentSwitcher.reload'),
      onClick: () => void reloadOntoNewRelease(notice.target)
    }
  })
  return true
}
