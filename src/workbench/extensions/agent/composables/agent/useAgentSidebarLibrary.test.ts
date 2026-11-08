import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useAgentSidebarLibrary } from './useAgentSidebarLibrary'

const showTemplates = vi.hoisted(() => vi.fn())

vi.mock(
  import('@/platform/workflow/templates/composables/useWorkflowTemplateSelectorDialog'),
  () => ({
    useWorkflowTemplateSelectorDialog: () => ({
      show: showTemplates,
      hide: vi.fn()
    })
  })
)
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

function saveWorkflow(path: string, modified: number): ComfyWorkflow {
  const workflow = new ComfyWorkflow({ path, modified, size: 1 })
  useWorkflowStore().attachWorkflow(workflow)
  return workflow
}

function useFullscreenPanel() {
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.experience = 'redesign'
  panel.open()
  panel.toggleMaximize()
  return panel
}

function deferredOpen(): (opened: boolean) => void {
  let resolve: (opened: boolean) => void = () => {}
  vi.mocked(useWorkflowService()).openWorkflow.mockReturnValueOnce(
    new Promise<boolean>((settle) => {
      resolve = settle
    })
  )
  return (opened) => resolve(opened)
}

describe('useAgentSidebarLibrary', () => {
  beforeEach(() => {
    localStorage.clear()
    window.innerWidth = 1920
    window.dispatchEvent(new Event('resize'))
    vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue(undefined)
    saveWorkflow('workflows/Portrait upscale.json', 20)
    saveWorkflow('workflows/video/ads/Product ad.app.json', 40)
    saveWorkflow('workflows/Character sheet.app.json', 30)
    saveWorkflow('workflows/video/Seedance clip.json', 10)
    saveWorkflow('subgraphs/Shared blur.json', 50)
    useWorkflowStore().createTemporary('Unsaved Workflow.json')
  })

  it('lists nothing while the chats are showing', () => {
    useFullscreenPanel()

    expect(useAgentSidebarLibrary().items.value).toEqual([])
  })

  it('lists every saved workflow, newest first, with its folder', () => {
    useFullscreenPanel()
    const library = useAgentSidebarLibrary()

    library.showSection('workflows')

    expect(library.items.value).toEqual([
      {
        path: 'workflows/video/ads/Product ad.app.json',
        name: 'Product ad',
        folder: 'video/ads'
      },
      { path: 'workflows/Character sheet.app.json', name: 'Character sheet' },
      { path: 'workflows/Portrait upscale.json', name: 'Portrait upscale' },
      {
        path: 'workflows/video/Seedance clip.json',
        name: 'Seedance clip',
        folder: 'video'
      }
    ])
  })

  it('lists only the apps in the apps section', () => {
    useFullscreenPanel()
    const library = useAgentSidebarLibrary()

    library.showSection('apps')

    expect(library.items.value.map(({ name }) => name)).toEqual([
      'Product ad',
      'Character sheet'
    ])
  })

  it.for([
    { section: 'apps', syncs: 1 },
    { section: 'workflows', syncs: 1 },
    { section: 'chats', syncs: 0 }
  ] as const)(
    'syncs the workflows $syncs time(s) on entering $section',
    ({ section, syncs }) => {
      const panel = useFullscreenPanel()
      const library = useAgentSidebarLibrary()

      library.showSection(section)
      library.showSection(section)

      expect(panel.sidebarSection).toBe(section)
      expect(useWorkflowStore().syncWorkflows).toHaveBeenCalledTimes(syncs)
    }
  )

  it('syncs the workflows again on refresh', () => {
    useFullscreenPanel()

    useAgentSidebarLibrary().refresh()

    expect(useWorkflowStore().syncWorkflows).toHaveBeenCalledTimes(1)
  })

  it.for([
    { section: 'chats', buttonId: 'agent_sidebar_nav_chats' },
    { section: 'apps', buttonId: 'agent_sidebar_nav_apps' },
    { section: 'workflows', buttonId: 'agent_sidebar_nav_workflows' }
  ] as const)('records the choice of $section', ({ section, buttonId }) => {
    useFullscreenPanel()

    useAgentSidebarLibrary().showSection(section)

    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: buttonId,
      element_group: 'agent_sidebar_nav'
    })
  })

  it('opens the template browser over the chat and records the choice', () => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    library.showSection('apps')
    vi.mocked(useTelemetry()!.trackUiButtonClicked).mockClear()

    library.openTemplates()

    expect(showTemplates).toHaveBeenCalledExactlyOnceWith(
      'agent_sidebar',
      expect.objectContaining({ afterClose: expect.any(Function) })
    )
    expect(panel.isFullscreen).toBe(true)
    expect(panel.sidebarSection).toBe('apps')
    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'agent_sidebar_nav_templates',
      element_group: 'agent_sidebar_nav'
    })
  })

  it.for([
    [
      'stays in full screen when the template browser closes without a pick',
      false
    ],
    ['shows the graph once a template has been picked', true]
  ] as const)('%s', ([, picked]) => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()

    library.openTemplates()
    if (picked)
      useWorkflowStore().activeWorkflow = createMockLoadedWorkflow({
        path: 'workflows/From template.json'
      })
    const options = showTemplates.mock.calls[0]?.[1]
    options?.afterClose?.()

    expect(panel.isFullscreen).toBe(!picked)
  })

  it('closes the sidebar drawer before showing the graph', async () => {
    window.innerWidth = 800
    window.dispatchEvent(new Event('resize'))
    const panel = useFullscreenPanel()
    panel.toggleSidebar()
    expect(panel.sidebarMode).toBe('drawer')
    vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(true)

    await useAgentSidebarLibrary().open('workflows/Portrait upscale.json')

    expect(panel.isFullscreen).toBe(false)
    expect(panel.sidebarMode).toBe('rail')
  })

  it('leaves full screen only once the workflow has opened', async () => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    const resolveOpen = deferredOpen()

    const opening = library.open('workflows/Portrait upscale.json')

    expect(library.openingPath.value).toBe('workflows/Portrait upscale.json')
    expect(panel.isFullscreen).toBe(true)

    resolveOpen(true)
    await opening

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledExactlyOnceWith(
      useWorkflowStore().getWorkflowByPath('workflows/Portrait upscale.json')
    )
    expect(library.openingPath.value).toBeNull()
    expect(library.failedPath.value).toBeNull()
    expect(panel.isFullscreen).toBe(false)
  })

  it('reports a workflow that throws on opening and stays in full screen', async () => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    const failure = new Error('load failed')
    vi.mocked(useWorkflowService()).openWorkflow.mockRejectedValueOnce(failure)

    await library.open('workflows/Portrait upscale.json')

    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      surface: 'agent',
      errorType: 'error_opening_agent_sidebar_workflow'
    })
    expect(library.failedPath.value).toBe('workflows/Portrait upscale.json')
    expect(library.openingPath.value).toBeNull()
    expect(panel.isFullscreen).toBe(true)
  })

  it('stays in full screen when the workflow declines to open', async () => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(false)

    await library.open('workflows/Portrait upscale.json')

    expect(library.failedPath.value).toBe('workflows/Portrait upscale.json')
    expect(panel.isFullscreen).toBe(true)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('marks a workflow that is no longer saved as failed', async () => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()

    await library.open('workflows/Deleted.json')

    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(library.failedPath.value).toBe('workflows/Deleted.json')
    expect(panel.isFullscreen).toBe(true)
  })

  it('ignores a second open while one is in flight', async () => {
    useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    const resolveOpen = deferredOpen()
    const opening = library.open('workflows/Portrait upscale.json')

    await library.open('workflows/video/Seedance clip.json')

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledTimes(1)
    expect(library.openingPath.value).toBe('workflows/Portrait upscale.json')

    resolveOpen(true)
    await opening
  })

  it('lets a failed workflow be opened again', async () => {
    const panel = useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    vi.mocked(useWorkflowService()).openWorkflow.mockRejectedValueOnce(
      new Error('load failed')
    )
    await library.open('workflows/Portrait upscale.json')

    await library.open('workflows/Portrait upscale.json')

    expect(library.failedPath.value).toBeNull()
    expect(panel.isFullscreen).toBe(false)
  })

  it('forgets a failed open when another section is entered', async () => {
    useFullscreenPanel()
    const library = useAgentSidebarLibrary()
    library.showSection('workflows')
    vi.mocked(useWorkflowService()).openWorkflow.mockResolvedValueOnce(false)
    await library.open('workflows/Portrait upscale.json')

    library.showSection('apps')

    expect(library.failedPath.value).toBeNull()
  })
})
