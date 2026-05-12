/**
 * Shared v1 app shim — replaces inline `createV1App` blocks in
 * `*.migration.test.ts` files.
 *
 * Mirrors the surface a v1 extension reaches for via
 * `app.registerExtension({ nodeCreated })` plus a `simulateNodeCreated`
 * driver so migration tests can replay the same node sequence through
 * v1 and v2 runtimes.
 */

interface V1NodeLike {
  id: number
  type: string
}

interface V1Extension {
  name: string
  nodeCreated?: (node: V1NodeLike) => void
}

interface V1App {
  registerExtension: (ext: V1Extension) => void
  simulateNodeCreated: (node: V1NodeLike) => void
  readonly totalCreated: number
}

export function createV1App(): V1App {
  const extensions: V1Extension[] = []
  const callLog: V1NodeLike[] = []

  return {
    registerExtension(ext) {
      extensions.push(ext)
    },
    simulateNodeCreated(node) {
      callLog.push(node)
      for (const ext of extensions) ext.nodeCreated?.(node)
    },
    get totalCreated() {
      return callLog.length
    }
  }
}
