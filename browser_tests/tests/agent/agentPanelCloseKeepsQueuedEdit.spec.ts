import { expect } from '@playwright/test'

import { agentOfflineEditTest as test } from '@e2e/fixtures/agentOfflineEditFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

test.describe(
  'Hand edits queued behind a stalled transport when the Agent panel closes',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test.describe.configure({ timeout: 180_000 })

    test(
      'survive the panel close and reach the next agent turn',
      {
        annotation: [
          {
            type: 'issue',
            description:
              'https://linear.app/comfyorg/issue/PM-2451/sentry-alert-on-cloud-frontend-prod-failure-syncing-agent-edit'
          }
        ]
      },
      async ({ page, offlineEdit }) => {
        const panel = new AgentPanel(page)

        await test.step('the agent builds two prompt nodes', async () => {
          await offlineEdit.buildAgentPromptNodes()
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.agentPrompts)
        })

        await test.step('the transport stalls and the user retypes both prompts', async () => {
          await offlineEdit.beginOutageAndRetype()
          await expect
            .poll(() => offlineEdit.refusedConnectionCount(), {
              timeout: 90_000
            })
            .toBeGreaterThanOrEqual(4)
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.humanPrompts)
          expect(offlineEdit.documentPromptValues()).toEqual(
            offlineEdit.agentPrompts
          )
        })

        await test.step('the user closes the Agent panel while the edits are still queued', async () => {
          await panel.close()
        })

        const subscribesBeforeReopen = offlineEdit.subscribeCount()

        await test.step('the panel is reopened and the agent comes back', async () => {
          await panel.open()
          offlineEdit.restoreAgent()
          await expect
            .poll(() => offlineEdit.subscribeCount(), { timeout: 90_000 })
            .toBeGreaterThan(subscribesBeforeReopen)
        })

        await test.step('the queued edits reach the shared document', async () => {
          await expect
            .poll(() => offlineEdit.documentPromptValues(), {
              timeout: 60_000,
              message: 'a panel close must not drop the queued ops'
            })
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('the canvas still holds what the user typed', async () => {
          await expect
            .poll(() => offlineEdit.canvasPromptValues(), {
              timeout: 60_000,
              message: 'a panel close must not rewind the canvas'
            })
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('the next agent turn reads what the user typed', async () => {
          const postsBefore = offlineEdit.postCount()
          await offlineEdit.askNextTurn()
          await expect.poll(() => offlineEdit.postCount()).toBe(postsBefore + 1)
          const draft = offlineEdit.draftAt(postsBefore)
          expect(draft).toContain(offlineEdit.humanPrompts[0])
          expect(draft).toContain(offlineEdit.humanPrompts[1])
          expect(draft).not.toContain(offlineEdit.agentPrompts[0])
          expect(draft).not.toContain(offlineEdit.agentPrompts[1])
        })
      }
    )
  }
)
