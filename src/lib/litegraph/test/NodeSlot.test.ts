import { describe, expect, it } from 'vitest'

import { INodeInputSlot, INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import {
  inputAsSerialisable,
  outputAsSerialisable
} from '@/lib/litegraph/src/node/slotUtils'

describe('NodeSlot', () => {
  describe('inputAsSerialisable', () => {
    it('removes _data from serialized slot', () => {
      // @ts-expect-error Missing boundingRect property for test
      const slot: INodeOutputSlot = {
        _data: 'test data',
        name: 'test-id',
        type: 'STRING',
        links: []
      }
      // @ts-expect-error Argument type mismatch for test
      const serialized = outputAsSerialisable(slot)
      expect(serialized).not.toHaveProperty('_data')
    })

    it('removes pos from widget input slots', () => {
      const widgetInputSlot: INodeInputSlot = {
        name: 'test-id',
        pos: [10, 20],
        type: 'STRING',
        link: null,
        widget: {
          name: 'test-widget',
          // @ts-expect-error TODO: Fix after merge - type property not in IWidgetLocator
          type: 'combo',
          value: 'test-value-1',
          options: {
            values: ['test-value-1', 'test-value-2']
          }
        }
      }

      const serialized = inputAsSerialisable(widgetInputSlot)
      expect(serialized).not.toHaveProperty('pos')
    })

    it('preserves pos for non-widget input slots', () => {
      // @ts-expect-error TODO: Fix after merge - missing boundingRect property for test
      const normalSlot: INodeInputSlot = {
        name: 'test-id',
        type: 'STRING',
        pos: [10, 20],
        link: null
      }
      const serialized = inputAsSerialisable(normalSlot)
      expect(serialized).toHaveProperty('pos')
    })

    it('preserves only widget name during serialization', () => {
      const widgetInputSlot: INodeInputSlot = {
        name: 'test-id',
        type: 'STRING',
        link: null,
        widget: {
          name: 'test-widget',
          // @ts-expect-error TODO: Fix after merge - type property not in IWidgetLocator
          type: 'combo',
          value: 'test-value-1',
          options: {
            values: ['test-value-1', 'test-value-2']
          }
        }
      }

      const serialized = inputAsSerialisable(widgetInputSlot)
      expect(serialized.widget).toEqual({ name: 'test-widget' })
      expect(serialized.widget).not.toHaveProperty('type')
      expect(serialized.widget).not.toHaveProperty('value')
      expect(serialized.widget).not.toHaveProperty('options')
    })
  })
})
