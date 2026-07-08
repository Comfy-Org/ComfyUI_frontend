import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useErrorResolutionStore } from '@/stores/workspace/errorResolutionStore'
import { fromAny } from '@total-typescript/shoehorn'

import ErrorResolutionOverlay from './ErrorResolutionOverlay.vue'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

// The real store initializes the auth chain, which cannot run in tests
const workspaceMock = vi.hoisted(() => ({ focusMode: false }))
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => workspaceMock
}))

vi.mock('@/components/errorResolution/ErrorResolutionPanel.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    // Without this the async loader mounts the module namespace itself
    // instead of unwrapping the default export
    __esModule: true,
    default: defineComponent({
      render: () => h('section', { 'data-testid': 'error-resolution-panel' })
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      errorResolution: {
        backToApp: 'Back to App Mode'
      }
    }
  }
})

function renderOverlay() {
  const user = userEvent.setup()
  const result = render(ErrorResolutionOverlay, {
    global: {
      plugins: [
        i18n,
        createTestingPinia({ createSpy: vi.fn, stubActions: false })
      ]
    }
  })
  const workflowStore = useWorkflowStore()
  workflowStore.activeWorkflow = fromAny({ activeMode: 'graph' })
  return { user, workflowStore, ...result }
}

describe('ErrorResolutionOverlay.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceMock.focusMode = false
  })

  it('renders nothing while the view is inactive', () => {
    renderOverlay()

    expect(
      screen.queryByTestId('error-resolution-panel')
    ).not.toBeInTheDocument()
  })

  it('shows the back button and panel while active in graph mode', async () => {
    renderOverlay()
    useErrorResolutionStore().enter()

    expect(
      await screen.findByTestId('error-resolution-panel')
    ).toBeInTheDocument()
    expect(screen.getByTestId('error-resolution-back')).toBeInTheDocument()
  })

  it('stays hidden while the workflow is in app mode', async () => {
    const { workflowStore } = renderOverlay()
    useErrorResolutionStore().enter()
    workflowStore.activeWorkflow = fromAny({ activeMode: 'app' })

    await waitFor(() => {
      expect(
        screen.queryByTestId('error-resolution-panel')
      ).not.toBeInTheDocument()
    })
  })

  it('returns to app mode via the back button', async () => {
    const { user } = renderOverlay()
    const errorResolutionStore = useErrorResolutionStore()
    workspaceMock.focusMode = true
    errorResolutionStore.enter()

    await user.click(await screen.findByTestId('error-resolution-back'))

    expect(errorResolutionStore.isActive).toBe(false)
    expect(workspaceMock.focusMode).toBe(false)
    expect(useCanvasStore().linearMode).toBe(true)
  })
})
