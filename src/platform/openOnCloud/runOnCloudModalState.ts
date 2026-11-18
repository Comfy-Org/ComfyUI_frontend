import type { CompatibilityModel } from '@comfyorg/ingest-types'

import type { CloudWorkflowCheckState } from '@/platform/openOnCloud/cloudWorkflowCheck'

export type RunOnCloudModalState =
  | { kind: 'checking' }
  | { kind: 'ready'; asksToSignIn: boolean }
  | { kind: 'deploySetup' }
  | { kind: 'missingModels'; models: CompatibilityModel[] }

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
      return verdict.gaps.nodePacks.length > 0
        ? { kind: 'deploySetup' }
        : {
            kind: 'missingModels',
            models: verdict.gaps.models
          }
  }
}
