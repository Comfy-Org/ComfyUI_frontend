import { type ComputedRef, computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import { addToComboValues } from '@/utils/litegraphUtil'

interface Params {
  nodeRef: ComputedRef<LGraphNode | undefined>
  widgetName: string
}

/**
 * Utilities for working with a COMBO widget that lives on the LiteGraph node.
 * - Resolves select options from the real widget (array | record | function)
 * - Provides a safe helper to add options to the real widget
 */
export function useComboBackedOptions({ nodeRef, widgetName }: Params) {
  const getRealWidget = () => {
    const node = nodeRef.value
    return node?.widgets?.find((w) => w.name === widgetName) as
      | IComboWidget
      | undefined
  }

  const selectOptions = computed<string[]>(() => {
    const real = getRealWidget()

    const raw = real?.options?.values
    if (Array.isArray(raw)) return raw as string[]
    if (typeof raw === 'function') {
      try {
        const out = raw(real, nodeRef.value)
        if (Array.isArray(out)) return out
      } catch {
        // Ignore function call errors and fall through to default
      }
    }
    if (raw && typeof raw === 'object')
      return Object.values(raw as Record<string, string>)
    return []
  })

  const addOptions = (values: string[]) => {
    const real = getRealWidget()
    if (!real) return
    for (const v of values) addToComboValues(real, v)
  }

  return { selectOptions, addOptions }
}
