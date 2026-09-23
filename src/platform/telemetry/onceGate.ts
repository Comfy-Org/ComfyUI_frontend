/** Admits each key once, so a re-running watcher reports a condition one time. */
export function createOnceGate() {
  const admitted = new Set<string>()
  return {
    first(key: string): boolean {
      if (admitted.has(key)) return false
      admitted.add(key)
      return true
    },
    reset(): void {
      admitted.clear()
    }
  }
}
