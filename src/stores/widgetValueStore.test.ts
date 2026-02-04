import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWidgetValueStore } from './widgetValueStore'

describe('useWidgetValueStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('value management (legacy API)', () => {
    it('stores and retrieves values', () => {
      const store = useWidgetValueStore()
      store.set('node-1', 'seed', 12345)
      expect(store.get('node-1', 'seed')).toBe(12345)
    })

    it('returns undefined for missing values', () => {
      const store = useWidgetValueStore()
      expect(store.get('missing', 'widget')).toBeUndefined()
    })

    it('removes single widget value', () => {
      const store = useWidgetValueStore()
      store.set('node-1', 'seed', 100)
      store.remove('node-1', 'seed')
      expect(store.get('node-1', 'seed')).toBeUndefined()
    })

    it('removes all widgets for a node', () => {
      const store = useWidgetValueStore()
      store.set('node-1', 'seed', 1)
      store.set('node-1', 'steps', 20)
      store.set('node-2', 'seed', 2)

      store.removeNode('node-1')

      expect(store.get('node-1', 'seed')).toBeUndefined()
      expect(store.get('node-1', 'steps')).toBeUndefined()
      expect(store.get('node-2', 'seed')).toBe(2)
    })

    it('overwrites existing values', () => {
      const store = useWidgetValueStore()
      store.set('node-1', 'seed', 100)
      store.set('node-1', 'seed', 200)
      expect(store.get('node-1', 'seed')).toBe(200)
    })

    it('stores different value types', () => {
      const store = useWidgetValueStore()
      store.set('node-1', 'text', 'hello')
      store.set('node-1', 'number', 42)
      store.set('node-1', 'boolean', true)
      store.set('node-1', 'array', [1, 2, 3])

      expect(store.get('node-1', 'text')).toBe('hello')
      expect(store.get('node-1', 'number')).toBe(42)
      expect(store.get('node-1', 'boolean')).toBe(true)
      expect(store.get('node-1', 'array')).toEqual([1, 2, 3])
    })
  })

  describe('widget registration', () => {
    it('registers a widget with default options', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget('node-1', 'seed', 'number', 12345)

      expect(state.nodeId).toBe('node-1')
      expect(state.name).toBe('seed')
      expect(state.type).toBe('number')
      expect(state.value).toBe(12345)
      expect(state.hidden).toBe(false)
      expect(state.disabled).toBe(false)
      expect(state.advanced).toBe(false)
      expect(state.promoted).toBe(false)
      expect(state.serialize).toBe(true)
      expect(state.options).toEqual({})
    })

    it('registers a widget with custom options', () => {
      const store = useWidgetValueStore()
      const state = store.registerWidget('node-1', 'prompt', 'string', 'test', {
        label: 'Prompt Text',
        hidden: true,
        disabled: true,
        advanced: true,
        promoted: true,
        serialize: false,
        widgetOptions: { multiline: true }
      })

      expect(state.label).toBe('Prompt Text')
      expect(state.hidden).toBe(true)
      expect(state.disabled).toBe(true)
      expect(state.advanced).toBe(true)
      expect(state.promoted).toBe(true)
      expect(state.serialize).toBe(false)
      expect(state.options).toEqual({ multiline: true })
    })

    it('also sets the value in the values map', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 42)
      expect(store.get('node-1', 'seed')).toBe(42)
    })

    it('unregisters a widget', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.unregisterWidget('node-1', 'seed')

      expect(store.getWidget('node-1', 'seed')).toBeUndefined()
      expect(store.get('node-1', 'seed')).toBeUndefined()
    })

    it('unregisters all widgets for a node', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 1)
      store.registerWidget('node-1', 'steps', 'number', 20)
      store.registerWidget('node-2', 'seed', 'number', 2)

      store.unregisterNode('node-1')

      expect(store.getWidget('node-1', 'seed')).toBeUndefined()
      expect(store.getWidget('node-1', 'steps')).toBeUndefined()
      expect(store.getWidget('node-2', 'seed')).toBeDefined()
      expect(store.get('node-1', 'seed')).toBeUndefined()
      expect(store.get('node-2', 'seed')).toBe(2)
    })
  })

  describe('widget getters', () => {
    it('getWidget returns widget state', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      const widget = store.getWidget('node-1', 'seed')
      expect(widget).toBeDefined()
      expect(widget?.name).toBe('seed')
      expect(widget?.value).toBe(100)
    })

    it('getWidget returns undefined for missing widget', () => {
      const store = useWidgetValueStore()
      expect(store.getWidget('missing', 'widget')).toBeUndefined()
    })

    it('getNodeWidgets returns all widgets for a node', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 1)
      store.registerWidget('node-1', 'steps', 'number', 20)
      store.registerWidget('node-2', 'cfg', 'number', 7)

      const widgets = store.getNodeWidgets('node-1')
      expect(widgets).toHaveLength(2)
      expect(widgets.map((w) => w.name).sort()).toEqual(['seed', 'steps'])
    })

    it('getVisibleWidgets filters out hidden widgets', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'visible', 'number', 1)
      store.registerWidget('node-1', 'hidden', 'number', 2, { hidden: true })

      const visible = store.getVisibleWidgets('node-1')
      expect(visible).toHaveLength(1)
      expect(visible[0].name).toBe('visible')
    })

    it('getAdvancedWidgets returns only advanced widgets', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'basic', 'number', 1)
      store.registerWidget('node-1', 'adv1', 'number', 2, { advanced: true })
      store.registerWidget('node-1', 'adv2', 'string', 'x', { advanced: true })

      const advanced = store.getAdvancedWidgets('node-1')
      expect(advanced).toHaveLength(2)
      expect(advanced.map((w) => w.name).sort()).toEqual(['adv1', 'adv2'])
    })

    it('getPromotedWidgets returns only promoted widgets', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'normal', 'number', 1)
      store.registerWidget('node-1', 'promo', 'string', 'x', { promoted: true })

      const promoted = store.getPromotedWidgets('node-1')
      expect(promoted).toHaveLength(1)
      expect(promoted[0].name).toBe('promo')
    })
  })

  describe('metadata setters', () => {
    it('setHidden updates widget hidden state', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.setHidden('node-1', 'seed', true)
      expect(store.getWidget('node-1', 'seed')?.hidden).toBe(true)

      store.setHidden('node-1', 'seed', false)
      expect(store.getWidget('node-1', 'seed')?.hidden).toBe(false)
    })

    it('setDisabled updates widget disabled state', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.setDisabled('node-1', 'seed', true)
      expect(store.getWidget('node-1', 'seed')?.disabled).toBe(true)
    })

    it('setAdvanced updates widget advanced state', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.setAdvanced('node-1', 'seed', true)
      expect(store.getWidget('node-1', 'seed')?.advanced).toBe(true)
    })

    it('setPromoted updates widget promoted state', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.setPromoted('node-1', 'seed', true)
      expect(store.getWidget('node-1', 'seed')?.promoted).toBe(true)
    })

    it('setLabel updates widget label', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.setLabel('node-1', 'seed', 'Random Seed')
      expect(store.getWidget('node-1', 'seed')?.label).toBe('Random Seed')

      store.setLabel('node-1', 'seed', undefined)
      expect(store.getWidget('node-1', 'seed')?.label).toBeUndefined()
    })

    it('setters silently do nothing for missing widgets', () => {
      const store = useWidgetValueStore()
      expect(() => store.setHidden('missing', 'widget', true)).not.toThrow()
      expect(() => store.setDisabled('missing', 'widget', true)).not.toThrow()
      expect(() => store.setAdvanced('missing', 'widget', true)).not.toThrow()
      expect(() => store.setPromoted('missing', 'widget', true)).not.toThrow()
      expect(() => store.setLabel('missing', 'widget', 'test')).not.toThrow()
    })
  })

  describe('value sync between APIs', () => {
    it('set() updates registered widget state value', () => {
      const store = useWidgetValueStore()
      store.registerWidget('node-1', 'seed', 'number', 100)

      store.set('node-1', 'seed', 200)

      expect(store.get('node-1', 'seed')).toBe(200)
      expect(store.getWidget('node-1', 'seed')?.value).toBe(200)
    })

    it('set() works for unregistered widgets', () => {
      const store = useWidgetValueStore()
      store.set('node-1', 'seed', 100)
      expect(store.get('node-1', 'seed')).toBe(100)
    })
  })
})
