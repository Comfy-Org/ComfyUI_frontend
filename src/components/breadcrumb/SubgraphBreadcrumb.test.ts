import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'

import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useSuperComfyNavigationStore } from '@/platform/superComfy/stores/superComfyNavigationStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

import SubgraphBreadcrumb from './SubgraphBreadcrumb.vue'

vi.mock<unknown>(import('@/composables/element/useOverflowObserver'), () => ({
  useOverflowObserver: () => ({
    dispose: vi.fn(),
    checkOverflow: vi.fn(),
    disposed: { value: false }
  })
}))

const appPath = 'workflows/portrait.app.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { graphNavigation: 'Graph navigation' },
      superComfy: { title: 'SuperComfy' }
    }
  }
})

function drillInThenShow(activePath: string) {
  useSuperComfyNavigationStore().markDrilledInto({
    workflowPath: appPath,
    appNodeId: 'app-node'
  })
  useWorkflowStore().activeWorkflow = fromPartial({
    path: activePath,
    filename: 'portrait'
  })
}

function renderTrail() {
  return render(SubgraphBreadcrumb, {
    global: {
      plugins: [
        i18n,
        createRouter({ history: createMemoryHistory(), routes: [] })
      ],
      stubs: {
        WorkflowActionsDropdown: true
      }
    }
  })
}

async function renderTrailInSubgraph(name: string) {
  renderTrail()
  Object.assign(useSubgraphNavigationStore(), {
    navigationStack: [fromPartial<Subgraph>({ id: 'inner-graph', name })]
  })
  await nextTick()
}

function renderBreadcrumb() {
  return render(SubgraphBreadcrumb, {
    global: {
      plugins: [
        i18n,
        createRouter({ history: createMemoryHistory(), routes: [] })
      ],
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

describe('SubgraphBreadcrumb after drilling into an App node', () => {
  beforeEach(() => {
    useCanvasStore().linearMode = false
  })

  it.for([
    { name: 'the drilled app is active', active: appPath, crumbs: 1 },
    {
      name: 'another workflow is active',
      active: 'workflows/other.json',
      crumbs: 0
    }
  ])('shows the SuperComfy crumb only while $name', ({ active, crumbs }) => {
    drillInThenShow(active)

    renderTrail()

    expect(
      screen.queryAllByRole('button', { name: 'SuperComfy' })
    ).toHaveLength(crumbs)
  })

  it.for([
    {
      name: 'the SuperComfy crumb',
      control: () => screen.getByRole('button', { name: 'SuperComfy' })
    },
    {
      name: 'the back button at the app root',
      control: () => screen.getByTestId('subgraph-breadcrumb-back')
    }
  ])('returns to SuperComfy from $name', async ({ control }) => {
    drillInThenShow(appPath)
    renderTrail()

    await userEvent.click(control())

    const navigation = useSuperComfyNavigationStore()
    expect(navigation.isOpen).toBe(true)
    expect(navigation.parentCrumbVisible).toBe(false)
  })

  it('reads SuperComfy, then the app, then the subgraph', async () => {
    drillInThenShow(appPath)
    await renderTrailInSubgraph('Upscale')

    expect(
      screen.getByRole('navigation', { name: 'Graph navigation' })
    ).toHaveTextContent(/^SuperComfy\s*\/\s*portrait\s*\/\s*Upscale$/)
  })

  it('exits the subgraph from the back button and stays in the app', async () => {
    vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
    drillInThenShow(appPath)
    await renderTrailInSubgraph('Upscale')

    await userEvent.click(screen.getByTestId('subgraph-breadcrumb-back'))

    expect(useCommandStore().execute).toHaveBeenCalledWith(
      'Comfy.Graph.ExitSubgraph'
    )
    expect(useSuperComfyNavigationStore().isOpen).toBe(false)
  })
})
