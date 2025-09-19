import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Button from 'primevue/button'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { ConflictDetectionResult } from '@/types/conflictDetectionTypes'
import NodeConflictDialogContent from '@/workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue'

// Mock getConflictMessage utility
vi.mock('@/utils/conflictMessageUtil', () => ({
  getConflictMessage: vi.fn((conflict) => {
    return `${conflict.type}: ${conflict.current_value} vs ${conflict.required_value}`
  })
}))

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key: string) => {
      const translations: Record<string, string> = {
        'manager.conflicts.description': 'Some extensions are not compatible',
        'manager.conflicts.info': 'Additional info about conflicts',
        'manager.conflicts.conflicts': 'Conflicts',
        'manager.conflicts.extensionAtRisk': 'Extensions at Risk',
        'manager.conflicts.importFailedExtensions': 'Import Failed Extensions'
      }
      return translations[key] || key
    })
  }))
}))

// Mock data for conflict detection
const mockConflictData = ref<ConflictDetectionResult[]>([])

// Mock useConflictDetection composable
vi.mock('@/composables/useConflictDetection', () => ({
  useConflictDetection: () => ({
    conflictedPackages: computed(() => mockConflictData.value)
  })
}))

describe('NodeConflictDialogContent', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    // Reset mock data
    mockConflictData.value = []
  })

  const createWrapper = (props = {}) => {
    return mount(NodeConflictDialogContent, {
      props,
      global: {
        plugins: [pinia],
        components: {
          Button
        },
        stubs: {
          ContentDivider: true
        },
        mocks: {
          $t: vi.fn((key: string) => {
            const translations: Record<string, string> = {
              'manager.conflicts.description':
                'Some extensions are not compatible',
              'manager.conflicts.info': 'Additional info about conflicts',
              'manager.conflicts.conflicts': 'Conflicts',
              'manager.conflicts.extensionAtRisk': 'Extensions at Risk',
              'manager.conflicts.importFailedExtensions':
                'Import Failed Extensions'
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
    },
    {
      package_id: 'Package3',
      package_name: 'Test Package 3',
      has_conflict: true,
      is_compatible: false,
      conflicts: [
        {
          type: 'import_failed',
          current_value: 'installed',
          required_value: 'ModuleNotFoundError: No module named "example"'
        }
      ]
    }
  ]

  describe('rendering', () => {
    it('should render without conflicts', () => {
      // Set empty conflict data
      mockConflictData.value = []

      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('0')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('Extensions at Risk')
      expect(wrapper.find('[class*="Import Failed Extensions"]').exists()).toBe(
        false
      )
    })

    it('should render with conflict data from composable', () => {
      // Set conflict data
      mockConflictData.value = mockConflictResults

      const wrapper = createWrapper()

      // Should show 3 total conflicts (2 from Package1 + 1 from Package2, excluding import_failed)
      expect(wrapper.text()).toContain('3')
      expect(wrapper.text()).toContain('Conflicts')
      // Should show 3 extensions at risk (all packages)
      expect(wrapper.text()).toContain('Extensions at Risk')
      // Should show import failed section
      expect(wrapper.text()).toContain('Import Failed Extensions')
      expect(wrapper.text()).toContain('1') // 1 import failed package
    })

    it('should show description when showAfterWhatsNew is true', () => {
      const wrapper = createWrapper({
        showAfterWhatsNew: true
      })

      expect(wrapper.text()).toContain('Some extensions are not compatible')
      expect(wrapper.text()).toContain('Additional info about conflicts')
    })

    it('should not show description when showAfterWhatsNew is false', () => {
      const wrapper = createWrapper({
        showAfterWhatsNew: false
      })

      expect(wrapper.text()).not.toContain('Some extensions are not compatible')
      expect(wrapper.text()).not.toContain('Additional info about conflicts')
    })

    it('should separate import_failed conflicts into separate section', () => {
      mockConflictData.value = mockConflictResults

      const wrapper = createWrapper()

      // Import Failed Extensions section should show 1 package
      const importFailedSection = wrapper.findAll(
        '.w-full.flex.flex-col.bg-neutral-200'
      )[0]
      expect(importFailedSection.text()).toContain('1')
      expect(importFailedSection.text()).toContain('Import Failed Extensions')

      // Conflicts section should show 3 conflicts (excluding import_failed)
      const conflictsSection = wrapper.findAll(
        '.w-full.flex.flex-col.bg-neutral-200'
      )[1]
      expect(conflictsSection.text()).toContain('3')
      expect(conflictsSection.text()).toContain('Conflicts')
    })
  })

  describe('panel interactions', () => {
    beforeEach(() => {
      mockConflictData.value = mockConflictResults
    })

    it('should toggle import failed panel', async () => {
      const wrapper = createWrapper()

      // Find import failed panel header (first one)
      const importFailedHeader = wrapper.find('.w-full.h-8.flex.items-center')

      // Initially collapsed
      expect(
        wrapper.find('[class*="py-2 px-4 flex flex-col gap-2.5"]').exists()
      ).toBe(false)

      // Click to expand import failed panel
      await importFailedHeader.trigger('click')

      // Should be expanded now and show package name
      const expandedContent = wrapper.find(
        '[class*="py-2 px-4 flex flex-col gap-2.5"]'
      )
      expect(expandedContent.exists()).toBe(true)
      expect(expandedContent.text()).toContain('Test Package 3')

      // Should show chevron-down icon when expanded
      const chevronButton = wrapper.findComponent(Button)
      expect(chevronButton.props('icon')).toContain('pi-chevron-down')
    })

    it('should toggle conflicts panel', async () => {
      const wrapper = createWrapper()

      // Find conflicts panel header (second one)
      const conflictsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[1]

      // Click to expand conflicts panel
      await conflictsHeader.trigger('click')

      // Should be expanded now
      const conflictItems = wrapper.findAll('.conflict-list-item')
      expect(conflictItems.length).toBeGreaterThan(0)
    })

    it('should toggle extensions panel', async () => {
      const wrapper = createWrapper()

      // Find extensions panel header (third one)
      const extensionsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[2]

      // Click to expand extensions panel
      await extensionsHeader.trigger('click')

      // Should be expanded now and show all package names
      const expandedContent = wrapper.findAll(
        '[class*="py-2 px-4 flex flex-col gap-2.5"]'
      )[0]
      expect(expandedContent.exists()).toBe(true)
      expect(expandedContent.text()).toContain('Test Package 1')
      expect(expandedContent.text()).toContain('Test Package 2')
      expect(expandedContent.text()).toContain('Test Package 3')
    })

    it('should collapse other panels when opening one', async () => {
      const wrapper = createWrapper()

      const importFailedHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[0]
      const conflictsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[1]
      const extensionsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[2]

      // Open import failed panel first
      await importFailedHeader.trigger('click')

      // Verify import failed panel is open
      expect((wrapper.vm as any).importFailedExpanded).toBe(true)
      expect((wrapper.vm as any).conflictsExpanded).toBe(false)
      expect((wrapper.vm as any).extensionsExpanded).toBe(false)

      // Open conflicts panel
      await conflictsHeader.trigger('click')

      // Verify conflicts panel is open and others are closed
      expect((wrapper.vm as any).importFailedExpanded).toBe(false)
      expect((wrapper.vm as any).conflictsExpanded).toBe(true)
      expect((wrapper.vm as any).extensionsExpanded).toBe(false)

      // Open extensions panel
      await extensionsHeader.trigger('click')

      // Verify extensions panel is open and others are closed
      expect((wrapper.vm as any).importFailedExpanded).toBe(false)
      expect((wrapper.vm as any).conflictsExpanded).toBe(false)
      expect((wrapper.vm as any).extensionsExpanded).toBe(true)
    })
  })

  describe('conflict display', () => {
    beforeEach(() => {
      mockConflictData.value = mockConflictResults
    })

    it('should display individual conflict details excluding import_failed', async () => {
      const wrapper = createWrapper()

      // Expand conflicts panel (second header)
      const conflictsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[1]
      await conflictsHeader.trigger('click')

      // Should display conflict messages (excluding import_failed)
      const conflictItems = wrapper.findAll('.conflict-list-item')
      expect(conflictItems).toHaveLength(3) // 2 from Package1 + 1 from Package2
    })

    it('should display import failed packages separately', async () => {
      const wrapper = createWrapper()

      // Expand import failed panel (first header)
      const importFailedHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[0]
      await importFailedHeader.trigger('click')

      // Should display only import failed package
      const importFailedItems = wrapper.findAll('.conflict-list-item')
      expect(importFailedItems).toHaveLength(1)
      expect(importFailedItems[0].text()).toContain('Test Package 3')
    })

    it('should display all package names in extensions list', async () => {
      const wrapper = createWrapper()

      // Expand extensions panel (third header)
      const extensionsHeader = wrapper.findAll(
        '.w-full.h-8.flex.items-center'
      )[2]
      await extensionsHeader.trigger('click')

      // Should display all package names
      expect(wrapper.text()).toContain('Test Package 1')
      expect(wrapper.text()).toContain('Test Package 2')
      expect(wrapper.text()).toContain('Test Package 3')
    })
  })

  describe('empty states', () => {
    it('should handle empty conflicts gracefully', () => {
      mockConflictData.value = []
      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('0')
      expect(wrapper.text()).toContain('Conflicts')
      expect(wrapper.text()).toContain('Extensions at Risk')
      // Import failed section should not be visible when there are no import failures
      expect(wrapper.text()).not.toContain('Import Failed Extensions')
    })

    it('should handle conflicts without import_failed', () => {
      // Only set packages without import_failed conflicts
      mockConflictData.value = [mockConflictResults[0], mockConflictResults[1]]
      const wrapper = createWrapper()

      expect(wrapper.text()).toContain('3') // conflicts count
      expect(wrapper.text()).toContain('2') // extensions count
      // Import failed section should not be visible
      expect(wrapper.text()).not.toContain('Import Failed Extensions')
    })
  })

  describe('scrolling behavior', () => {
    it('should apply scrollbar styles to all expandable lists', async () => {
      mockConflictData.value = mockConflictResults
      const wrapper = createWrapper()

      // Test all three panels
      const headers = wrapper.findAll('.w-full.h-8.flex.items-center')

      for (let i = 0; i < headers.length; i++) {
        await headers[i].trigger('click')

        // Check for scrollable container with proper classes
        const scrollableContainer = wrapper.find(
          '[class*="max-h-"][class*="overflow-y-auto"][class*="scrollbar-hide"]'
        )
        expect(scrollableContainer.exists()).toBe(true)

        // Close the panel for next iteration
        await headers[i].trigger('click')
      }
    })
  })

  describe('accessibility', () => {
    it('should have proper button roles and labels', () => {
      mockConflictData.value = mockConflictResults
      const wrapper = createWrapper()

      const buttons = wrapper.findAllComponents(Button)
      expect(buttons.length).toBe(3) // 3 chevron buttons

      // Check chevron buttons have icons
      buttons.forEach((button) => {
        expect(button.props('icon')).toBeDefined()
        expect(button.props('icon')).toMatch(/pi-chevron-(right|down)/)
      })
    })

    it('should have clickable panel headers', () => {
      mockConflictData.value = mockConflictResults
      const wrapper = createWrapper()

      const headers = wrapper.findAll('.w-full.h-8.flex.items-center')
      expect(headers).toHaveLength(3) // import failed, conflicts and extensions headers

      headers.forEach((header) => {
        expect(header.element.tagName).toBe('DIV')
      })
    })
  })

  describe('es-toolkit optimization', () => {
    it('should efficiently filter conflicts using es-toolkit', () => {
      mockConflictData.value = mockConflictResults
      const wrapper = createWrapper()

      // Verify that import_failed conflicts are filtered out from main conflicts
      const vm = wrapper.vm as any
      expect(vm.allConflictDetails).toHaveLength(3) // Should not include import_failed
      expect(
        vm.allConflictDetails.every((c: any) => c.type !== 'import_failed')
      ).toBe(true)
    })

    it('should efficiently extract import failed packages using es-toolkit', () => {
      mockConflictData.value = mockConflictResults
      const wrapper = createWrapper()

      // Verify that only import_failed packages are extracted
      const vm = wrapper.vm as any
      expect(vm.importFailedConflicts).toHaveLength(1)
      expect(vm.importFailedConflicts[0]).toBe('Test Package 3')
    })
  })
})
