import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'

export type ReleaseBuildStepKey =
  | 'queued'
  | 'resolving'
  | 'installing'
  | 'checking'
  | 'packaging'

export interface ReleaseBuildStep {
  key: ReleaseBuildStepKey
  number: number
}

export const RELEASE_BUILD_STEP_COUNT = 4

const STEP_OF_PHASE: Partial<Record<string, ReleaseBuildStep>> = {
  start: { key: 'resolving', number: 1 },
  freeze: { key: 'resolving', number: 1 },
  assemble: { key: 'installing', number: 2 },
  validate: { key: 'checking', number: 3 },
  hash: { key: 'packaging', number: 4 },
  bake: { key: 'packaging', number: 4 },
  artifact_ready: { key: 'packaging', number: 4 },
  ready: { key: 'packaging', number: 4 }
}

const QUEUED: ReleaseBuildStep = { key: 'queued', number: 0 }

/** The user-facing build step of comfy-builder's latest timeline phase. */
export function releaseBuildStep(
  release: ReleaseBuild | null
): ReleaseBuildStep {
  const latest = release?.timeline.at(-1)?.phase
  return (latest === undefined ? undefined : STEP_OF_PHASE[latest]) ?? QUEUED
}
