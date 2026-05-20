import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => ({
    Validation: { validateInstallation: vi.fn() }
  }))
}))

vi.mock('@/constants/desktopMaintenanceTasks', () => ({
  DESKTOP_MAINTENANCE_TASKS: []
}))

vi.mock('@/utils/refUtil', () => ({
  useMinLoadingDurationRef: (source: { value: boolean }) => source
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

const mockGetRunner = vi.fn()
vi.mock('@/stores/maintenanceTaskStore', () => ({
  useMaintenanceTaskStore: vi.fn(() => ({
    getRunner: mockGetRunner
  }))
}))

import type { MaintenanceTask } from '@/types/desktop/maintenanceTypes'
import TaskListItem from '@/components/maintenance/TaskListItem.vue'

const baseTask: MaintenanceTask = {
  id: 'testTask',
  name: 'Test Task',
  button: { text: 'Fix', icon: 'pi pi-check' },
  execute: vi.fn().mockResolvedValue(true)
}

const ButtonStub = {
  props: ['severity', 'label', 'icon', 'loading'],
  template:
    '<button :data-severity="severity" :data-label="label" :data-testid="label ? \'action-button\' : \'icon-button\'" />'
}

function renderItem(state: 'OK' | 'error' | 'warning' | 'skipped') {
  mockGetRunner.mockReturnValue({
    state,
    executing: false,
    refreshing: false,
    resolved: false
  })

  return render(TaskListItem, {
    props: { task: baseTask },
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      stubs: {
        Button: ButtonStub,
        Popover: { template: '<div />' },
        TaskListStatusIcon: { template: '<span />' }
      }
    }
  })
}

function renderItemWithRunner(
  state: 'OK' | 'error' | 'warning' | 'skipped',
  runnerOverrides: Record<string, unknown> = {}
) {
  mockGetRunner.mockReturnValue({
    state,
    executing: false,
    refreshing: false,
    resolved: false,
    ...runnerOverrides
  })

  return render(TaskListItem, {
    props: { task: baseTask },
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      stubs: {
        Button: ButtonStub,
        Popover: { template: '<div />' },
        TaskListStatusIcon: { template: '<span />' }
      }
    }
  })
}

describe('TaskListItem', () => {
  describe('severity computed', () => {
    it('uses primary severity for error state', () => {
      renderItem('error')
      expect(screen.getByTestId('action-button').dataset.severity).toBe(
        'primary'
      )
    })

    it('uses primary severity for warning state', () => {
      renderItem('warning')
      expect(screen.getByTestId('action-button').dataset.severity).toBe(
        'primary'
      )
    })

    it('uses secondary severity for OK state', () => {
      renderItem('OK')
      expect(screen.getByTestId('action-button').dataset.severity).toBe(
        'secondary'
      )
    })

    it('uses secondary severity for skipped state', () => {
      renderItem('skipped')
      expect(screen.getByTestId('action-button').dataset.severity).toBe(
        'secondary'
      )
    })
  })

  describe('rendering', () => {
    it('displays the task name', () => {
      renderItem('OK')
      expect(screen.getByText('Test Task')).toBeTruthy()
    })

    it('passes the action button label from task.button.text', () => {
      renderItem('OK')
      const actionBtn = screen.getByTestId('action-button')
      expect(actionBtn.dataset.label).toBe('Fix')
    })
  })

  describe('opacity class bindings', () => {
    it('applies opacity-50 class when runner.resolved is true', () => {
      const { container } = renderItemWithRunner('OK', { resolved: true })
      const row = container.querySelector('tr')
      expect(row?.classList.contains('opacity-50')).toBe(true)
    })

    it('does not apply opacity-50 class when runner.resolved is false', () => {
      const { container } = renderItemWithRunner('OK', { resolved: false })
      const row = container.querySelector('tr')
      expect(row?.classList.contains('opacity-50')).toBe(false)
    })

    it('applies opacity-75 class when isLoading is true and runner.resolved is true', () => {
      // useMinLoadingDurationRef is mocked to pass through the source ref value,
      // so refreshing: true makes isLoading truthy
      const { container } = renderItemWithRunner('OK', {
        resolved: true,
        refreshing: true
      })
      const row = container.querySelector('tr')
      expect(row?.classList.contains('opacity-75')).toBe(true)
    })

    it('does not apply opacity-75 class when resolved is false even if loading', () => {
      const { container } = renderItemWithRunner('OK', {
        resolved: false,
        refreshing: true
      })
      const row = container.querySelector('tr')
      expect(row?.classList.contains('opacity-75')).toBe(false)
    })

    it('does not apply opacity-75 class when isLoading is false even if resolved', () => {
      const { container } = renderItemWithRunner('OK', {
        resolved: true,
        refreshing: false
      })
      const row = container.querySelector('tr')
      // opacity-75 requires both isLoading AND resolved
      expect(row?.classList.contains('opacity-75')).toBe(false)
    })
  })
})
