import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyCommandImpl } from '@/stores/commandStore'

// Mock ShortcutsList component
vi.mock('@/components/bottomPanel/tabs/shortcuts/ShortcutsList.vue', () => ({
  default: {
    name: 'ShortcutsList',
    props: ['commands', 'subcategories', 'columns'],
    template:
      '<div data-testid="shortcuts-list">{{ JSON.stringify(subcategories) }}</div>'
  }
}))

// Mock command store
const mockCommands: ComfyCommandImpl[] = [
  {
    id: 'Workflow.New',
    label: 'New Workflow',
    category: 'essentials'
  } as ComfyCommandImpl,
  {
    id: 'Node.Add',
    label: 'Add Node',
    category: 'essentials'
  } as ComfyCommandImpl,
  {
    id: 'Queue.Clear',
    label: 'Clear Queue',
    category: 'essentials'
  } as ComfyCommandImpl,
  {
    id: 'Other.Command',
    label: 'Other Command',
    category: 'view-controls',
    function: vi.fn(),
    icon: 'pi pi-test',
    tooltip: 'Test tooltip',
    menubarLabel: 'Other Command',
    keybinding: null
  } as ComfyCommandImpl
]

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    commands: mockCommands
  })
}))

describe('EssentialsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render ShortcutsList with essentials commands', async () => {
    const { default: EssentialsPanel } =
      await import('@/components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue')
    render(EssentialsPanel)

    expect(screen.getByTestId('shortcuts-list')).toBeTruthy()
  })

  it('should categorize commands into subcategories', async () => {
    const { default: EssentialsPanel } =
      await import('@/components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue')
    render(EssentialsPanel)

    const el = screen.getByTestId('shortcuts-list')
    const subcategories = JSON.parse(el.textContent ?? '{}')

    expect(subcategories).toHaveProperty('workflow')
    expect(subcategories).toHaveProperty('node')
    expect(subcategories).toHaveProperty('queue')

    expect(subcategories.workflow).toContainEqual(
      expect.objectContaining({ id: 'Workflow.New' })
    )
    expect(subcategories.node).toContainEqual(
      expect.objectContaining({ id: 'Node.Add' })
    )
    expect(subcategories.queue).toContainEqual(
      expect.objectContaining({ id: 'Queue.Clear' })
    )
  })
})
