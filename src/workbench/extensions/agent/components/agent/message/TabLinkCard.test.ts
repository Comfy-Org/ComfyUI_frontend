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
}

const mocks = vi.hoisted(() => ({
  openWorkflow: vi.fn(),
  openWorkflows: [] as unknown[]
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({ openWorkflow: mocks.openWorkflow })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get openWorkflows() {
      return mocks.openWorkflows
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

  it('renders no link when the workflow has no open tab to point at', () => {
    mount('wf-unbound', 'Never opened')

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
