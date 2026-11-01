import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import { useInputGroupStore } from '@/stores/inputGroupStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import InputGroupAccordion from './InputGroupAccordion.vue'

vi.mock(import('@/scripts/app'))

function renderGroup(name?: string) {
  const workflow = createMockLoadedWorkflow({ activeMode: 'builder:arrange' })
  useWorkflowStore().activeWorkflow = workflow
  const node = new LGraphNode('Source')
  const seed = node.addWidget('number', 'seed', 1, () => {})
  const steps = node.addWidget('number', 'steps', 20, () => {})
  app.rootGraph.add(node)
  assert.exists(seed.widgetId)
  assert.exists(steps.widgetId)
  useAppModeStore().selectedInputs = [
    [seed.widgetId, seed.name],
    [steps.widgetId, steps.name]
  ]
  const store = useInputGroupStore()
  const groupId = store.createGroup(name, seed.widgetId)
  const group = store.findGroup(groupId)
  assert.exists(group)
  render(InputGroupAccordion, {
    props: { group, builderMode: true },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: { g: { rename: 'Rename', more: 'More' } } }
        })
      ],
      stubs: {
        InputGroupContent: {
          props: ['groupId'],
          template:
            '<div data-testid="group-content" :data-group-id="groupId" />'
        }
      }
    }
  })
  return { group, store, stepsId: steps.widgetId, workflow }
}

describe('input group rename', () => {
  it('passes its group ID to the nested drop-target content', () => {
    const { group } = renderGroup('Sampling')
    expect(screen.getByTestId('group-content')).toHaveAttribute(
      'data-group-id',
      group.id
    )
  })

  it('keeps an unchanged generated name dynamic without recording an undo entry', async () => {
    const { group, store, stepsId, workflow } = renderGroup()
    const captures = vi.mocked(workflow.changeTracker.captureCanvasState).mock
      .calls.length
    const user = userEvent.setup()

    await user.dblClick(screen.getByText('seed'))
    await user.keyboard('{Enter}')

    expect(group.name).toBeNull()
    expect(workflow.changeTracker.captureCanvasState).toHaveBeenCalledTimes(
      captures
    )
    store.addItemToGroup(group.id, stepsId)
    expect(
      await screen.findByRole('button', { name: 'seed, steps' })
    ).toBeInTheDocument()
  })

  it.for([
    { value: '  Sampling  ', expected: 'Sampling', label: 'Sampling' },
    { value: '   ', expected: null, label: 'seed' }
  ])('applies a rename to $expected', async ({ value, expected, label }) => {
    const { group } = renderGroup('Original')
    const user = userEvent.setup()

    await user.dblClick(screen.getByText('Original'))
    const input = screen.getByRole('textbox', { name: 'Rename' })
    await user.clear(input)
    await user.type(input, value)
    await user.keyboard('{Enter}')

    expect(group.name).toBe(expected)
    expect(
      await screen.findByRole('button', { name: label })
    ).toBeInTheDocument()
  })
})
