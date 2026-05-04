import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@testing-library/vue'

import ShortcutsList from '@/components/bottomPanel/tabs/shortcuts/ShortcutsList.vue'
import type { ComfyCommandImpl } from '@/stores/commandStore'

// Mock vue-i18n
const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    'shortcuts.subcategories.workflow': 'Workflow',
    'shortcuts.subcategories.node': 'Node',
    'shortcuts.subcategories.queue': 'Queue',
    'shortcuts.subcategories.view': 'View',
    'shortcuts.subcategories.panelControls': 'Panel Controls',
    'commands.Workflow_New.label': 'New Blank Workflow'
  }
  return translations[key] || key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

describe('ShortcutsList', () => {
  const mockCommands: ComfyCommandImpl[] = [
    {
      id: 'Workflow.New',
      label: 'New Workflow',
      category: 'essentials',
      keybinding: {
        combo: {
          getKeySequences: () => ['Control', 'n']
        }
      }
    } as ComfyCommandImpl,
    {
      id: 'Node.Add',
      label: 'Add Node',
      category: 'essentials',
      keybinding: {
        combo: {
          getKeySequences: () => ['Shift', 'a']
        }
      }
    } as ComfyCommandImpl,
    {
      id: 'Queue.Clear',
      label: 'Clear Queue',
      category: 'essentials',
      keybinding: {
        combo: {
          getKeySequences: () => ['Control', 'Shift', 'c']
        }
      }
    } as ComfyCommandImpl
  ]

  const mockSubcategories = {
    workflow: [mockCommands[0]],
    node: [mockCommands[1]],
    queue: [mockCommands[2]]
  }

  it('should render shortcuts organized by subcategories', () => {
    render(ShortcutsList, {
      props: {
        subcategories: mockSubcategories
      }
    })

    expect(screen.getByText('Workflow')).toBeInTheDocument()
    expect(screen.getByText('Node')).toBeInTheDocument()
    expect(screen.getByText('Queue')).toBeInTheDocument()
    expect(screen.getByText('New Blank Workflow')).toBeInTheDocument()
  })

  it('should format keyboard shortcuts correctly', () => {
    const { container } = render(ShortcutsList, {
      props: {
        subcategories: mockSubcategories
      }
    })

    const text = container.textContent!
    expect(text).toContain('Ctrl')
    expect(text).toContain('n')
    expect(text).toContain('Shift')
    expect(text).toContain('a')
    expect(text).toContain('c')
  })

  it('should filter out commands without keybindings', () => {
    const commandsWithoutKeybinding: ComfyCommandImpl[] = [
      ...mockCommands,
      {
        id: 'No.Keybinding',
        label: 'No Keybinding',
        category: 'essentials',
        keybinding: null
      } as ComfyCommandImpl
    ]

    render(ShortcutsList, {
      props: {
        subcategories: {
          ...mockSubcategories,
          other: [commandsWithoutKeybinding[3]]
        }
      }
    })

    expect(screen.queryByText('No Keybinding')).not.toBeInTheDocument()
  })

  it('should handle special key formatting', () => {
    const specialKeyCommand: ComfyCommandImpl = {
      id: 'Special.Keys',
      label: 'Special Keys',
      category: 'essentials',
      keybinding: {
        combo: {
          getKeySequences: () => ['Meta', 'ArrowUp', 'Enter', 'Escape', ' ']
        }
      }
    } as ComfyCommandImpl

    const { container } = render(ShortcutsList, {
      props: {
        subcategories: {
          special: [specialKeyCommand]
        }
      }
    })

    const text = container.textContent!
    expect(text).toContain('Cmd') // Meta -> Cmd
    expect(text).toContain('↑') // ArrowUp -> ↑
    expect(text).toContain('↵') // Enter -> ↵
    expect(text).toContain('Esc') // Escape -> Esc
    expect(text).toContain('Space') // ' ' -> Space
  })

  it('should use fallback subcategory titles', () => {
    render(ShortcutsList, {
      props: {
        subcategories: {
          unknown: [mockCommands[0]]
        }
      }
    })

    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})
