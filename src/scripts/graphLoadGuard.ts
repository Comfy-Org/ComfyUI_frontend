let graphLoadHookDepth = 0
const graphLoadReentrancyError = new Error(
  'A graph-load lifecycle hook cannot start a nested graph load'
)

export function duringGraphLoadHook<T>(operation: () => T): T {
  graphLoadHookDepth++
  try {
    return operation()
  } finally {
    graphLoadHookDepth--
  }
}

export function rejectGraphLoadFromHook(): void {
  if (graphLoadHookDepth === 0) return
  throw graphLoadReentrancyError
}
