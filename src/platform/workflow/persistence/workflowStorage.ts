const LOCAL_STORAGE_KEYS = [
  'workflow',
  'Comfy.PreviousWorkflow',
  'Comfy.OpenWorkflowsPaths',
  'Comfy.ActiveWorkflowIndex'
]

const SESSION_KEY_PREFIXES = [
  'workflow:',
  'Comfy.PreviousWorkflow',
  'Comfy.OpenWorkflowsPaths',
  'Comfy.ActiveWorkflowIndex'
]

const shouldClearSessionKey = (key: string): boolean =>
  SESSION_KEY_PREFIXES.some((prefix) =>
    prefix.endsWith(':')
      ? key.startsWith(prefix)
      : key === prefix || key.startsWith(`${prefix}:`)
  )

/**
 * Removes any workflow state persisted in storage so that the next login
 * starts with a clean slate.
 */
export const clearWorkflowPersistenceStorage = () => {
  LOCAL_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })

  // Iterate backwards because removing items mutates sessionStorage.length.
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i)
    if (!key) continue
    if (shouldClearSessionKey(key)) {
      sessionStorage.removeItem(key)
    }
  }
}
