import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import type {
  WorkflowMenuAction,
  WorkflowMenuItem
} from '@/types/workflowMenuItem'

const MenuItemStub = {
  template:
    '<div data-testid="menu-item" @click="$emit(\'select\')"><slot /></div>',
  emits: ['select']
}

const SeparatorStub = {
  template: '<hr data-testid="menu-separator" />'
}

function renderList(items: WorkflowMenuItem[]) {
  return render(WorkflowActionsList, {
    props: {
      items,
      itemComponent: MenuItemStub,
      separatorComponent: SeparatorStub
    }
  })
}

describe('WorkflowActionsList', () => {
  it('renders action items with label and icon', () => {
    const items: WorkflowMenuItem[] = [
      { id: 'save', label: 'Save', icon: 'pi pi-save', command: vi.fn() }
    ]

    const { container } = renderList(items)

    screen.getByText('Save')
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('.pi-save')).not.toBeNull()
  })

  it('renders separator items', () => {
    const items: WorkflowMenuItem[] = [
      { id: 'before', label: 'Before', icon: 'pi pi-a', command: vi.fn() },
      { separator: true },
      { id: 'after', label: 'After', icon: 'pi pi-b', command: vi.fn() }
    ]

    renderList(items)

    screen.getByTestId('menu-separator')
    screen.getByText('Before')
    screen.getByText('After')
  })

  it('dispatches command on select', async () => {
    const user = userEvent.setup()
    const command = vi.fn()
    const items: WorkflowMenuItem[] = [
      { id: 'action', label: 'Action', icon: 'pi pi-play', command }
    ]

    renderList(items)

    await user.click(screen.getByTestId('menu-item'))
    expect(command).toHaveBeenCalledOnce()
  })

  it('renders badge when present', () => {
    const items: WorkflowMenuItem[] = [
      {
        id: 'new-feature',
        label: 'New Feature',
        icon: 'pi pi-star',
        command: vi.fn(),
        badge: 'NEW'
      }
    ]

    renderList(items)

    screen.getByText('NEW')
  })

  it('does not render items with visible set to false', () => {
    const items: WorkflowMenuItem[] = [
      {
        id: 'hidden',
        label: 'Hidden Item',
        icon: 'pi pi-eye-slash',
        command: vi.fn(),
        visible: false
      },
      { id: 'shown', label: 'Shown Item', icon: 'pi pi-eye', command: vi.fn() }
    ]

    const { container } = renderList(items)

    expect(container.textContent).not.toContain('Hidden Item')
    screen.getByText('Shown Item')
  })

  it('does not render badge when absent', () => {
    const items: WorkflowMenuAction[] = [
      { id: 'plain', label: 'Plain', icon: 'pi pi-check', command: vi.fn() }
    ]

    const { container } = renderList(items)

    expect(container.textContent).not.toContain('NEW')
  })
})
