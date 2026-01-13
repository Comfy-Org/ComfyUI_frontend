interface ExtensionManagerWorkflow {
  workflow?: {
    activeWorkflow?: {
      filename?: string
      delete?: () => Promise<void>
    }
  }
}

interface AppWithExtensionManager {
  extensionManager: ExtensionManagerWorkflow
}

export function getActiveWorkflowFilename(app: unknown): string | undefined {
  const extMgr = (app as AppWithExtensionManager).extensionManager
  return extMgr.workflow?.activeWorkflow?.filename
}

export async function deleteActiveWorkflow(app: unknown): Promise<void> {
  const extMgr = (app as AppWithExtensionManager).extensionManager
  await extMgr.workflow?.activeWorkflow?.delete?.()
}
