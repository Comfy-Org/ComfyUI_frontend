/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/no-container */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import NodeConflictDialogContent from '@/workbench/extensions/manager/components/manager/NodeConflictDialogContent.vue'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'

// Mock getConflictMessage utility
vi.mock('@/workbench/extensions/manager/utils/conflictMessageUtil', () => ({
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
vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      conflictedPackages: computed(() => mockConflictData.value)
    })
  })
)

describe('NodeConflictDialogContent', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    mockConflictData.value = []
  })

  function renderComponent(props = {}) {
    const user = userEvent.setup()
    const result = render(NodeConflictDialogContent, {
      props,
      global: {
        plugins: [pinia],
        stubs: {
          ContentDivider: true,
          Button: { template: '<button><slot /></button>' }
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
    return { ...result, user }
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
      mockConflictData.value = []

      const { container } = renderComponent()

      expect(container.textContent).not.toContain('Conflicts')
      expect(container.textContent).not.toContain('Extensions at Risk')
      expect(container.textContent).not.toContain('Import Failed Extensions')
    })

    it('should render with conflict data from composable', () => {
      mockConflictData.value = mockConflictResults

      const { container } = renderComponent()

      expect(container.textContent).toContain('3')
      expect(container.textContent).toContain('Conflicts')
      expect(container.textContent).toContain('Extensions at Risk')
      expect(container.textContent).toContain('Import Failed Extensions')
      expect(container.textContent).toContain('1')
    })

    it('should show description when showAfterWhatsNew is true', () => {
      const { container } = renderComponent({
        showAfterWhatsNew: true
      })

      expect(container.textContent).toContain(
        'Some extensions are not compatible'
      )
      expect(container.textContent).toContain('Additional info about conflicts')
    })

    it('should not show description when showAfterWhatsNew is false', () => {
      const { container } = renderComponent({
        showAfterWhatsNew: false
      })

      expect(container.textContent).not.toContain(
        'Some extensions are not compatible'
      )
      expect(container.textContent).not.toContain(
        'Additional info about conflicts'
      )
    })

    it('should separate import_failed conflicts into separate section', () => {
      mockConflictData.value = mockConflictResults

      const { container } = renderComponent()

      const sections = container.querySelectorAll(
        '.w-full.flex.flex-col.bg-base-background'
      )

      // Import Failed Extensions section
      expect(sections[0].textContent).toContain('1')
      expect(sections[0].textContent).toContain('Import Failed Extensions')

      // Conflicts section
      expect(sections[1].textContent).toContain('3')
      expect(sections[1].textContent).toContain('Conflicts')
    })
  })

  describe('panel interactions', () => {
    beforeEach(() => {
      mockConflictData.value = mockConflictResults
    })

    it('should toggle import failed panel', async () => {
      const { container, user } = renderComponent()

      const importFailedHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[0]

      expect(
        screen.queryByTestId('conflict-dialog-panel-expanded')
      ).not.toBeInTheDocument()

      await user.click(importFailedHeader)

      const expandedContent = screen.getByTestId(
        'conflict-dialog-panel-expanded'
      )
      expect(expandedContent).toBeInTheDocument()
      expect(expandedContent.textContent).toContain('Test Package 3')

      const chevronIcon = container.querySelector(
        '[data-testid="conflict-dialog-panel-toggle"] i'
      )
      expect(chevronIcon).toHaveClass('pi-chevron-down')
    })

    it('should toggle conflicts panel', async () => {
      const { user } = renderComponent()

      const conflictsHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[1]

      await user.click(conflictsHeader)

      const conflictItems = screen.getAllByLabelText(/Conflict:/)
      expect(conflictItems.length).toBeGreaterThan(0)
    })

    it('should toggle extensions panel', async () => {
      const { user } = renderComponent()

      const extensionsHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[2]

      await user.click(extensionsHeader)

      const expandedContent = screen.getByTestId(
        'conflict-dialog-panel-expanded'
      )
      expect(expandedContent).toBeInTheDocument()
      expect(expandedContent.textContent).toContain('Test Package 1')
      expect(expandedContent.textContent).toContain('Test Package 2')
      expect(expandedContent.textContent).toContain('Test Package 3')
    })

    it('should collapse other panels when opening one', async () => {
      const { user } = renderComponent()

      const toggles = screen.getAllByTestId('conflict-dialog-panel-toggle')

      // Open import failed panel
      await user.click(toggles[0])
      expect(
        screen.getByTestId('conflict-dialog-panel-expanded').textContent
      ).toContain('Test Package 3')

      // Open conflicts panel — import failed should close
      await user.click(toggles[1])
      const expandedPanels = screen.getAllByTestId(
        'conflict-dialog-panel-expanded'
      )
      expect(expandedPanels).toHaveLength(1)
      expect(expandedPanels[0].textContent).not.toContain('Test Package 3')
      expect(screen.getAllByLabelText(/Conflict:/).length).toBeGreaterThan(0)

      // Open extensions panel — conflicts should close
      await user.click(toggles[2])
      const expandedAfterExt = screen.getAllByTestId(
        'conflict-dialog-panel-expanded'
      )
      expect(expandedAfterExt).toHaveLength(1)
      expect(expandedAfterExt[0].textContent).toContain('Test Package 1')
      expect(expandedAfterExt[0].textContent).toContain('Test Package 2')
      expect(expandedAfterExt[0].textContent).toContain('Test Package 3')
    })
  })

  describe('conflict display', () => {
    beforeEach(() => {
      mockConflictData.value = mockConflictResults
    })

    it('should display individual conflict details excluding import_failed', async () => {
      const { user } = renderComponent()

      const conflictsHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[1]
      await user.click(conflictsHeader)

      const conflictItems = screen.getAllByLabelText(/Conflict:/)
      expect(conflictItems).toHaveLength(3)
    })

    it('should display import failed packages separately', async () => {
      const { user } = renderComponent()

      const importFailedHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[0]
      await user.click(importFailedHeader)

      const importFailedItems = screen.getAllByLabelText(
        /Import failed package:/
      )
      expect(importFailedItems).toHaveLength(1)
      expect(importFailedItems[0].textContent).toContain('Test Package 3')
    })

    it('should display all package names in extensions list', async () => {
      const { container, user } = renderComponent()

      const extensionsHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[2]
      await user.click(extensionsHeader)

      expect(container.textContent).toContain('Test Package 1')
      expect(container.textContent).toContain('Test Package 2')
      expect(container.textContent).toContain('Test Package 3')
    })
  })

  describe('empty states', () => {
    it('should handle empty conflicts gracefully', () => {
      mockConflictData.value = []
      const { container } = renderComponent()

      expect(container.textContent).not.toContain('Conflicts')
      expect(container.textContent).not.toContain('Extensions at Risk')
      expect(container.textContent).not.toContain('Import Failed Extensions')
    })

    it('should handle conflicts without import_failed', () => {
      mockConflictData.value = [mockConflictResults[0], mockConflictResults[1]]
      const { container } = renderComponent()

      expect(container.textContent).toContain('3')
      expect(container.textContent).toContain('2')
      expect(container.textContent).not.toContain('Import Failed Extensions')
    })
  })

  describe('scrolling behavior', () => {
    it('should apply scrollbar styles to all expandable lists', async () => {
      mockConflictData.value = mockConflictResults
      const { container, user } = renderComponent()

      const headers = screen.getAllByTestId('conflict-dialog-panel-toggle')

      for (const header of headers) {
        await user.click(header)

        const scrollableContainer = container.querySelector(
          '[class*="max-h-"][class*="overflow-y-auto"][class*="scrollbar-hide"]'
        )
        expect(scrollableContainer).toBeInTheDocument()

        await user.click(header)
      }
    })
  })

  describe('accessibility', () => {
    it('should have proper button roles and labels', () => {
      mockConflictData.value = mockConflictResults
      const { container } = renderComponent()

      const icons = container.querySelectorAll('i[class*="pi-chevron"]')
      expect(icons).toHaveLength(3)

      icons.forEach((icon) => {
        expect(icon.className).toMatch(/pi-chevron-(right|down)/)
      })
    })

    it('should have clickable panel headers', () => {
      mockConflictData.value = mockConflictResults
      renderComponent()

      const headers = screen.getAllByTestId('conflict-dialog-panel-toggle')
      expect(headers).toHaveLength(3)

      headers.forEach((header) => {
        expect(header.tagName).toBe('DIV')
      })
    })
  })

  describe('es-toolkit optimization', () => {
    it('should efficiently filter conflicts using es-toolkit', async () => {
      mockConflictData.value = mockConflictResults
      const { user } = renderComponent()

      // Expand conflicts panel to verify filtered items in DOM
      const conflictsHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[1]
      await user.click(conflictsHeader)

      const conflictItems = screen.getAllByLabelText(/Conflict:/)
      expect(conflictItems).toHaveLength(3)

      // Verify none are import_failed
      conflictItems.forEach((item) => {
        expect(item.getAttribute('aria-label')).not.toContain('import_failed')
      })
    })

    it('should efficiently extract import failed packages using es-toolkit', async () => {
      mockConflictData.value = mockConflictResults
      const { user } = renderComponent()

      // Expand import failed panel to verify items in DOM
      const importFailedHeader = screen.getAllByTestId(
        'conflict-dialog-panel-toggle'
      )[0]
      await user.click(importFailedHeader)

      const importFailedItems = screen.getAllByLabelText(
        /Import failed package:/
      )
      expect(importFailedItems).toHaveLength(1)
      expect(importFailedItems[0].textContent).toContain('Test Package 3')
    })
  })
})
