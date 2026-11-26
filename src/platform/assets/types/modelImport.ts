export interface UploadModelSuccess {
  filename: string
  modelType?: string
  taskId?: string
  status: 'processing' | 'success'
}

export interface UploadModelTypeMismatch {
  importedModelType?: string
  importedModelTypeLabel?: string
  requiredModelType: string
  requiredModelTypeLabel: string
}

interface MissingModelUploadContext {
  kind: 'missing-model-resolution'
  missingModelName: string
  requiredModelType: string
  replacementTargets: Array<{
    nodeId: string
    nodeLabel: string
    widgetName: string
  }>
}

export type UploadModelDialogContext = MissingModelUploadContext
