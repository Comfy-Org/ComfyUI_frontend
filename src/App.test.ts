import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import App from './App.vue'

const mocks = vi.hoisted(() => ({
  workspaceStore: { spinner: true }
}))

vi.mock('@/components/dialog/GlobalDialog.vue', () => ({
  default: { template: '<div />' }
}))
vi.mock('@/platform/distribution/types', () => ({ isDesktop: false }))
vi.mock('@/scripts/app', () => ({ app: {} }))
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => mocks.workspaceStore
}))
vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({
      initializeConflictDetection: vi.fn()
    })
  })
)

describe('App', () => {
  it('exposes the app loading overlay to readiness checks', () => {
    render(App, {
      global: {
        stubs: { RouterView: true }
      }
    })

    expect(screen.getByTestId('app-loading-overlay')).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })
})
