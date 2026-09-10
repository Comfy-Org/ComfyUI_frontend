import type { IdentityPort, IdentitySnapshot } from '../index.js'

export function createFakeIdentity(
  initial: IdentitySnapshot | null = null
): IdentityPort & { set(identity: IdentitySnapshot | null): void } {
  let current = initial
  const listeners = new Set<(identity: IdentitySnapshot | null) => void>()
  return {
    acquire: async () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(identity) {
      current = identity
      listeners.forEach((listener) => listener(identity))
    }
  }
}
