import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { widgetEntityId } from './entityIds'
import {
  ensureWidgetState,
  getWidgetState,
  readWidgetValue,
  writeWidgetValue
} from './widgetValueIO'

describe('widgetValueIO', () => {
  const graphA = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  const graphB = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890'

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('ensureWidgetState', () => {
    it('registers a new state when none exists', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      const state = ensureWidgetState(id, {
        type: 'number',
        value: 11,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      })
      expect(state.value).toBe(11)
      expect(state.nodeId).toBe('1')
      expect(state.name).toBe('seed')
    })

    it('is idempotent — returns the same state on repeated calls', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      const init = {
        type: 'number',
        value: 11,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      }
      const first = ensureWidgetState(id, init)
      const second = ensureWidgetState(id, init)
      expect(second).toBe(first)
    })

    it('does not overwrite an existing state with init values', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      const first = ensureWidgetState(id, {
        type: 'number',
        value: 11,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      })
      first.value = 99
      const second = ensureWidgetState(id, {
        type: 'number',
        value: 11,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      })
      expect(second.value).toBe(99)
    })
  })

  describe('readWidgetValue / writeWidgetValue', () => {
    it('round-trips a value through the entity-id surface', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      ensureWidgetState(id, {
        type: 'number',
        value: 11,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      })
      expect(readWidgetValue(id)).toBe(11)

      expect(writeWidgetValue(id, 22)).toBe(true)
      expect(readWidgetValue(id)).toBe(22)
    })

    it('returns false when writing to an unregistered id', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      expect(writeWidgetValue(id, 22)).toBe(false)
    })

    it('returns undefined when reading an unregistered id', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      expect(readWidgetValue(id)).toBeUndefined()
      expect(getWidgetState(id)).toBeUndefined()
    })
  })

  describe('isolation', () => {
    it('keeps independent values across distinct entity ids', () => {
      const id1 = widgetEntityId(graphA, 1, 'seed')
      const id2 = widgetEntityId(graphA, 2, 'seed')
      const init = {
        type: 'number',
        value: 0,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      }
      ensureWidgetState(id1, init)
      ensureWidgetState(id2, init)

      writeWidgetValue(id1, 11)
      writeWidgetValue(id2, 22)

      expect(readWidgetValue(id1)).toBe(11)
      expect(readWidgetValue(id2)).toBe(22)
    })

    it('isolates values across graph ids', () => {
      const idA = widgetEntityId(graphA, 1, 'seed')
      const idB = widgetEntityId(graphB, 1, 'seed')
      const init = {
        type: 'number',
        value: 0,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      }
      ensureWidgetState(idA, init)
      ensureWidgetState(idB, init)

      writeWidgetValue(idA, 11)
      writeWidgetValue(idB, 22)

      expect(readWidgetValue(idA)).toBe(11)
      expect(readWidgetValue(idB)).toBe(22)
    })

    it('matches the legacy triple-keyed API for the same widget', () => {
      const id = widgetEntityId(graphA, 1, 'seed')
      const init = {
        type: 'number',
        value: 11,
        options: {},
        label: undefined,
        serialize: true,
        disabled: false
      }
      ensureWidgetState(id, init)

      const viaLegacy = useWidgetValueStore().getWidget(graphA, '1', 'seed')
      expect(viaLegacy).toBe(getWidgetState(id))
    })
  })
})
