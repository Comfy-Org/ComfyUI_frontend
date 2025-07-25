import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import Button from 'primevue/button'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NodeConflictDialogContent from '@/components/dialog/content/manager/NodeConflictDialogContent.vue'
import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'
import { getConflictMessage } from '@/utils/conflictMessageUtil'

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key: string) => {
      const translations: Record<string, string> = {
        'manager.conflicts.conflicts': 'Conflicts',
        'manager.conflicts.extensionAtRisk': 'Extensions at Risk'
      }
      return translations[key] || key
    })
  }))
}))

describe('NodeConflictDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(NodeConflictDialogContent, {
      props,
      global: {
        plugins: [createPinia()],
        components: {
          Button
        },
        mocks: {
          $t: vi.fn((key: string) => {
            const translations: Record<string, string> = {
              'manager.conflicts.conflicts': 'Conflicts',
              'manager.conflicts.extensionAtRisk': 'Extensions at Risk'
            }
            return translations[key] || key
          })
        }
      }
    })
  }

  const mockConflictResults: ConflictDetectionResult[] = [
    {
      package_id: 'Package1',
      package_name: 'Test Package 1',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        {
          type: 'os',
          current_value: 'macOS',
          required_value: 'Windows'
        },
        {
          type: 'accelerator',
          current_value: 'Metal',
          required_value: 'CUDA'
        }
      ]
    },
    {
      package_id: 'Package2',
      package_name: 'Test Package 2',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        {
          type: 'banned',
          current_value: 'installed',
          required_value: 'not_banned'
        }
      ]
    }
  ]

  describe('rendering', () => {
    it('should render without conflicts', () => {
      const wrapper = createWrapper({
        conflicts: [],
        conflictedPackages: []
      })

      expect(wrapper.text()).toContain('0')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('Extensions at Risk')
    })

    it('should render with conflict data from conflicts prop', () => {
      const wrapper = createWrapper({
        conflicts: mockConflictResults,
        conflictedPackages: []
      })

      expect(wrapper.text()).toContain('3') // 2 from Package1 + 1 from Package2
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('2')
      expect(wrapper.text()).toContain('Extensions at Risk')
    })

    it('should render with conflict data from conflictedPackages prop', () => {
      const wrapper = createWrapper({
        conflicts: [],
        conflictedPackages: mockConflictResults
      })

      expect(wrapper.text()).toContain('3')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('2')
      expect(wrapper.text()).toContain('Extensions at Risk')
    })

    it('should prioritize conflictedPackages over conflicts prop', () => {
      const singleConflict: ConflictDetectionResult[] = [
        {
          package_id: 'SinglePackage',
          package_name: 'Single Package',
          has_conflict: true,
          is_compatible: false,
          conflicts: [
            {
              type: 'os',
              current_value: 'macOS',
              required_value: 'Windows'
            }
          ]
        }
      ]

      const wrapper = createWrapper({
        conflicts: mockConflictResults, // 3 conflicts
        conflictedPackages: singleConflict // 1 conflict
      })

      // Should use conflictedPackages (1 conflict) instead of conflicts (3 conflicts)
      expect(wrapper.text()).toContain('1')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('Extensions at Risk')
    })
  })

  describe('panel interactions', () => {
    it('should toggle conflicts panel', async () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      // Initially collapsed
      expect(wrapper.find('.conflict-list-item').exists()).toBe(false)

      // Click to expand conflicts panel
      const conflictsHeader = wrapper.find('.w-full.h-8.flex.items-center')
      await conflictsHeader.trigger('click')

      // Should be expanded now
      expect(wrapper.find('.conflict-list-item').exists()).toBe(true)

      // Should show chevron-down icon when expanded
      const chevronButton = wrapper.findComponent(Button)
      expect(chevronButton.props('icon')).toContain('pi-chevron-down')
    })

    it('should toggle extensions panel', async () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      // Find extensions panel header (second one)
      const extensionsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[1]

      // Initially collapsed
      expect(
        wrapper.find('[class*="py-2 px-4 flex flex-col gap-2.5"]').exists()
      ).toBe(false)

      // Click to expand extensions panel
      await extensionsHeader.trigger('click')

      // Should be expanded now
      expect(
        wrapper.find('[class*="py-2 px-4 flex flex-col gap-2.5"]').exists()
      ).toBe(true)
    })

    it('should collapse other panel when opening one', async () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      const conflictsHeader = wrapper.find('.w-full.h-8.flex.items-center')
      const extensionsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[1]

      // Open conflicts panel first
      await conflictsHeader.trigger('click')

      // Verify conflicts panel is open
      expect((wrapper.vm as any).conflictsExpanded).toBe(true)
      expect((wrapper.vm as any).extensionsExpanded).toBe(false)

      // Open extensions panel
      await extensionsHeader.trigger('click')

      // Verify extensions panel is open and conflicts panel is closed
      expect((wrapper.vm as any).conflictsExpanded).toBe(false)
      expect((wrapper.vm as any).extensionsExpanded).toBe(true)
    })
  })

  describe('conflict display', () => {
    it('should display individual conflict details', async () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      // Expand conflicts panel
      const conflictsHeader = wrapper.find('.w-full.h-8.flex.items-center')
      await conflictsHeader.trigger('click')

      // Should display conflict messages
      const conflictItems = wrapper.findAll('.conflict-list-item')
      expect(conflictItems).toHaveLength(3) // 2 from Package1 + 1 from Package2
    })

    it('should display package names in extensions list', async () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      // Expand extensions panel
      const extensionsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[1]
      await extensionsHeader.trigger('click')

      // Should display package names
      expect(wrapper.text()).toContain('Test Package 1')
      expect(wrapper.text()).toContain('Test Package 2')
    })
  })

  describe('conflict message generation', () => {
    it('should generate appropriate conflict messages', () => {
      // Mock translation function for testing
      const mockT = vi.fn((key: string, params?: Record<string, any>) => {
        const translations: Record<string, string> = {
          'manager.conflicts.conflictMessages.os': `OS conflict: ${params?.current} vs ${params?.required}`,
          'manager.conflicts.conflictMessages.accelerator': `Accelerator conflict: ${params?.current} vs ${params?.required}`,
          'manager.conflicts.conflictMessages.banned': 'This package is banned'
        }
        return translations[key] || key
      })

      // Test the getConflictMessage utility function
      const osConflict = mockConflictResults[0].conflicts[0]
      const acceleratorConflict = mockConflictResults[0].conflicts[1]
      const bannedConflict = mockConflictResults[1].conflicts[0]

      const osMessage = getConflictMessage(osConflict, mockT)
      const acceleratorMessage = getConflictMessage(acceleratorConflict, mockT)
      const bannedMessage = getConflictMessage(bannedConflict, mockT)

      expect(osMessage).toContain('OS conflict')
      expect(acceleratorMessage).toContain('Accelerator conflict')
      expect(bannedMessage).toContain('banned')
    })
  })

  describe('empty states', () => {
    it('should handle empty conflicts gracefully', () => {
      const wrapper = createWrapper({
        conflicts: [],
        conflictedPackages: []
      })

      expect(wrapper.text()).toContain('0')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('Extensions at Risk')
    })

    it('should handle undefined props gracefully', () => {
      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('0')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('Extensions at Risk')
    })
  })

  describe('scrolling behavior', () => {
    it('should apply scrollbar styles to conflict lists', async () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      // Expand conflicts panel
      const conflictsHeader = wrapper.find('.w-full.h-8.flex.items-center')
      await conflictsHeader.trigger('click')

      // Check for scrollable container with proper classes
      const scrollableContainer = wrapper.find(
        '[class*="max-h-"][class*="overflow-y-auto"][class*="scrollbar-hide"]'
      )
      expect(scrollableContainer.exists()).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('should have proper button roles and labels', () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      const buttons = wrapper.findAllComponents(Button)
      expect(buttons.length).toBeGreaterThan(0)

      // Check chevron buttons have icons
      buttons.forEach((button) => {
        expect(button.props('icon')).toBeDefined()
      })
    })

    it('should have clickable panel headers', () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      const headers = wrapper.findAll('.w-full.h-8.flex.items-center')
      expect(headers).toHaveLength(2) // conflicts and extensions headers

      headers.forEach((header) => {
        expect(header.element.tagName).toBe('DIV')
      })
    })
  })

  describe('props handling', () => {
    it('should emit dismiss event when needed', () => {
      const wrapper = createWrapper({
        conflictedPackages: mockConflictResults
      })

      // Component now uses emit pattern instead of callback props
      expect(wrapper.emitted('dismiss')).toBeUndefined()
    })
  })
})
