import type { FrameMessage } from '@/platform/workspace/platformFrame/platformFrameMessages'

type BuildStarted = Extract<FrameMessage, { type: 'build-started' }>

export type BuildStage = 'building' | 'deploying' | 'waiting' | 'failed'

export interface FollowedBuild {
  kind: 'new' | 'update'
  deploymentId: string
  deploymentName: string
  releaseId: string
  version: number
  previousReleaseId: string | null
  previousVersion: number | null
  stage: BuildStage
  progress: { step: number; of: number } | null
}

export interface RunningRelease {
  release_id: string
  release_version?: number
}

export function startFollowing(
  message: BuildStarted,
  running: RunningRelease | undefined
): FollowedBuild {
  return {
    kind: message.kind,
    deploymentId: message.deploymentId,
    deploymentName: message.deploymentName,
    releaseId: message.releaseId,
    version: message.version,
    previousReleaseId: running?.release_id ?? null,
    previousVersion: running?.release_version ?? null,
    stage: 'building',
    progress: null
  }
}

export function isAbout(build: FollowedBuild, message: FrameMessage): boolean {
  return 'releaseId' in message && message.releaseId === build.releaseId
}

export function isInFlight(build: FollowedBuild | null): boolean {
  return build !== null && build.stage !== 'failed'
}

export function advanceBuild(
  build: FollowedBuild,
  message: FrameMessage
): FollowedBuild {
  if (!isAbout(build, message)) return build
  switch (message.type) {
    case 'build-progress':
      return { ...build, progress: { step: message.step, of: message.of } }
    case 'deploy-sent':
      return { ...build, stage: 'deploying' }
    case 'build-waiting':
      return { ...build, stage: 'waiting' }
    case 'build-failed':
    case 'deploy-failed':
      return { ...build, stage: 'failed' }
    default:
      return build
  }
}
