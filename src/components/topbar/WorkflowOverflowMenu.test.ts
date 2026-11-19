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
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'

import WorkflowOverflowMenu from './WorkflowOverflowMenu.vue'

const openWorkflow = vi.hoisted(() => vi.fn())

vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => ({ openWorkflow }) })
)

it('TS-08/TS-13 shows and announces the chat status of each overflow workflow, including the active one', async () => {
  const active = markRaw(
    new ComfyWorkflow({ path: 'workflows/active.json', modified: 0, size: 0 })
  )
  const waiting = markRaw(
    new ComfyWorkflow({ path: 'workflows/waiting.json', modified: 0, size: 0 })
  )
  const quiet = markRaw(
    new ComfyWorkflow({ path: 'workflows/quiet.json', modified: 0, size: 0 })
  )
  const workflows = useWorkflowStore()
  workflows.attachWorkflow(active, 0)
  workflows.attachWorkflow(waiting, 1)
  workflows.attachWorkflow(quiet, 2)
  const activity = useWorkflowTabActivityStore()
  activity.setChatPaths([active.path, quiet.path])
  activity.setAgentTurnTabs([{ path: waiting.path, awaitingApproval: true }])

  render(WorkflowOverflowMenu, {
    props: { workflows: [active, waiting, quiet], activeWorkflow: active },
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
                agentChat: enMessages.g.agentChat
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
    name: `active, ${enMessages.g.agentChat}`
  })
  expect(
    within(activeItem).getByRole('img', {
      name: enMessages.g.agentChat
    })
  ).toHaveAttribute('data-status', 'seen')

  const waitingItem = screen.getByRole('menuitem', {
    name: `waiting, ${enMessages.g.agentNeedsApproval}`
  })
  expect(
    within(waitingItem).getByRole('img', {
      name: enMessages.g.agentNeedsApproval
    })
  ).toHaveAttribute('data-status', 'waiting')

  const quietItem = screen.getByRole('menuitem', {
    name: `quiet, ${enMessages.g.agentChat}`
  })
  expect(
    within(quietItem).getByRole('img', {
      name: enMessages.g.agentChat
    })
  ).toHaveAttribute('data-status', 'seen')

  await user.click(waitingItem)
  expect(openWorkflow).toHaveBeenCalledWith(waiting, { initiator: 'user' })
})

it('TS-13 shows nothing next to an overflow workflow without a chat', async () => {
  const active = markRaw(
    new ComfyWorkflow({ path: 'workflows/active.json', modified: 0, size: 0 })
  )
  const other = markRaw(
    new ComfyWorkflow({ path: 'workflows/other.json', modified: 0, size: 0 })
  )
  const workflows = useWorkflowStore()
  workflows.attachWorkflow(active, 0)
  workflows.attachWorkflow(other, 1)

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
