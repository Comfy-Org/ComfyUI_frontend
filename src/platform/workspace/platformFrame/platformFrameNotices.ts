import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { switchReloadNote } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import type { FollowedBuild } from '@/platform/workspace/platformFrame/platformFrameBuild'
import { useReleaseNoticeStore } from '@/platform/workspace/stores/releaseNoticeStore'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import type { ToastId } from '@/types/toastId'

const SHORT_NOTICE_MS = 8000

function runsRelease(job: Record<string, unknown>, releaseId: string): boolean {
  const deployment = job.deployment
  return (
    typeof deployment === 'object' &&
    deployment !== null &&
    'release_id' in deployment &&
    deployment.release_id === releaseId
  )
}

export function jobsOnRelease(releaseId: string): number {
  const queue = useQueueStore()
  return [...queue.runningTasks, ...queue.pendingTasks].filter((task) =>
    runsRelease(task.job, releaseId)
  ).length
}

function named(build: FollowedBuild) {
  return { deployment: build.deploymentName }
}

export function noticeBuildStarted(build: FollowedBuild, id: ToastId) {
  useToast().info(
    t('platformFrame.building', named(build), { escapeParameter: false }),
    {
      id,
      description: t('platformFrame.buildTakesMinutes'),
      duration: SHORT_NOTICE_MS
    }
  )
}

function finishingLine(build: FollowedBuild): string | undefined {
  if (build.previousReleaseId === null || build.previousVersion === null)
    return undefined
  const count = jobsOnRelease(build.previousReleaseId)
  if (count === 0) return undefined
  return t(
    'platformFrame.finishingOnPrevious',
    { count, version: build.previousVersion },
    count
  )
}

interface ReadyActions {
  switchTo: () => Promise<void>
  reload: (() => void) | null
}

export function noticeBuildReady(
  build: FollowedBuild,
  id: ToastId,
  { switchTo, reload }: ReadyActions
) {
  const toast = useToast()
  if (build.kind === 'new') {
    toast.success(
      t('platformFrame.readyNew', named(build), { escapeParameter: false }),
      {
        id,
        description: switchReloadNote(),
        action: { label: t('platformFrame.switch'), onClick: switchTo }
      }
    )
    return
  }
  if (!useReleaseNoticeStore().claim(build.releaseId)) {
    toast.dismiss(id)
    return
  }
  const title = t(
    reload ? 'platformFrame.readyUpdateReload' : 'platformFrame.readyUpdate',
    { ...named(build), version: build.version },
    { escapeParameter: false }
  )
  const description = finishingLine(build)
  if (!reload) {
    toast.success(title, { id, description, duration: SHORT_NOTICE_MS })
    return
  }
  toast.success(title, {
    id,
    description,
    actions: [
      { label: t('platformFrame.reload'), onClick: reload },
      { label: t('platformFrame.later'), onClick: () => toast.close(id) }
    ]
  })
}

function failureTitle(
  build: FollowedBuild,
  failed: 'build-failed' | 'deploy-failed'
): string {
  if (build.kind === 'update' && failed === 'deploy-failed')
    return t(
      'platformFrame.updateUnfinished',
      { ...named(build), version: build.version },
      { escapeParameter: false }
    )
  if (build.kind === 'update')
    return build.previousVersion === null
      ? t('platformFrame.nothingChangedNoVersion', named(build), {
          escapeParameter: false
        })
      : t(
          'platformFrame.nothingChanged',
          { ...named(build), version: build.previousVersion },
          { escapeParameter: false }
        )
  return t(
    failed === 'build-failed'
      ? 'platformFrame.buildFailed'
      : 'platformFrame.deployFailed',
    named(build),
    { escapeParameter: false }
  )
}

export function noticeBuildFailed(
  build: FollowedBuild,
  id: ToastId,
  failure: { failed: 'build-failed' | 'deploy-failed'; reason: string },
  viewDetails: () => void
) {
  useToast().error(failureTitle(build, failure.failed), {
    id,
    description: failure.reason || undefined,
    action: { label: t('platformFrame.viewDetails'), onClick: viewDetails }
  })
}
