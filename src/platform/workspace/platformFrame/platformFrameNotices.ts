import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import type { FollowedBuild } from '@/platform/workspace/platformFrame/platformFrameBuild'
import { useQueueStore } from '@/stores/queueStore'
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

export function noticeBuildWaiting(
  build: FollowedBuild,
  id: ToastId,
  review: () => void
) {
  useToast().info(
    t('platformFrame.buildWaiting', named(build), { escapeParameter: false }),
    { id, action: { label: t('platformFrame.review'), onClick: review } }
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

export function noticeBuildReady(
  build: FollowedBuild,
  id: ToastId,
  openRunOn: () => void
) {
  if (build.kind === 'new') {
    useToast().success(
      t('platformFrame.readyNew', named(build), { escapeParameter: false }),
      {
        id,
        action: { label: t('platformFrame.openRunOn'), onClick: openRunOn }
      }
    )
    return
  }
  useToast().success(
    t(
      'platformFrame.readyUpdate',
      { ...named(build), version: build.version },
      { escapeParameter: false }
    ),
    { id, description: finishingLine(build), duration: SHORT_NOTICE_MS }
  )
}

function failureTitle(
  build: FollowedBuild,
  failed: 'build-failed' | 'deploy-failed'
): string {
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
