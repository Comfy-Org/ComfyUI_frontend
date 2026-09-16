declare global {
  var __vitestMockStateResets: Set<() => void> | undefined
}

function registry(): Set<() => void> {
  return (globalThis.__vitestMockStateResets ??= new Set())
}

export function resetBeforeEachTest(reset: () => void): void {
  registry().add(reset)
}

export function runMockStateResets(): void {
  for (const reset of registry()) reset()
}
