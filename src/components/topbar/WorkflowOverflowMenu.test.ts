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

it('TS-13 shows the chat status of each overflow workflow, apart from the active one', async () => {
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
  const waitingItem = await screen.findByRole('menuitem', { name: 'waiting' })
  expect(
    within(waitingItem).getByRole('img', {
      name: enMessages.g.agentNeedsApproval
    })
  ).toHaveClass('bg-warning')
  expect(
    within(screen.getByRole('menuitem', { name: 'quiet' })).getByRole('img', {
      name: enMessages.g.agentChat
    })
  ).toHaveClass('bg-muted-foreground')

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
