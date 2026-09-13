// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import TabLinkCard from './TabLinkCard.vue'
import { AgentTargetNavigationError } from '../../../services/agent/targetAwareAgentNavigation'

vi.hoisted(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

const mocks = vi.hoisted(() => ({
  api: new EventTarget(),
  openWorkflow: vi.fn(),
  navigate: vi.fn(),
  reportError: vi.fn()
}))

vi.mock(import('../../../composables/agent/useAgentTargetNavigation'), () => ({
  useAgentTargetNavigation: () => ({ navigate: mocks.navigate })
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({ api: mocks.api }))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => ({ openWorkflow: mocks.openWorkflow })
  })
)

const { useAgentWorkflowTabBindingStore } =
  await import('../../../stores/agent/agentWorkflowTabBindingStore')
const { useAgentPanelStore } =
  await import('../../../stores/agent/agentPanelStore')

function mount(workflowId: string, name?: string) {
  return render(TabLinkCard, {
    props: { workflowId, name },
    global: { plugins: [i18n] }
  })
}

function openTabs(...tabs: LoadedComfyWorkflow[]): void {
  for (const tab of tabs) {
    useWorkflowStore().attachWorkflow(
      tab,
      useWorkflowStore().openWorkflows.length
    )
  }
}

describe('TabLinkCard', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.openWorkflow.mockClear()
    mocks.navigate.mockClear()
    mocks.reportError.mockClear()
    openTabs()
    useAgentPanelStore().enabled = true
  })

  it('T-14 / PM-676 / FE-1310 renders the backend tab name and focuses its workflow on click', async () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait'
    })
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    mount('wf-1', 'Portrait upscale')
    const link = screen.getByRole('button')
    expect(link).toHaveAccessibleName('Open Portrait upscale')

    await userEvent.click(link)

    expect(mocks.openWorkflow).toHaveBeenCalledWith(tab)
  })

  it('falls back to the local tab name when no backend name is present', () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait'
    })
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    mount('wf-1')

    expect(screen.getByRole('button')).toHaveAccessibleName('Open portrait')
  })

  it('renders one action with media, title and node-count content, then navigation affordance', () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}, {}] }
    })
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    mount('wf-1', 'Portrait upscale')

    const content = screen.getByTestId('workflow-link-content')
    expect(screen.getByTestId('workflow-link-media')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(within(content).getByText('Portrait upscale')).toBeVisible()
    expect(within(content).getByText('2 nodes')).toBeVisible()
    expect(screen.getByTestId('workflow-link-navigation')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('keeps the active workflow node count current and accessible', async () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}] }
    })
    openTabs(tab)
    useWorkflowStore().activeWorkflow = tab
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    mount('wf-1')
    const link = screen.getByRole('button')
    expect(link).toHaveAccessibleDescription('1 node')

    mocks.api.dispatchEvent(
      new CustomEvent('graphChanged', { detail: { nodes: [{}, {}] } })
    )

    expect(await screen.findByText('2 nodes')).toBeInTheDocument()
    expect(link).toHaveAccessibleDescription('2 nodes')
  })

  it('ignores graph changes while the linked workflow is inactive', async () => {
    const linkedTab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}] }
    })
    const activeTab = createMockLoadedWorkflow({
      path: 'flows/landscape.json',
      filename: 'landscape',
      activeState: { nodes: [{}, {}] }
    })
    openTabs(linkedTab, activeTab)
    useWorkflowStore().activeWorkflow = activeTab
    useAgentWorkflowTabBindingStore().bind('wf-1', linkedTab.path)

    mount('wf-1')
    const link = screen.getByRole('button')
    mocks.api.dispatchEvent(
      new CustomEvent('graphChanged', { detail: { nodes: [{}, {}, {}] } })
    )

    await vi.waitFor(() => expect(link).toHaveAccessibleDescription('1 node'))
    expect(screen.queryByText('3 nodes')).not.toBeInTheDocument()
  })

  it('removes its graph listener when unmounted', () => {
    const removeListener = vi.spyOn(mocks.api, 'removeEventListener')
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}] }
    })
    openTabs(tab)
    useWorkflowStore().activeWorkflow = tab
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    const view = mount('wf-1')
    view.unmount()

    expect(
      removeListener.mock.calls.some(([type]) => type === 'graphChanged')
    ).toBe(true)
    removeListener.mockRestore()
  })

  it('renders no link when the workflow has no open tab to point at', () => {
    mount('wf-unbound', 'Never opened')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders no reference and performs no action while the flag is off', () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait'
    })
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)
    useAgentPanelStore().enabled = false

    mount('wf-1', 'Portrait upscale')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mocks.openWorkflow).not.toHaveBeenCalled()
  })

  it('navigates an explicit node reference through its target workflow', async () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait'
    })
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    render(TabLinkCard, {
      props: {
        workflowId: 'wf-1',
        locatorId: 'root-a:42',
        name: 'Portrait upscale'
      },
      global: { plugins: [i18n] }
    })
    await userEvent.click(screen.getByRole('button'))

    expect(mocks.navigate).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      locatorId: 'root-a:42'
    })
    expect(mocks.openWorkflow).not.toHaveBeenCalled()
  })

  it('shows recovery feedback when a node target is no longer available', async () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait'
    })
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)
    mocks.navigate.mockRejectedValueOnce(
      new AgentTargetNavigationError('missing_node', 'wf-1', '42')
    )

    render(TabLinkCard, {
      props: { workflowId: 'wf-1', locatorId: '42' },
      global: { plugins: [i18n] }
    })
    await userEvent.click(screen.getByRole('button'))

    expect(useToastStore().messagesToAdd).toContainEqual({
      severity: 'warn',
      detail: 'This workflow target is no longer available.',
      life: 5000
    })
    expect(mocks.reportError).not.toHaveBeenCalled()
  })

  it('reports unexpected navigation failures', async () => {
    const tab = createMockLoadedWorkflow({
      path: 'flows/portrait.json',
      filename: 'portrait'
    })
    const error = new Error('focus failed')
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)
    mocks.navigate.mockRejectedValueOnce(error)

    render(TabLinkCard, {
      props: { workflowId: 'wf-1', locatorId: '42' },
      global: { plugins: [i18n] }
    })
    await userEvent.click(screen.getByRole('button'))

    expect(mocks.reportError).toHaveBeenCalledWith(error, {
      errorType: 'agent_target_navigation_failure'
    })
  })
})
