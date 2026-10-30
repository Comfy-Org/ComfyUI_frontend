import { expect } from '@playwright/test'

import { agentOfflineEditTest as test } from '@e2e/fixtures/agentOfflineEditFixture'

test.describe(
  'Human edits made while the agent process is down',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test.describe.configure({ timeout: 180_000 })

    test(
      'win a register the agent wrote during the outage',
      {
        annotation: [
          {
            type: 'issue',
            description:
              'https://linear.app/comfyorg/issue/PM-2118/local-manual-parameter-edits-revert-after-agent-turns-even-when-only'
          }
        ]
      },
      async ({ offlineEdit }) => {
        await offlineEdit.buildAgentPromptNodes()
        await expect
          .poll(() => offlineEdit.canvasPromptValues())
          .toEqual(offlineEdit.agentPrompts)
        const subscribesBeforeOutage = offlineEdit.subscribeCount()

        await offlineEdit.beginOutageAndRetype()
        await expect
          .poll(() => offlineEdit.refusedConnectionCount(), { timeout: 90_000 })
          .toBeGreaterThanOrEqual(4)
        offlineEdit.agentRewritesFirstPrompt()

        offlineEdit.restoreAgent()
        await expect
          .poll(() => offlineEdit.subscribeCount(), { timeout: 90_000 })
          .toBeGreaterThan(subscribesBeforeOutage)
        await expect
          .poll(() => offlineEdit.documentPromptValues(), {
            timeout: 60_000,
            message: 'the held edit wins over the agent write it never saw'
          })
          .toEqual(offlineEdit.humanPrompts)
        await expect
          .poll(() => offlineEdit.canvasPromptValues())
          .toEqual(offlineEdit.humanPrompts)
      }
    )

    test(
      'survive the reconnect, the save, a reload and the next agent turn',
      {
        annotation: [
          {
            type: 'issue',
            description:
              'https://linear.app/comfyorg/issue/PM-2392/agent-reconnect-overwrites-load-image-edits-saved-during-the-outage'
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

        const subscribesBeforeOutage = offlineEdit.subscribeCount()

        await test.step('the agent process goes down and the user retypes both prompts', async () => {
          await offlineEdit.beginOutageAndRetype()
          await expect
            .poll(() => offlineEdit.refusedConnectionCount(), {
              timeout: 90_000,
              message: 'the page keeps trying while the agent is down'
            })
            .toBeGreaterThanOrEqual(4)
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('the agent comes back and catches the canvas up', async () => {
          offlineEdit.restoreAgent()
          await expect
            .poll(() => offlineEdit.subscribeCount(), { timeout: 90_000 })
            .toBeGreaterThan(subscribesBeforeOutage)
          await expect
            .poll(() => offlineEdit.canvasPromptValues(), {
              timeout: 60_000,
              message: 'the reconnect must not overwrite the offline edit'
            })
            .toEqual(offlineEdit.humanPrompts)
          await expect
            .poll(() => offlineEdit.documentPromptValues(), {
              timeout: 60_000,
              message: 'the held edit reaches the document on reconnect'
            })
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('the save after the reconnect still holds them', async () => {
          await offlineEdit.saveWorkflow()
          await expect
            .poll(() => offlineEdit.savedContent())
            .toContain(offlineEdit.humanPrompts[0])
          const content = offlineEdit.savedContent()
          expect(content).toContain(offlineEdit.humanPrompts[1])
          expect(content).not.toContain(offlineEdit.agentPrompts[0])
          expect(content).not.toContain(offlineEdit.agentPrompts[1])
        })

        await test.step('a reload reopens them from the server', async () => {
          expect(await offlineEdit.reloadSavedWorkflow()).toBe(true)
          await expect
            .poll(() => offlineEdit.canvasPromptValues(), { timeout: 60_000 })
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('the next agent turn reads them too', async () => {
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
