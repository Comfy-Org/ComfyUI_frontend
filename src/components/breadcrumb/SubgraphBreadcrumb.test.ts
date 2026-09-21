import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import SubgraphBreadcrumb from './SubgraphBreadcrumb.vue'

vi.mock<unknown>(import('@/composables/element/useOverflowObserver'), () => ({
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
      plugins: [
        i18n,
        createRouter({ history: createMemoryHistory(), routes: [] })
      ],
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
    useCanvasStore().linearMode = false
  })

  it('renders the workflow actions dropdown when not in linear mode', () => {
    renderBreadcrumb()
    expect(screen.getByTestId('wad')).toBeInTheDocument()
  })

  it('hides the workflow actions dropdown in linear mode', () => {
    useCanvasStore().linearMode = true
    renderBreadcrumb()
    expect(screen.queryByTestId('wad')).not.toBeInTheDocument()
  })
})
