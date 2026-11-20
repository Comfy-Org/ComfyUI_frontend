import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'
import { markRaw } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowOverflowMenu from './WorkflowOverflowMenu.vue'

const openWorkflow = vi.hoisted(() => vi.fn())

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => ({ openWorkflow }) })
)

it('shows and announces the unified status of each overflow workflow', async () => {
  const active = markRaw(
    new ComfyWorkflow({ path: 'workflows/active.json', modified: 0, size: 0 })
  )
  const waiting = markRaw(
    new ComfyWorkflow({ path: 'workflows/waiting.json', modified: 0, size: 0 })
  )
  const finished = markRaw(
    new ComfyWorkflow({ path: 'workflows/finished.json', modified: 0, size: 0 })
  )
  const workflows = useWorkflowStore()
  workflows.attachWorkflow(active, 0)
  workflows.attachWorkflow(waiting, 1)
  workflows.attachWorkflow(finished, 2)
  vi.mocked(useExecutionStore().getWorkflowStatus).mockImplementation((wf) =>
    wf === finished ? 'completed' : undefined
  )
  const activity = useWorkflowTabActivityStore()
  activity.setAgentTurnTabs([
    { path: active.path, awaitingApproval: false },
    { path: waiting.path, awaitingApproval: true }
  ])

  render(WorkflowOverflowMenu, {
    props: { workflows: [active, waiting, finished], activeWorkflow: active },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: {
            en: {
              g: {
                moreWorkflows: 'More workflows',
                agentNeedsApproval: enMessages.g.agentNeedsApproval,
                agentWorking: enMessages.g.agentWorking,
                completed: enMessages.g.completed
              }
            }
          }
        })
      ]
    }
  })

  const user = userEvent.setup({ pointerEventsCheck: 0 })
  await user.click(screen.getByRole('button', { name: 'More workflows' }))
  const activeItem = await screen.findByRole('menuitem', {
    name: `active, ${enMessages.g.agentWorking}`
  })
  expect(
    within(activeItem).getByRole('img', {
      name: enMessages.g.agentWorking
    })
  ).toHaveAttribute('data-status', 'busy')

  const waitingItem = screen.getByRole('menuitem', {
    name: `waiting, ${enMessages.g.agentNeedsApproval}`
  })
  expect(
    within(waitingItem).getByRole('img', {
      name: enMessages.g.agentNeedsApproval
    })
  ).toHaveAttribute('data-status', 'waiting')

  const finishedItem = screen.getByRole('menuitem', {
    name: `finished, ${enMessages.g.completed}`
  })
  expect(
    within(finishedItem).getByRole('img', {
      name: enMessages.g.completed
    })
  ).toHaveAttribute('data-status', 'completed')

  await user.click(waitingItem)
  expect(openWorkflow).toHaveBeenCalledWith(waiting, { initiator: 'user' })
})

it('shows nothing next to an overflow workflow with no active status', async () => {
  const active = markRaw(
    new ComfyWorkflow({ path: 'workflows/active.json', modified: 0, size: 0 })
  )
  const other = markRaw(
    new ComfyWorkflow({ path: 'workflows/other.json', modified: 0, size: 0 })
  )
  const workflows = useWorkflowStore()
  workflows.attachWorkflow(active, 0)
  workflows.attachWorkflow(other, 1)
  vi.mocked(useExecutionStore().getWorkflowStatus).mockReturnValue(undefined)

  render(WorkflowOverflowMenu, {
    props: { workflows: [active, other], activeWorkflow: active },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: { g: { moreWorkflows: 'More workflows' } } }
        })
      ]
    }
  })

  await userEvent
    .setup({ pointerEventsCheck: 0 })
    .click(screen.getByRole('button', { name: 'More workflows' }))

  expect(
    within(await screen.findByRole('menuitem', { name: 'other' })).queryByRole(
      'img'
    )
  ).toBeNull()
})
