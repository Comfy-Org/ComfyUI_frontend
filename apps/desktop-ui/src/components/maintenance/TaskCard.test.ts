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

const mockGetRunner = vi.fn()
vi.mock('@/stores/maintenanceTaskStore', () => ({
  useMaintenanceTaskStore: vi.fn(() => ({
    getRunner: mockGetRunner
  }))
}))

import type { MaintenanceTask } from '@/types/desktop/maintenanceTypes'
import TaskCard from '@/components/maintenance/TaskCard.vue'

const baseTask: MaintenanceTask = {
  id: 'testTask',
  name: 'Test Task',
  shortDescription: 'Short description',
  errorDescription: 'Error occurred',
  execute: vi.fn().mockResolvedValue(true)
}

const cardStubs = {
  Card: {
    template: '<div data-testid="card"><slot name="content"></slot></div>'
  },
  Button: { template: '<button />' }
}

function renderCard(
  state: 'OK' | 'error' | 'warning' | 'skipped',
  task: MaintenanceTask = baseTask
) {
  mockGetRunner.mockReturnValue({
    state,
    executing: false,
    refreshing: false,
    resolved: false
  })

  return render(TaskCard, {
    props: { task },
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      stubs: cardStubs
    }
  })
}

describe('TaskCard', () => {
  describe('description computed', () => {
    it('shows errorDescription when task state is error', () => {
      renderCard('error')
      expect(screen.getByText('Error occurred')).toBeDefined()
    })

    it('shows shortDescription when task state is OK', () => {
      renderCard('OK')
      expect(screen.getByText('Short description')).toBeDefined()
    })

    it('shows shortDescription when task state is warning', () => {
      renderCard('warning')
      expect(screen.getByText('Short description')).toBeDefined()
    })

    it('falls back to shortDescription when errorDescription is absent and state is error', () => {
      const taskWithoutErrorDesc: MaintenanceTask = {
        ...baseTask,
        errorDescription: undefined
      }
      renderCard('error', taskWithoutErrorDesc)
      expect(screen.getByText('Short description')).toBeDefined()
    })
  })
})
