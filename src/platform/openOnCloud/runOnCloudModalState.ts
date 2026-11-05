import type {
  CloudMissingModel,
  CloudWorkflowCheckState
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ModelUploadState } from '@/platform/openOnCloud/modelUpload'
import { uploadPercent } from '@/platform/openOnCloud/modelUpload'

export type RunOnCloudModalState =
  | { kind: 'checking' }
  | { kind: 'ready'; asksToSignIn: boolean }
  | { kind: 'deploySetup' }
  | {
      kind: 'uploadModels'
      models: CloudMissingModel[]
      signInToUpload: boolean
    }
  | { kind: 'uploading'; models: CloudMissingModel[]; percent: number }

export function runOnCloudModalState(
  check: CloudWorkflowCheckState,
  upload: ModelUploadState,
  { signedIn }: { signedIn: boolean }
): RunOnCloudModalState {
  if (upload.phase === 'uploading')
    return {
      kind: 'uploading',
      models: upload.models,
      percent: uploadPercent(upload.models, upload.uploadedBytes)
    }
  if (check.phase !== 'answered') return { kind: 'checking' }
  const { verdict } = check
  switch (verdict.kind) {
    case 'canOpen':
      return { kind: 'ready', asksToSignIn: !signedIn }
    case 'missing':
      return verdict.gaps.nodePacks.length > 0
        ? { kind: 'deploySetup' }
        : {
            kind: 'uploadModels',
            models: verdict.gaps.models,
            signInToUpload: !signedIn
          }
  }
}
