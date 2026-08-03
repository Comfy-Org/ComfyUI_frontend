import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

import TaskListStatusIcon from '@/components/maintenance/TaskListStatusIcon.vue'

type TaskState = 'warning' | 'error' | 'resolved' | 'OK' | 'skipped' | undefined

function renderIcon(state: TaskState, loading?: boolean) {
  return render(TaskListStatusIcon, {
    props: { state, loading },
    global: {
      plugins: [[PrimeVue, { unstyled: true }]],
      stubs: {
        ProgressSpinner: {
          template: '<div data-testid="spinner" />'
        }
      }
    }
  })
}

describe('TaskListStatusIcon', () => {
  describe('loading / no state', () => {
    it('renders spinner when state is undefined', () => {
      renderIcon(undefined)
      expect(screen.getByTestId('spinner')).toBeDefined()
    })

    it('renders spinner when loading is true', () => {
      renderIcon('OK', true)
      expect(screen.getByTestId('spinner')).toBeDefined()
    })

    it('hides spinner when state is defined and not loading', () => {
      renderIcon('OK', false)
      expect(screen.queryByTestId('spinner')).toBeNull()
    })
  })
})
