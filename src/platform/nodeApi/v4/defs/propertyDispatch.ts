import type { NodeProperty } from '@comfyorg/graph-model/nodeProperty'

import { once } from 'es-toolkit'

import {
  callOutOfTurn,
  invalidArgument
} from '@/platform/nodeApi/shared/invalidArgument'
import { savableValue } from '@/platform/nodeApi/shared/savableValue'
import { PACK_PROPERTIES } from '@/platform/nodeApi/v4/packs'
import type { PropertyChangeEvent } from '@/platform/nodeApi/v4/types'
import type { DispatchContext, MethodInstaller } from './dispatchContext'

type Settlement =
  | { readonly kind: 'kept' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'replaced'; readonly value: NodeProperty }

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
        const outcome: { settlement: Settlement; open: boolean } = {
          settlement: { kind: 'kept' },
          open: true
        }
        const settle = (member: string, settlement: Settlement) => {
          if (!outcome.open) {
            throw callOutOfTurn(
              member,
              'while the hook that received the event runs'
            )
          }
          outcome.settlement = settlement
        }
        const copy = once(() => copyOfSaved('onPropertyChanged', value))
        const event = once((): PropertyChangeEvent =>
          Object.freeze({
            name,
            get value() {
              return copy()
            },
            setValue(replacement: unknown) {
              if (PACK_PROPERTIES.has(name)) {
                throw invalidArgument(
                  'setValue',
                  'a property other than cnr_id, aux_id and ver',
                  name
                )
              }
              settle('setValue', {
                kind: 'replaced',
                value: storableProperty(replacement)
              })
            },
            reject() {
              settle('reject', { kind: 'rejected' })
            }
          })
        )
        deliver(type, 'onPropertyChanged', this, (callback, handle) =>
          callback(handle, event())
        )
        outcome.open = false
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

function storableProperty(replacement: unknown): NodeProperty {
  return savableValue('setValue', replacement)
}
