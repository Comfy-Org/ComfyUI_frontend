import { expect } from '@playwright/test'

import { agentOfflineEditTest as test } from '@e2e/fixtures/agentOfflineEditFixture'

test.use({ crdtDebugEnabled: true })

test.describe(
  'Hand edits made while the Agent panel is closed',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test.describe.configure({ timeout: 180_000 })

    test(
      'still mint and reach the shared document',
      {
        annotation: [
          {
            type: 'issue',
            description:
              'https://linear.app/comfyorg/issue/PM-2451/sentry-alert-on-cloud-frontend-prod-failure-syncing-agent-edit'
          }
        ]
      },
      async ({ offlineEdit }) => {
        await test.step('the agent builds two prompt nodes', async () => {
          await offlineEdit.buildAgentPromptNodes()
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.agentPrompts)
        })

        const appliedBeforeClose = await offlineEdit.appliedFrameCount()

        await test.step('the user closes the Agent panel', async () => {
          await offlineEdit.closePanel()
        })

        await test.step('the user retypes both prompts with the panel closed', async () => {
          await offlineEdit.retypeBothPrompts()
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('the shared document carries what the user typed', async () => {
          await expect
            .poll(() => offlineEdit.documentPromptValues(), {
              timeout: 60_000,
              message:
                'the document must hold the edit made with the panel closed'
            })
            .toEqual(offlineEdit.humanPrompts)
        })

        const opIdsBeforeReopen = new Set(offlineEdit.sentOpIds())
        const subscribesBeforeReopen = offlineEdit.subscribeCount()

        await test.step('reopening the panel mints no further operation', async () => {
          await offlineEdit.openPanel()
          await expect
            .poll(() => offlineEdit.subscribeCount(), { timeout: 60_000 })
            .toBeGreaterThan(subscribesBeforeReopen)
          await expect
            .poll(() => offlineEdit.appliedFrameCount(), { timeout: 60_000 })
            .toBeGreaterThan(appliedBeforeClose)
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.humanPrompts)
          await expect
            .poll(() => offlineEdit.documentPromptValues(), { timeout: 60_000 })
            .toEqual(offlineEdit.humanPrompts)
          expect(new Set(offlineEdit.sentOpIds())).toEqual(opIdsBeforeReopen)
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
