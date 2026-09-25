import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { markRaw } from 'vue'
import { createI18n } from 'vue-i18n'

import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import WorkflowOverflowMenu from './WorkflowOverflowMenu.vue'

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => ({ openWorkflow: vi.fn() }) })
)

it('marks the agent target separately from the active overflow workflow', async () => {
  const active = markRaw(
    new ComfyWorkflow({ path: 'workflows/active.json', modified: 0, size: 0 })
  )
  const target = markRaw(
    new ComfyWorkflow({ path: 'workflows/target.json', modified: 0, size: 0 })
  )
  const workflows = useWorkflowStore()
  workflows.attachWorkflow(active, 0)
  workflows.attachWorkflow(target, 1)
  const panel = useAgentPanelStore()
  panel.enabled = true
  panel.setWorkflowTarget(target)

  render(WorkflowOverflowMenu, {
    props: { workflows: [active, target], activeWorkflow: active },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: {
            en: {
              g: { moreWorkflows: 'More workflows' },
              agent: { targetForThisChat: 'Agent target' }
            }
          }
        })
      ]
    }
  })

  const user = userEvent.setup({ pointerEventsCheck: 0 })
  await user.click(screen.getByRole('button', { name: 'More workflows' }))
  const targetItem = await screen.findByRole('menuitem', {
    name: 'target'
  })
  expect(
    within(targetItem).getByRole('img', { name: 'Agent target' })
  ).toBeVisible()
  expect(
    within(screen.getByRole('menuitem', { name: 'active' })).queryByRole('img')
  ).toBeNull()
  await user.hover(
    within(targetItem).getByRole('img', { name: 'Agent target' })
  )
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Agent target')
})
