import { z } from 'zod'

import type { FrameMessage } from '@/platform/workspace/platformFrame/platformFrameMessages'

type BuildStarted = Extract<FrameMessage, { type: 'build-started' }>

export type BuildStage = 'building' | 'deploying' | 'failed'

export interface FollowedBuild {
  kind: 'new' | 'update'
  buildId: string
  workspaceId: string | null
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

export interface RunningRelease {
  release_id: string
  release_version?: number
}

export const KEPT_BUILD_KEY = 'Comfy.Deployment.FollowedBuild'

export const KEPT_BUILD_MAX_AGE_MS = 2 * 60 * 60 * 1000

export function startFollowing(
  message: BuildStarted,
  running: RunningRelease | undefined,
  workspaceId: string | null
): FollowedBuild {
  return {
    kind: message.kind,
    buildId: message.buildId,
    workspaceId,
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
