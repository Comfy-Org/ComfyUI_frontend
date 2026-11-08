import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import type { WorkflowReferenceOption } from '@/workbench/extensions/agent/types/workflowReference'

import ComposerAddMenu from './ComposerAddMenu.vue'

const workflows: WorkflowReferenceOption[] = [
  { id: 'wf-1', name: 'Portrait upscale' },
  { name: 'Unsaved Workflow', tabPath: 'workflows/Unsaved Workflow.json' }
]

function mount(props: Partial<ComponentProps<typeof ComposerAddMenu>> = {}) {
  const selectWorkflow = vi.fn(async () => true)
  const view = render(ComposerAddMenu, {
    props: {
      canAttach: false,
      canOpenAssets: false,
      workflows: [],
      workflowSelecting: false,
      selectWorkflow,
      ...props
    },
    global: { plugins: [i18n] }
  })
  return { ...view, selectWorkflow }
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
  return screen.getByRole('menu')
}

function entryLabels(menu: HTMLElement): string[] {
  return within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent.trim())
}

describe('ComposerAddMenu', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  it.for([
    {
      layout: 'classic',
      expected: [
        'Drag in asset from asset panel',
        'Nodes',
        'Workflows',
        'Upload images or files'
      ]
    },
    {
      layout: 'redesign',
      expected: [
        'Upload images or files',
        'Add from outputs',
        'Workflows',
        'Nodes'
      ]
    }
  ] as const)(
    'orders the entries for the $layout layout',
    async ({ layout, expected }) => {
      mount({ canAttach: true, canOpenAssets: true, layout })
      const menu = await openMenu()

      expect(entryLabels(menu)).toEqual(expected)
      expect(within(menu).getAllByRole('separator')).toHaveLength(1)
    }
  )

  it('separates upload from the references in the redesign even without assets', async () => {
    mount({ canAttach: true, layout: 'redesign' })
    const menu = await openMenu()

    expect(entryLabels(menu)).toEqual([
      'Upload images or files',
      'Workflows',
      'Nodes'
    ])
    expect(within(menu).getAllByRole('separator')).toHaveLength(1)
  })

  it.for([
    { name: 'Add from outputs', event: 'openAssets' },
    { name: 'Upload images or files', event: 'attach' },
    { name: 'Nodes', event: 'selectNodes' }
  ])(
    'emits $event when "$name" is chosen in the redesign',
    async ({ name, event }) => {
      const view = mount({
        canAttach: true,
        canOpenAssets: true,
        layout: 'redesign'
      })
      await openMenu()

      await userEvent.click(screen.getByRole('menuitem', { name }))

      expect(view.emitted()[event]).toHaveLength(1)
    }
  )

  it('picks a workflow from the submenu in the redesign', async () => {
    const view = mount({ workflows, layout: 'redesign' })
    await openMenu()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    expect(view.emitted().requestWorkflowReferences).toHaveLength(1)

    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Portrait upscale' })
    )
    expect(view.selectWorkflow).toHaveBeenCalledWith(workflows[0])
  })
})
