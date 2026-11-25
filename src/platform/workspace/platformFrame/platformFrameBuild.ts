import type { zWorkspaceDeployment } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import type { FrameMessage } from '@/platform/workspace/platformFrame/platformFrameMessages'

type BuildStarted = Extract<FrameMessage, { type: 'build-started' }>

export type BuildStage = 'building' | 'deploying' | 'finishing' | 'failed'

export interface BuildOwner {
  accountId: string | null
  workspaceId: string | null
}

export interface FollowedBuild extends BuildOwner {
  kind: 'new' | 'update'
  buildId: string
  deploymentId: string
  deploymentName: string
  releaseId: string
  version: number
  previousReleaseId: string | null
  previousVersion: number | null
  stage: BuildStage
  progress: { step: number; of: number } | null
  startedAt: number
}

type RunningRelease = Pick<
  z.infer<typeof zWorkspaceDeployment>,
  'release_id' | 'release_version'
>

export const KEPT_BUILD_KEY = 'Comfy.Deployment.FollowedBuild'

export const KEPT_BUILD_MAX_AGE_MS = 2 * 60 * 60 * 1000

export function startFollowing(
  message: BuildStarted,
  running: RunningRelease | undefined,
  owner: BuildOwner
): FollowedBuild {
  return {
    ...owner,
    kind: message.kind,
    buildId: message.buildId,
    deploymentId: message.deploymentId,
    deploymentName: message.deploymentName,
    releaseId: message.releaseId,
    version: message.version,
    previousReleaseId: running?.release_id ?? null,
    previousVersion: running?.release_version ?? null,
    stage: 'building',
    progress: null,
    startedAt: Date.now()
  }
}

export function isAbout(build: FollowedBuild, message: FrameMessage): boolean {
  return 'releaseId' in message && message.releaseId === build.releaseId
}

export function isOwnedBy(build: BuildOwner, owner: BuildOwner): boolean {
  return (
    build.accountId !== null &&
    build.accountId === owner.accountId &&
    build.workspaceId === owner.workspaceId
  )
}

export function isInFlight(build: FollowedBuild | null): boolean {
  return build?.stage === 'building' || build?.stage === 'deploying'
}

export function holdsFrame(build: FollowedBuild | null): boolean {
  return isInFlight(build) || build?.stage === 'finishing'
}

export function isReadyNewsFor(
  build: FollowedBuild,
  message: FrameMessage
): boolean {
  return (
    message.type !== 'deployment-ready' ||
    build.kind === 'new' ||
    message.deploymentId === build.deploymentId
  )
}

function isFailure(message: FrameMessage): boolean {
  return message.type === 'build-failed' || message.type === 'deploy-failed'
}

function withDeploymentId(
  build: FollowedBuild,
  deploymentId: string
): FollowedBuild {
  return deploymentId ? { ...build, deploymentId } : build
}

export function advanceBuild(
  build: FollowedBuild,
  message: FrameMessage
): FollowedBuild {
  if (!isAbout(build, message)) return build
  if (build.stage === 'finishing' && !isFailure(message)) return build
  switch (message.type) {
    case 'build-progress':
      return { ...build, progress: { step: message.step, of: message.of } }
    case 'deploy-sent':
      return {
        ...withDeploymentId(build, message.deploymentId),
        stage: 'deploying'
      }
    case 'deployment-ready':
      return withDeploymentId(build, message.deploymentId)
    case 'build-failed':
    case 'deploy-failed':
      return { ...build, stage: 'failed' }
    default:
      return build
  }
}

const zKeptBuild = z.object({
  kind: z.enum(['new', 'update']),
  buildId: z.string(),
  accountId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  deploymentId: z.string(),
  deploymentName: z.string(),
  releaseId: z.string(),
  version: z.number(),
  previousReleaseId: z.string().nullable(),
  previousVersion: z.number().nullable(),
  stage: z.enum(['building', 'deploying']),
  progress: z.null(),
  startedAt: z.number()
})

export function keepBuild(build: FollowedBuild): void {
  try {
    sessionStorage.setItem(
      KEPT_BUILD_KEY,
      JSON.stringify({ ...build, progress: null })
    )
  } catch {
    return
  }
}

export function forgetBuild(): void {
  try {
    sessionStorage.removeItem(KEPT_BUILD_KEY)
  } catch {
    return
  }
}

export function readKeptBuild(): FollowedBuild | null {
  let kept: unknown
  try {
    const raw = sessionStorage.getItem(KEPT_BUILD_KEY)
    kept = raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = zKeptBuild.safeParse(kept)
  if (
    !parsed.success ||
    Date.now() - parsed.data.startedAt > KEPT_BUILD_MAX_AGE_MS
  ) {
    forgetBuild()
    return null
  }
  return parsed.data
}
