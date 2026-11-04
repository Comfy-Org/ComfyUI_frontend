import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAppMode } from '@/composables/useAppMode'
import type {
  LGraph,
  LGraphCanvas,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { consultEscapeOverride } from '@/platform/keybindings/escapeOverride'
import { useSuperComfyNavigationStore } from '@/platform/superComfy/stores/superComfyNavigationStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { drillIntoApp } from '@/renderer/extensions/superComfy/drill/appDrillIn'
import { api } from '@/scripts/api'

vi.mock(import('@/platform/workflow/core/services/workflowService'))

const appPath = 'workflows/portrait.app.json'

function saveApps(fileNames: string[]) {
  vi.spyOn(api, 'listUserDataFullInfo').mockResolvedValue(
    fileNames.map((path) => ({ path, modified: 1000, size: 1 }))
  )
}

function openAppsInAppMode(opens: boolean) {
  vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
    async (workflow) => {
      workflow.initialMode = 'app'
      Object.assign(useWorkflowStore(), { activeWorkflow: workflow })
      return opens
    }
  )
}

function pressEscape(): boolean {
  return consultEscapeOverride(
    new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
  )
}

beforeEach(() => {
  useSuperComfyNavigationStore().open()
})

describe('drillIntoApp', () => {
  it('opens the saved app in graph mode and leaves SuperComfy', async () => {
    saveApps(['portrait.app.json'])
    openAppsInAppMode(true)

    const opened = await drillIntoApp(appPath, 'app-node')

    const navigation = useSuperComfyNavigationStore()
    expect(opened).toBe(true)
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ path: appPath }),
      { initiator: 'user' }
    )
    expect(useAppMode().mode.value).toBe('graph')
    expect(navigation.isOpen).toBe(false)
    expect(navigation.origin).toEqual({
      workflowPath: appPath,
      appNodeId: 'app-node'
    })
  })

  it('starts at the root graph when the app reopens inside a subgraph', async () => {
    saveApps(['portrait.app.json'])
    openAppsInAppMode(true)
    const rootGraph = fromPartial<LGraph>({ id: 'app-root' })
    const canvas = fromPartial<LGraphCanvas>({
      graph: fromPartial<Subgraph>({ rootGraph }),
      setGraph: vi.fn()
    })
    Object.assign(useCanvasStore(), { canvas, isInSubgraph: true })

    await drillIntoApp(appPath, 'app-node')

    expect(canvas.setGraph).toHaveBeenCalledWith(rootGraph)
  })

  it.for([
    {
      name: 'the app file is missing',
      saved: [],
      opens: true,
      toasts: [{ kind: 'error', title: 'App not found' }]
    },
    {
      name: 'the workflow does not open',
      saved: ['portrait.app.json'],
      opens: false,
      toasts: []
    }
  ])('stays in SuperComfy when $name', async ({ saved, opens, toasts }) => {
    saveApps(saved)
    openAppsInAppMode(opens)

    const opened = await drillIntoApp(appPath, 'app-node')

    const navigation = useSuperComfyNavigationStore()
    expect(opened).toBe(false)
    expect(navigation.isOpen).toBe(true)
    expect(navigation.origin).toBeNull()
    expect(
      useToast().toasts.map(({ kind, title }) => ({ kind, title }))
    ).toEqual(toasts)
  })

  it.for([
    {
      name: 'returns to SuperComfy on Escape at the app root',
      inSubgraph: false,
      claimed: true,
      open: true
    },
    {
      name: 'leaves Escape to exit the subgraph inside a subgraph',
      inSubgraph: true,
      claimed: false,
      open: false
    }
  ])('$name', async ({ inSubgraph, claimed, open }) => {
    saveApps(['portrait.app.json'])
    openAppsInAppMode(true)
    await drillIntoApp(appPath, 'app-node')
    useCanvasStore().isInSubgraph = inSubgraph

    const handled = pressEscape()

    expect(handled).toBe(claimed)
    expect(useSuperComfyNavigationStore().isOpen).toBe(open)
  })
})
