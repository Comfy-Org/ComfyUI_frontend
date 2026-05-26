import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'

let installed = false

export function installLiteGraphDeprecationBridge(): void {
  if (installed) return
  installed = true

  LiteGraph.onDeprecationWarning.push((message: string) => {
    useDeprecationWarningsStore().report({
      message,
      source: 'litegraph'
    })
  })
}
