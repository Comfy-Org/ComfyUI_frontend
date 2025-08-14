import { describe, expect, it } from 'vitest'

import { CommandSearchService } from '@/services/commandSearchService'
import { ComfyCommandImpl } from '@/stores/commandStore'

describe('CommandSearchService', () => {
  // Mock commands
  const mockCommands: ComfyCommandImpl[] = [
    new ComfyCommandImpl({
      id: 'Comfy.NewBlankWorkflow',
      label: 'New Blank Workflow',
      icon: 'pi pi-plus',
      function: () => {}
    }),
    new ComfyCommandImpl({
      id: 'Comfy.SaveWorkflow',
      label: 'Save Workflow',
      icon: 'pi pi-save',
      function: () => {}
    }),
    new ComfyCommandImpl({
      id: 'Comfy.OpenWorkflow',
      label: 'Open Workflow',
      icon: 'pi pi-folder-open',
      function: () => {}
    }),
    new ComfyCommandImpl({
      id: 'Comfy.ClearWorkflow',
      label: 'Clear Workflow',
      icon: 'pi pi-trash',
      function: () => {}
    }),
    new ComfyCommandImpl({
      id: 'Comfy.Undo',
      label: 'Undo',
      icon: 'pi pi-undo',
      function: () => {}
    })
  ]

  describe('searchCommands', () => {
    it('should return all commands sorted alphabetically when query is empty', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('')

      expect(results).toHaveLength(mockCommands.length)
      expect(results[0].label).toBe('Clear Workflow')
      expect(results[1].label).toBe('New Blank Workflow')
      expect(results[2].label).toBe('Open Workflow')
      expect(results[3].label).toBe('Save Workflow')
      expect(results[4].label).toBe('Undo')
    })

    it('should handle query with leading ">"', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('>workflow')

      expect(results.length).toBeGreaterThan(0)
      expect(
        results.every(
          (cmd) =>
            cmd.label?.toLowerCase().includes('workflow') ||
            cmd.id.toLowerCase().includes('workflow')
        )
      ).toBe(true)
    })

    it('should search by label', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('save')

      expect(results).toHaveLength(1)
      expect(results[0].label).toBe('Save Workflow')
    })

    it('should search by id', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('ClearWorkflow')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('Comfy.ClearWorkflow')
    })

    it('should respect search limit', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('', { limit: 2 })

      expect(results).toHaveLength(2)
    })

    it('should handle partial matches', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('work')

      expect(results.length).toBeGreaterThan(1)
      expect(
        results.every(
          (cmd) =>
            cmd.label?.toLowerCase().includes('work') ||
            cmd.id.toLowerCase().includes('work')
        )
      ).toBe(true)
    })

    it('should return empty array for no matches', () => {
      const service = new CommandSearchService(mockCommands)
      const results = service.searchCommands('xyz123')

      expect(results).toHaveLength(0)
    })
  })

  describe('updateCommands', () => {
    it('should update the commands list', () => {
      const service = new CommandSearchService(mockCommands)
      const newCommands = [
        new ComfyCommandImpl({
          id: 'Test.Command',
          label: 'Test Command',
          function: () => {}
        })
      ]

      service.updateCommands(newCommands)
      const results = service.searchCommands('')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('Test.Command')
    })
  })
})
