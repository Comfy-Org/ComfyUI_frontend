import type {
  CloudMissingModel,
  CloudWorkflowCheckState,
  CloudWorkflowGaps
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ModelUploadState } from '@/platform/openOnCloud/modelUpload'
import { uploadPercent } from '@/platform/openOnCloud/modelUpload'

/** What the Comfy Cloud menu's Run this workflow row shows and offers. */
export type CloudMenuState =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'canOpen' }
  | { kind: 'convert'; gaps: CloudWorkflowGaps }
  | { kind: 'upload'; models: CloudMissingModel[] }
  | { kind: 'uploading'; models: CloudMissingModel[]; percent: number }

/** Renders Comfy Cloud's answer as received; a running upload shows over it. */
export function cloudMenuState(
  check: CloudWorkflowCheckState,
  upload: ModelUploadState
): CloudMenuState {
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
    case 'signedOut':
      return { kind: verdict.kind }
    case 'missing':
      return verdict.gaps.nodePacks.length > 0
        ? { kind: 'convert', gaps: verdict.gaps }
        : { kind: 'upload', models: verdict.gaps.models }
  }
}
