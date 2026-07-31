// @vitest-environment jsdom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import TabLinkCard from './TabLinkCard.vue'

interface FakeTab {
  path: string
  filename: string
  activeState?: { nodes: unknown[] }
}

const mocks = vi.hoisted(() => ({
  api: new EventTarget(),
  activeWorkflow: undefined as FakeTab | undefined,
  openWorkflow: vi.fn(),
  openWorkflows: [] as unknown[]
}))

vi.mock('@/scripts/api', () => ({ api: mocks.api }))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ openWorkflow: mocks.openWorkflow })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get openWorkflows() {
      return mocks.openWorkflows
    },
    get activeWorkflow() {
      return mocks.activeWorkflow
    }
  })
}))

const { useAgentWorkflowTabBindingStore } =
  await import('../../../stores/agent/agentWorkflowTabBindingStore')

function mount(workflowId: string, name?: string) {
  return render(TabLinkCard, {
    props: { workflowId, name },
    global: { plugins: [i18n] }
  })
}

function openTabs(...tabs: FakeTab[]): void {
  mocks.openWorkflows = tabs
}

describe('TabLinkCard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    mocks.openWorkflow.mockClear()
    mocks.activeWorkflow = undefined
    openTabs()
  })

  it('links the bound tab and focuses it on click', async () => {
    const tab = { path: 'flows/portrait.json', filename: 'portrait' }
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    mount('wf-1', 'stale name from the wire')
    const link = screen.getByRole('button')
    expect(link).toHaveAccessibleName('Open portrait')

    await userEvent.click(link)

    expect(mocks.openWorkflow).toHaveBeenCalledWith(tab)
  })

  it('falls back to the wire name when the tab carries a blank filename', () => {
    const tab = { path: 'flows/portrait.json', filename: '' }
    openTabs(tab)
    useAgentWorkflowTabBindingStore().bind('wf-1', tab.path)

    mount('wf-1', 'Portrait upscale')

    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Open Portrait upscale'
    )
  })

  it('keeps the active workflow node count current and accessible', async () => {
    const tab = {
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}] }
    }
    openTabs(tab)
    mocks.activeWorkflow = tab
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
    const linkedTab = {
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}] }
    }
    const activeTab = {
      path: 'flows/landscape.json',
      filename: 'landscape',
      activeState: { nodes: [{}, {}] }
    }
    openTabs(linkedTab, activeTab)
    mocks.activeWorkflow = activeTab
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
    const tab = {
      path: 'flows/portrait.json',
      filename: 'portrait',
      activeState: { nodes: [{}] }
    }
    openTabs(tab)
    mocks.activeWorkflow = tab
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
})
