import { describe, expect, it } from 'vitest'

import type { KeyCombo, Keybinding } from '@/schemas/keyBindingSchema'
import {
  migrateKeyCombo,
  migrateKeybinding,
  migrateKeybindings,
  needsKeyMigration,
  normalizeKey
} from '@/utils/keybindingMigration'

describe('keybindingMigration', () => {
  describe('needsKeyMigration', () => {
    it('should return false for keys already in event.code format', () => {
      expect(needsKeyMigration({ key: 'KeyA' })).toBe(false)
      expect(needsKeyMigration({ key: 'KeyZ' })).toBe(false)
      expect(needsKeyMigration({ key: 'Digit0' })).toBe(false)
      expect(needsKeyMigration({ key: 'Digit9' })).toBe(false)
      expect(needsKeyMigration({ key: 'F1' })).toBe(false)
      expect(needsKeyMigration({ key: 'F12' })).toBe(false)
      expect(needsKeyMigration({ key: 'Enter' })).toBe(false)
      expect(needsKeyMigration({ key: 'Escape' })).toBe(false)
      expect(needsKeyMigration({ key: 'ArrowUp' })).toBe(false)
      expect(needsKeyMigration({ key: 'Minus' })).toBe(false)
    })

    it('should return true for keys in old event.key format', () => {
      expect(needsKeyMigration({ key: 'a' })).toBe(true)
      expect(needsKeyMigration({ key: 'z' })).toBe(true)
      expect(needsKeyMigration({ key: 'A' })).toBe(true)
      expect(needsKeyMigration({ key: 'Z' })).toBe(true)
      expect(needsKeyMigration({ key: '0' })).toBe(true)
      expect(needsKeyMigration({ key: '9' })).toBe(true)
      expect(needsKeyMigration({ key: '-' })).toBe(true)
      expect(needsKeyMigration({ key: '=' })).toBe(true)
    })

    it('should handle lowercase special keys', () => {
      expect(needsKeyMigration({ key: 'escape' })).toBe(true)
      expect(needsKeyMigration({ key: 'enter' })).toBe(true)
      expect(needsKeyMigration({ key: 'space' })).toBe(true)
    })

    it('should return false for empty key', () => {
      expect(needsKeyMigration({ key: '' })).toBe(false)
    })
  })

  describe('migrateKeyCombo', () => {
    it('should migrate lowercase letters to KeyX format', () => {
      expect(migrateKeyCombo({ key: 'a' }).key).toBe('KeyA')
      expect(migrateKeyCombo({ key: 'r' }).key).toBe('KeyR')
      expect(migrateKeyCombo({ key: 'z' }).key).toBe('KeyZ')
    })

    it('should migrate uppercase letters to KeyX format', () => {
      expect(migrateKeyCombo({ key: 'A' }).key).toBe('KeyA')
      expect(migrateKeyCombo({ key: 'R' }).key).toBe('KeyR')
      expect(migrateKeyCombo({ key: 'Z' }).key).toBe('KeyZ')
    })

    it('should migrate digit characters to DigitX format', () => {
      expect(migrateKeyCombo({ key: '0' }).key).toBe('Digit0')
      expect(migrateKeyCombo({ key: '5' }).key).toBe('Digit5')
      expect(migrateKeyCombo({ key: '9' }).key).toBe('Digit9')
    })

    it('should migrate special keys to proper case', () => {
      expect(migrateKeyCombo({ key: 'escape' }).key).toBe('Escape')
      expect(migrateKeyCombo({ key: 'enter' }).key).toBe('Enter')
      expect(migrateKeyCombo({ key: 'space' }).key).toBe('Space')
      expect(migrateKeyCombo({ key: 'tab' }).key).toBe('Tab')
    })

    it('should migrate punctuation to event.code names', () => {
      expect(migrateKeyCombo({ key: '-' }).key).toBe('Minus')
      expect(migrateKeyCombo({ key: '=' }).key).toBe('Equal')
      expect(migrateKeyCombo({ key: '[' }).key).toBe('BracketLeft')
      expect(migrateKeyCombo({ key: ']' }).key).toBe('BracketRight')
      expect(migrateKeyCombo({ key: ';' }).key).toBe('Semicolon')
      expect(migrateKeyCombo({ key: '/' }).key).toBe('Slash')
    })

    it('should migrate shifted punctuation correctly', () => {
      expect(migrateKeyCombo({ key: '_' }).key).toBe('Minus')
      expect(migrateKeyCombo({ key: '+' }).key).toBe('Equal')
      expect(migrateKeyCombo({ key: '{' }).key).toBe('BracketLeft')
      expect(migrateKeyCombo({ key: '}' }).key).toBe('BracketRight')
      expect(migrateKeyCombo({ key: ':' }).key).toBe('Semicolon')
      expect(migrateKeyCombo({ key: '?' }).key).toBe('Slash')
    })

    it('should migrate shifted digits correctly', () => {
      expect(migrateKeyCombo({ key: '!' }).key).toBe('Digit1')
      expect(migrateKeyCombo({ key: '@' }).key).toBe('Digit2')
      expect(migrateKeyCombo({ key: '#' }).key).toBe('Digit3')
      expect(migrateKeyCombo({ key: '$' }).key).toBe('Digit4')
      expect(migrateKeyCombo({ key: '%' }).key).toBe('Digit5')
      expect(migrateKeyCombo({ key: '^' }).key).toBe('Digit6')
      expect(migrateKeyCombo({ key: '&' }).key).toBe('Digit7')
      expect(migrateKeyCombo({ key: '*' }).key).toBe('Digit8')
      expect(migrateKeyCombo({ key: '(' }).key).toBe('Digit9')
      expect(migrateKeyCombo({ key: ')' }).key).toBe('Digit0')
    })

    it('should preserve modifier flags', () => {
      const combo: KeyCombo = {
        key: 's',
        ctrl: true,
        alt: true,
        shift: true
      }
      const migrated = migrateKeyCombo(combo)

      expect(migrated.key).toBe('KeyS')
      expect(migrated.ctrl).toBe(true)
      expect(migrated.alt).toBe(true)
      expect(migrated.shift).toBe(true)
    })

    it('should not modify keys already in event.code format', () => {
      expect(migrateKeyCombo({ key: 'KeyR' }).key).toBe('KeyR')
      expect(migrateKeyCombo({ key: 'Digit5' }).key).toBe('Digit5')
      expect(migrateKeyCombo({ key: 'F1' }).key).toBe('F1')
      expect(migrateKeyCombo({ key: 'Enter' }).key).toBe('Enter')
      expect(migrateKeyCombo({ key: 'ArrowUp' }).key).toBe('ArrowUp')
    })

    it('should handle space character', () => {
      expect(migrateKeyCombo({ key: ' ' }).key).toBe('Space')
    })

    it('should handle arrow key variations', () => {
      expect(migrateKeyCombo({ key: 'arrowup' }).key).toBe('ArrowUp')
      expect(migrateKeyCombo({ key: 'arrowdown' }).key).toBe('ArrowDown')
      expect(migrateKeyCombo({ key: 'arrowleft' }).key).toBe('ArrowLeft')
      expect(migrateKeyCombo({ key: 'arrowright' }).key).toBe('ArrowRight')
    })

    it('should handle function key variations', () => {
      expect(migrateKeyCombo({ key: 'f1' }).key).toBe('F1')
      expect(migrateKeyCombo({ key: 'f12' }).key).toBe('F12')
    })
  })

  describe('migrateKeybinding', () => {
    it('should migrate a keybinding object', () => {
      const keybinding: Keybinding = {
        commandId: 'Test.Command',
        combo: { key: 'r' }
      }

      const migrated = migrateKeybinding(keybinding)

      expect(migrated.commandId).toBe('Test.Command')
      expect(migrated.combo.key).toBe('KeyR')
    })

    it('should preserve targetElementId', () => {
      const keybinding: Keybinding = {
        commandId: 'Test.Command',
        combo: { key: 's', ctrl: true },
        targetElementId: 'graph-canvas'
      }

      const migrated = migrateKeybinding(keybinding)

      expect(migrated.targetElementId).toBe('graph-canvas')
      expect(migrated.combo.key).toBe('KeyS')
      expect(migrated.combo.ctrl).toBe(true)
    })
  })

  describe('migrateKeybindings', () => {
    it('should migrate an array of keybindings', () => {
      const keybindings: Keybinding[] = [
        { commandId: 'Test1', combo: { key: 'r' } },
        { commandId: 'Test2', combo: { key: 's', ctrl: true } },
        { commandId: 'Test3', combo: { key: 'q' } }
      ]

      const result = migrateKeybindings(keybindings)

      expect(result.migrated).toBe(true)
      expect(result.keybindings).toHaveLength(3)
      expect(result.keybindings[0].combo.key).toBe('KeyR')
      expect(result.keybindings[1].combo.key).toBe('KeyS')
      expect(result.keybindings[2].combo.key).toBe('KeyQ')
    })

    it('should detect when no migration is needed', () => {
      const keybindings: Keybinding[] = [
        { commandId: 'Test1', combo: { key: 'KeyR' } },
        { commandId: 'Test2', combo: { key: 'KeyS', ctrl: true } }
      ]

      const result = migrateKeybindings(keybindings)

      expect(result.migrated).toBe(false)
      expect(result.keybindings).toHaveLength(2)
    })

    it('should handle mixed old and new formats', () => {
      const keybindings: Keybinding[] = [
        { commandId: 'Test1', combo: { key: 'r' } }, // Old format
        { commandId: 'Test2', combo: { key: 'KeyS' } }, // New format
        { commandId: 'Test3', combo: { key: 'q' } } // Old format
      ]

      const result = migrateKeybindings(keybindings)

      expect(result.migrated).toBe(true)
      expect(result.keybindings[0].combo.key).toBe('KeyR')
      expect(result.keybindings[1].combo.key).toBe('KeyS')
      expect(result.keybindings[2].combo.key).toBe('KeyQ')
    })

    it('should handle empty array', () => {
      const result = migrateKeybindings([])

      expect(result.migrated).toBe(false)
      expect(result.keybindings).toHaveLength(0)
    })

    it('should handle undefined input', () => {
      const result = migrateKeybindings(undefined)

      expect(result.migrated).toBe(false)
      expect(result.keybindings).toHaveLength(0)
    })
  })

  describe('normalizeKey', () => {
    it('should normalize old format keys', () => {
      expect(normalizeKey('r')).toBe('KeyR')
      expect(normalizeKey('s')).toBe('KeyS')
      expect(normalizeKey('5')).toBe('Digit5')
      expect(normalizeKey('-')).toBe('Minus')
    })

    it('should leave new format keys unchanged', () => {
      expect(normalizeKey('KeyR')).toBe('KeyR')
      expect(normalizeKey('Digit5')).toBe('Digit5')
      expect(normalizeKey('Enter')).toBe('Enter')
    })
  })

  describe('real-world migration scenarios', () => {
    it('should migrate common shortcuts', () => {
      const commonShortcuts: Keybinding[] = [
        // Refresh nodes
        { commandId: 'Comfy.RefreshNodeDefinitions', combo: { key: 'r' } },
        // Save
        { commandId: 'Comfy.SaveWorkflow', combo: { key: 's', ctrl: true } },
        // Queue prompt
        { commandId: 'Comfy.QueuePrompt', combo: { key: 'Enter', ctrl: true } },
        // Toggle sidebar
        { commandId: 'Workspace.ToggleSidebar', combo: { key: 'q' } }
      ]

      const result = migrateKeybindings(commonShortcuts)

      expect(result.migrated).toBe(true)
      expect(result.keybindings[0].combo.key).toBe('KeyR')
      expect(result.keybindings[1].combo.key).toBe('KeyS')
      expect(result.keybindings[2].combo.key).toBe('Enter')
      expect(result.keybindings[3].combo.key).toBe('KeyQ')
    })

    it('should handle keybindings with punctuation', () => {
      const punctuationShortcuts: Keybinding[] = [
        { commandId: 'Zoom.In', combo: { key: '=', alt: true } },
        { commandId: 'Zoom.Out', combo: { key: '-', alt: true } },
        { commandId: 'Search', combo: { key: '/', ctrl: true } }
      ]

      const result = migrateKeybindings(punctuationShortcuts)

      expect(result.migrated).toBe(true)
      expect(result.keybindings[0].combo.key).toBe('Equal')
      expect(result.keybindings[1].combo.key).toBe('Minus')
      expect(result.keybindings[2].combo.key).toBe('Slash')
    })
  })
})
