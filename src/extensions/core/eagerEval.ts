// Extension that enables frontend-side eager evaluation for nodes
// that declare `eager_eval` in their definition.
//
// When a node's widget values change, the extension evaluates the JSONata
// expression and displays the result as a badge on the node.

import { watch } from 'vue'

import jsonata from 'jsonata'

import {
  buildEagerEvalContext,
  useNodeEagerEval
} from '@/composables/node/useNodeEagerEval'
import { useComputedWithWidgetWatch } from '@/composables/node/useWatchWidget'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import { LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useExtensionStore } from '@/stores/extensionStore'

function inputDisplayName(input: INodeInputSlot): string {
  return input.name.includes('.')
    ? input.name.slice(input.name.indexOf('.') + 1)
    : input.name
}

function formatNum(v: number): string {
  return Number.isInteger(v)
    ? String(v)
    : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

const extensionStore = useExtensionStore()

extensionStore.registerExtension({
  name: 'Comfy.EagerEval',
  nodeCreated(node: LGraphNode) {
    const eagerEval = useNodeEagerEval()
    if (!eagerEval.hasEagerEval(node)) return

    const colorPaletteStore = useColorPaletteStore()

    function updateInputValueLabels() {
      if (!node.inputs) return
      const ctx = buildEagerEvalContext(node) as Record<string, unknown>
      for (const input of node.inputs) {
        const displayName = inputDisplayName(input)
        if (input.link != null) {
          let val = ctx[input.name]
          // Fall back to cached backend context when eager eval
          // can't resolve values (e.g. inputs from non-primitive nodes)
          if (val === undefined && backendContext) {
            const baseName = inputDisplayName(input)
            val = backendContext[baseName] ?? backendContext[input.name]
          }
          input.label =
            typeof val === 'number'
              ? `${displayName}: ${formatNum(val)}`
              : displayName
        } else {
          input.label = inputDisplayName(input)
        }
      }
    }

    // Watch all widgets for changes to trigger re-evaluation
    const widgetNames = node.widgets?.map((w) => w.name) ?? []
    const computedWithWidgetWatch = useComputedWithWidgetWatch(node, {
      widgetNames,
      triggerCanvasRedraw: true
    })
    computedWithWidgetWatch(() => 0)

    // When async evaluation completes, redraw the canvas so the badge updates
    watch(eagerEval.evalRevision, () => {
      node.graph?.setDirtyCanvas(true, true)
    })

    // Watch connection changes for input-dependent re-evaluation
    node.onConnectionsChange = useChainCallback(
      node.onConnectionsChange,
      () => {
        backendContext = {}
        contextEvalCache = { expr: '', result: NaN }
        eagerEval.triggerEagerEval(node)
        node.graph?.setDirtyCanvas(true, true)
      }
    )

    const emptyBadge = new LGraphBadge({ text: '' })
    let lastLabel = ''
    let lastBadge = emptyBadge

    function makeBadge(label: string, isError = false): LGraphBadge {
      if (label === lastLabel) return lastBadge
      lastLabel = label
      lastBadge = new LGraphBadge({
        text: isError ? label : `= ${label}`,
        fgColor: isError
          ? '#ff6b6b'
          : (colorPaletteStore.completedActivePalette.colors.litegraph_base
              .BADGE_FG_COLOR ?? '#fff'),
        bgColor: isError ? '#4a1a1a' : '#1a4a2a'
      })
      return lastBadge
    }

    // Track backend execution result separately from eager eval.
    // backendBadge is shown when eager eval can't compute (e.g. inputs
    // come from non-primitive nodes like Get Image Size).
    let backendBadge: LGraphBadge = emptyBadge
    let backendExpr = ''
    // Cached backend context for re-evaluating changed expressions
    let backendContext: Record<string, unknown> = {}
    let contextEvalCache = { expr: '', result: NaN }
    let contextEvalInFlight = ''

    node.onExecuted = useChainCallback(
      node.onExecuted,
      (output: Record<string, unknown>) => {
        const exprWidget = node.widgets?.find((w) => w.name === 'expression')
        backendExpr = exprWidget ? String(exprWidget.value) : ''

        // Cache context for re-evaluation with changed expressions
        const ctxArr = output.context
        if (
          Array.isArray(ctxArr) &&
          ctxArr[0] &&
          typeof ctxArr[0] === 'object'
        ) {
          backendContext = ctxArr[0] as Record<string, unknown>
          contextEvalCache = { expr: '', result: NaN }
        }

        const resultArr = output.result
        if (Array.isArray(resultArr)) {
          const raw = resultArr[0]
          if (typeof raw === 'number' && node.outputs?.[0]) {
            node.outputs[0]._data = raw
            backendBadge = new LGraphBadge({
              text: `= ${formatNum(raw)}`,
              fgColor:
                colorPaletteStore.completedActivePalette.colors.litegraph_base
                  .BADGE_FG_COLOR ?? '#fff',
              bgColor: '#1a4a2a'
            })
            node.graph?.setDirtyCanvas(true, true)
          }
        }
      }
    )

    const badgeGetter: () => LGraphBadge = () => {
      updateInputValueLabels()
      const result = eagerEval.getNodeEagerResult(node)

      // Eager eval succeeded — use it directly
      if (result && result.value != null) {
        return makeBadge(eagerEval.formatEagerResult(result), !!result.error)
      }

      const exprWidget = node.widgets?.find((w) => w.name === 'expression')
      const currentExpr = exprWidget ? String(exprWidget.value) : ''

      // Backend result for the same expression
      if (backendBadge !== emptyBadge && currentExpr === backendExpr) {
        return backendBadge
      }

      // Re-evaluate with cached backend context when expression changed
      if (Object.keys(backendContext).length > 0 && currentExpr) {
        if (
          currentExpr === contextEvalCache.expr &&
          !Number.isNaN(contextEvalCache.result)
        ) {
          return makeBadge(formatNum(contextEvalCache.result))
        }
        if (currentExpr !== contextEvalInFlight) {
          contextEvalInFlight = currentExpr
          const capturedExpr = currentExpr
          try {
            Promise.resolve(jsonata(currentExpr).evaluate(backendContext))
              .then((val: unknown) => {
                if (typeof val === 'number') {
                  contextEvalCache = { expr: capturedExpr, result: val }
                  if (node.outputs?.[0]) node.outputs[0]._data = val
                  node.graph?.setDirtyCanvas(true, true)
                }
              })
              .catch(() => {
                contextEvalCache = { expr: capturedExpr, result: NaN }
              })
              .finally(() => {
                if (contextEvalInFlight === capturedExpr) {
                  contextEvalInFlight = ''
                }
              })
          } catch {
            contextEvalCache = { expr: currentExpr, result: NaN }
            contextEvalInFlight = ''
          }
        }
      }

      // Eager eval has an error and no backend/context fallback
      if (result?.error) {
        return makeBadge(result.error, true)
      }

      return emptyBadge
    }

    node.badges.push(badgeGetter)
  }
})
