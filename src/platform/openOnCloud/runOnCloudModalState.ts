import type { CompatibilityModel } from '@comfyorg/ingest-types'

import type {
  CloudWorkflowCheckState,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { isModelFileName } from '@/platform/workflowErrors/missingModel/missingModelScan'

export type RunOnCloudModalState =
  | { kind: 'checking' }
  | { kind: 'ready'; asksToSignIn: boolean }
  | { kind: 'deploySetup' }
  | { kind: 'missingModels'; models: CompatibilityModel[] }

function needsDeployment({ nodePacks, models }: CloudWorkflowGaps): boolean {
  return (
    nodePacks.length > 0 || models.some((model) => !isModelFileName(model.name))
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
