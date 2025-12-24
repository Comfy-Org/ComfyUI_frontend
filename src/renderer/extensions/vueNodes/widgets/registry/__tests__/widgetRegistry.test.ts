import type { Component } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import {
  clearExtensionWidgets,
  getComponent,
  isEssential,
  registerVueWidgets,
  shouldExpand,
  shouldRenderAsVue
} from '../widgetRegistry'


// Mock Vue components for testing (using object literals to avoid Vue linter)
const MockComponent = { name: 'MockComponent' } as Component
const MockComponent2 = { name: 'MockComponent2' } as Component

describe('widgetRegistry', () => {
  afterEach(() => {
    clearExtensionWidgets()
  })

  describe('registerVueWidgets', () => {
    it('should register a custom widget', () => {
      registerVueWidgets({
        myCustomWidget: {
          component: MockComponent
        }
      })

      const result = getComponent('myCustomWidget', 'test')
      expect(result).toBe(MockComponent)
    })

    it('should register multiple widgets at once', () => {
      registerVueWidgets({
        widget1: { component: MockComponent },
        widget2: { component: MockComponent2 }
      })

      expect(getComponent('widget1', 'test')).toBe(MockComponent)
      expect(getComponent('widget2', 'test')).toBe(MockComponent2)
    })

    it('should register aliases for a widget', () => {
      registerVueWidgets({
        myWidget: {
          component: MockComponent,
          aliases: ['MY_WIDGET', 'MYWIDGET']
        }
      })

      expect(getComponent('myWidget', 'test')).toBe(MockComponent)
      expect(getComponent('MY_WIDGET', 'test')).toBe(MockComponent)
      expect(getComponent('MYWIDGET', 'test')).toBe(MockComponent)
    })
  })

  describe('getComponent', () => {
    it('should return null for unknown widget type', () => {
      const result = getComponent('unknownType', 'test')
      expect(result).toBeNull()
    })

    it('should return core widget component for known type', () => {
      const result = getComponent('int', 'test')
      expect(result).not.toBeNull()
    })

    it('should return core widget component for alias', () => {
      const result = getComponent('INT', 'test')
      expect(result).not.toBeNull()
    })

    it('extension widgets should take precedence over core widgets', () => {
      registerVueWidgets({
        int: { component: MockComponent }
      })

      const result = getComponent('int', 'test')
      expect(result).toBe(MockComponent)
    })

    it('extension aliases should take precedence over core aliases', () => {
      registerVueWidgets({
        customInt: {
          component: MockComponent,
          aliases: ['INT']
        }
      })

      const result = getComponent('INT', 'test')
      expect(result).toBe(MockComponent)
    })

    it('should use displayHint to find extension widget', () => {
      registerVueWidgets({
        star_rating: { component: MockComponent }
      })

      // Even though type is 'int', the displayHint 'star_rating' should match
      const result = getComponent('int', 'rating', 'star_rating')
      expect(result).toBe(MockComponent)
    })

    it('displayHint alias should work', () => {
      registerVueWidgets({
        star_rating: {
          component: MockComponent,
          aliases: ['STAR_RATING']
        }
      })

      const result = getComponent('int', 'rating', 'STAR_RATING')
      expect(result).toBe(MockComponent)
    })

    it('should fall back to type when displayHint has no match', () => {
      const result = getComponent('int', 'test', 'unknown_display')
      // Should return core int widget, not null
      expect(result).not.toBeNull()
    })
  })

  describe('clearExtensionWidgets', () => {
    it('should clear all registered extension widgets', () => {
      registerVueWidgets({
        myWidget: { component: MockComponent }
      })

      expect(getComponent('myWidget', 'test')).toBe(MockComponent)

      clearExtensionWidgets()

      expect(getComponent('myWidget', 'test')).toBeNull()
    })

    it('should not affect core widgets', () => {
      registerVueWidgets({
        myWidget: { component: MockComponent }
      })

      clearExtensionWidgets()

      expect(getComponent('int', 'test')).not.toBeNull()
    })
  })

  describe('isEssential', () => {
    it('should return true for essential core widgets', () => {
      expect(isEssential('int')).toBe(true)
      expect(isEssential('float')).toBe(true)
      expect(isEssential('combo')).toBe(true)
      expect(isEssential('boolean')).toBe(true)
    })

    it('should return false for non-essential core widgets', () => {
      expect(isEssential('button')).toBe(false)
      expect(isEssential('color')).toBe(false)
    })

    it('should return false for unknown widget types', () => {
      expect(isEssential('unknownType')).toBe(false)
    })

    it('should return false for extension widgets (not marked as essential)', () => {
      registerVueWidgets({
        myWidget: { component: MockComponent }
      })

      expect(isEssential('myWidget')).toBe(false)
    })
  })

  describe('shouldRenderAsVue', () => {
    it('should return true for widgets with a type', () => {
      expect(shouldRenderAsVue({ type: 'int' })).toBe(true)
    })

    it('should return false for widgets without a type', () => {
      expect(shouldRenderAsVue({})).toBe(false)
    })

    it('should return false for canvasOnly widgets', () => {
      expect(
        shouldRenderAsVue({ type: 'int', options: { canvasOnly: true } })
      ).toBe(false)
    })

    it('should return true for widgets with canvasOnly false', () => {
      expect(
        shouldRenderAsVue({ type: 'int', options: { canvasOnly: false } })
      ).toBe(true)
    })
  })

  describe('shouldExpand', () => {
    it('should return true for textarea', () => {
      expect(shouldExpand('textarea')).toBe(true)
      expect(shouldExpand('TEXTAREA')).toBe(true)
    })

    it('should return true for markdown', () => {
      expect(shouldExpand('markdown')).toBe(true)
      expect(shouldExpand('MARKDOWN')).toBe(true)
    })

    it('should return true for load3D', () => {
      expect(shouldExpand('load3D')).toBe(true)
      expect(shouldExpand('LOAD_3D')).toBe(true)
    })

    it('should return false for non-expanding types', () => {
      expect(shouldExpand('int')).toBe(false)
      expect(shouldExpand('string')).toBe(false)
      expect(shouldExpand('combo')).toBe(false)
    })
  })
})
