import type {
  CloudMissingModel,
  CloudWorkflowCheckState,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ModelUploadState } from '@/platform/openOnCloud/modelUpload'
import { uploadPercent } from '@/platform/openOnCloud/modelUpload'

/** The one modal the Comfy Cloud button opens. */
export type RunOnCloudModalState =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'ready' }
  | { kind: 'nodePacksMissing'; gaps: CloudWorkflowGaps }
  | { kind: 'uploadModels'; models: CloudMissingModel[] }
  | { kind: 'uploading'; models: CloudMissingModel[]; percent: number }

/** Renders Comfy Cloud's answer as received; a running upload shows over it. */
export function runOnCloudModalState(
  check: CloudWorkflowCheckState,
  upload: ModelUploadState
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
      return { kind: 'ready' }
    case 'signedOut':
      return { kind: 'signedOut' }
    case 'missing':
      return verdict.gaps.nodePacks.length > 0
        ? { kind: 'nodePacksMissing', gaps: verdict.gaps }
        : { kind: 'uploadModels', models: verdict.gaps.models }
  }
}
