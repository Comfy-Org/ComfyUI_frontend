import { currentDocumentId } from '@/platform/nodeApi/appReady'
import { reportError } from '@/platform/telemetry/reportError'

const warningsReady = new Set<() => void>()
let completedDocument: string | undefined

/** A configured graph becomes usable only after its active workflow and warnings agree. */
export function currentCompletedWorkflowDocumentId(): string | undefined {
  return completedDocument === currentDocumentId()
    ? completedDocument
    : undefined
}

export function onWorkflowWarningsReady(listener: () => void): () => void {
  warningsReady.add(listener)
  return () => {
    warningsReady.delete(listener)
  }
}

export function notifyWorkflowWarningsReady(): void {
  completedDocument = currentDocumentId()
  for (const listener of [...warningsReady]) {
    try {
      listener()
    } catch (cause) {
      reportError(cause, {
        errorType: 'workflow_warnings_ready_listener_failed'
      })
    }
  }
}
