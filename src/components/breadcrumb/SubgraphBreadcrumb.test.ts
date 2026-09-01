import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SubgraphBreadcrumb from './SubgraphBreadcrumb.vue'

const canvasState = vi.hoisted(() => ({ linearMode: false }))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ activeWorkflow: { filename: 'workflow.json' } })
}))

vi.mock('@/stores/subgraphNavigationStore', () => ({
  useSubgraphNavigationStore: () => ({ navigationStack: [] })
}))

vi.mock('@/stores/subgraphStore', () => ({
  useSubgraphStore: () => ({ isSubgraphBlueprint: () => false })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ linearMode: canvasState.linearMode })
}))

vi.mock('@/composables/element/useOverflowObserver', () => ({
  useOverflowObserver: () => ({
    dispose: vi.fn(),
    checkOverflow: vi.fn(),
    disposed: { value: false }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { graphNavigation: 'Graph navigation' } }
  }
})

function renderBreadcrumb() {
  return render(SubgraphBreadcrumb, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: {
        WorkflowActionsDropdown: { template: '<div data-testid="wad" />' },
        Breadcrumb: true,
        Button: true,
        SubgraphBreadcrumbItem: true
      }
    }
  })
}

describe('SubgraphBreadcrumb', () => {
  beforeEach(() => {
    canvasState.linearMode = false
  })

  it('renders the workflow actions dropdown when not in linear mode', () => {
    renderBreadcrumb()
    expect(screen.getByTestId('wad')).toBeInTheDocument()
  })

  it('hides the workflow actions dropdown in linear mode', () => {
    canvasState.linearMode = true
    renderBreadcrumb()
    expect(screen.queryByTestId('wad')).not.toBeInTheDocument()
  })
})
