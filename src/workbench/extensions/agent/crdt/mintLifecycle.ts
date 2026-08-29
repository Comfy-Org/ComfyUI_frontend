interface MintLifecycleListener {
  beforeLoad(): void
  afterConfigure(): void
}

const listeners = new Set<MintLifecycleListener>()

export function registerMintLifecycle(
  listener: MintLifecycleListener
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyMintBeforeLoad(): void {
  for (const listener of listeners) listener.beforeLoad()
}

export function notifyMintAfterConfigure(): void {
  for (const listener of listeners) listener.afterConfigure()
}
