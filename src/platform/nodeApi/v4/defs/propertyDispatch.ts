import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { PropertyChangeEvent } from '@/platform/nodeApi/v4/types'
import type { DispatchContext, MethodInstaller } from './dispatchContext'

type Settlement =
  | { readonly kind: 'kept' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'replaced'; readonly value: NodeProperty | undefined }

/** Delivers a property change, and settles it as the packs asked: kept, rejected or replaced. */
export function propertyInstallers({
  deliver,
  copyOfSaved
}: Pick<DispatchContext, 'deliver' | 'copyOfSaved'>): Record<
  string,
  MethodInstaller
> {
  return {
    onPropertyChanged(target, type) {
      const previous = target.onPropertyChanged
      target.onPropertyChanged = function (name, value, before) {
        const answer = previous?.call(this, name, value, before)
        if (answer === false) return false
        const outcome: { settlement: Settlement } = {
          settlement: { kind: 'kept' }
        }
        const event: PropertyChangeEvent = Object.freeze({
          name,
          value: copyOfSaved('onPropertyChanged', value),
          setValue(replacement: unknown) {
            const copy = copyOfSaved('setValue', replacement)
            if (
              !isSavedProperty(copy) ||
              (copy === undefined && replacement !== undefined)
            ) {
              throw invalidArgument(
                'setValue',
                'a value a workflow can save',
                replacement
              )
            }
            outcome.settlement = { kind: 'replaced', value: copy }
          },
          reject() {
            outcome.settlement = { kind: 'rejected' }
          }
        })
        deliver(type, 'onPropertyChanged', this, (callback, handle) =>
          callback(handle, event)
        )
        const { settlement } = outcome
        if (settlement.kind === 'rejected') return false
        if (settlement.kind === 'replaced') {
          this.properties[name] = settlement.value
        }
        return true
      }
    }
  }
}

function isSavedProperty(value: unknown): value is NodeProperty | undefined {
  return (
    typeof value !== 'function' &&
    typeof value !== 'symbol' &&
    typeof value !== 'bigint'
  )
}
