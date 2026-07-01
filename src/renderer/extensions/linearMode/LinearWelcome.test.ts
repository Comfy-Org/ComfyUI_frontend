import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LinearWelcome from './LinearWelcome.vue'

const { hasNodes, hasOutputs, enterBuilder, isBuilderMode, canvasState } =
  vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ref } = require('vue')
    return {
      hasNodes: ref(false),
      hasOutputs: ref(false),
      enterBuilder: vi.fn(),
      isBuilderMode: ref(false),
      canvasState: { apiMode: false, builderEnteredFromApi: false }
    }
  })

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({ setMode: vi.fn(), isBuilderMode })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasState
}))

vi.mock('@/composables/useWorkflowTemplateSelectorDialog', () => ({
  useWorkflowTemplateSelectorDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    hasNodes,
    hasOutputs,
    enterBuilder
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false })

function renderComponent(
  opts: { hasNodes?: boolean; hasOutputs?: boolean } = {}
) {
  hasNodes.value = opts.hasNodes ?? false
  hasOutputs.value = opts.hasOutputs ?? false
  return render(LinearWelcome, {
    global: { plugins: [i18n] }
  })
}

describe('LinearWelcome', () => {
  beforeEach(() => {
    hasNodes.value = false
    hasOutputs.value = false
    isBuilderMode.value = false
    canvasState.apiMode = false
    canvasState.builderEnteredFromApi = false
    vi.clearAllMocks()
  })

  it('shows empty workflow text when there are no nodes', () => {
    renderComponent({ hasNodes: false })
    expect(
      screen.getByTestId('linear-welcome-empty-workflow')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('linear-welcome-build-app')
    ).not.toBeInTheDocument()
  })

  it('shows build app button when there are nodes but no outputs', () => {
    renderComponent({ hasNodes: true, hasOutputs: false })
    expect(
      screen.queryByTestId('linear-welcome-empty-workflow')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('linear-welcome-build-app')).toBeInTheDocument()
  })

  it('clicking build app button calls enterBuilder', async () => {
    const user = userEvent.setup()
    renderComponent({ hasNodes: true, hasOutputs: false })
    await user.click(screen.getByTestId('linear-welcome-build-app'))
    expect(enterBuilder).toHaveBeenCalled()
  })

  // The test i18n has no messages loaded, so t() returns the key path.
  it('shows the app welcome text by default', () => {
    renderComponent()
    expect(screen.getByText('linearMode.welcome.message')).toBeInTheDocument()
    expect(
      screen.queryByText('linearMode.welcome.apiMessage')
    ).not.toBeInTheDocument()
  })

  it('shows the API welcome text in API mode', () => {
    canvasState.apiMode = true
    renderComponent()
    expect(
      screen.getByText('linearMode.welcome.apiMessage')
    ).toBeInTheDocument()
    expect(
      screen.getByText('linearMode.welcome.apiSharing')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('linearMode.welcome.message')
    ).not.toBeInTheDocument()
  })

  it('shows the API welcome text in an API builder session', () => {
    isBuilderMode.value = true
    canvasState.builderEnteredFromApi = true
    renderComponent()
    expect(
      screen.getByText('linearMode.welcome.apiMessage')
    ).toBeInTheDocument()
  })
})
