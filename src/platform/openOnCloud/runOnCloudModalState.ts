import type { CompatibilityModel } from '@comfyorg/ingest-types'

import type {
  CloudWorkflowCheckState,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

export type RunOnCloudModalState =
  | { kind: 'checking' }
  | { kind: 'ready'; asksToSignIn: boolean }
  | { kind: 'deploySetup' }
  | { kind: 'missingModels'; models: CompatibilityModel[] }

function isFileName(name: string): boolean {
  return /\.[^./\\]+$/.test(name)
}

function needsDeployment({ nodePacks, models }: CloudWorkflowGaps): boolean {
  return (
    nodePacks.length > 0 ||
    pendingServerFact(
      'BE-27119',
      models.some((model) => !isFileName(model.name))
    )
  )
}

export function runOnCloudModalState(
  check: CloudWorkflowCheckState,
  { signedIn }: { signedIn: boolean }
): RunOnCloudModalState {
  if (check.phase !== 'answered') return { kind: 'checking' }
  const { verdict } = check
  switch (verdict.kind) {
    case 'canOpen':
      return { kind: 'ready', asksToSignIn: !signedIn }
    case 'missing':
      return needsDeployment(verdict.gaps)
        ? { kind: 'deploySetup' }
        : {
            kind: 'missingModels',
            models: verdict.gaps.models
          }
  }
}
