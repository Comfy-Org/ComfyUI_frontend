import { expect } from '@playwright/test'

import { agentOfflineEditTest as test } from '@e2e/fixtures/agentOfflineEditFixture'

/**
 * PM-2451 / FRONT-3582 stage 2. `agentPanelCloseKeepsQueuedEdit.spec.ts` covers
 * the edit made *before* the close; this is the other half, and it is the one
 * nobody sees. The op producer used to be attached in `AgentPanelRoot.setup()`
 * and detached from the panel's teardown list, and `DockedAgentPanel.vue`
 * renders the panel under `v-if`, so a one-click close unmounted it. An edit
 * made while the panel was closed then minted nothing at all: no operation, no
 * retained batch, nothing for the next resubscribe to replay, and no error — it
 * did not even reach the `failure_syncing_agent_edit_undeliverable` report the
 * queued-edit case produces.
 */
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

        const opsBeforeClose =
          await test.step('the user closes the Agent panel, with nothing queued', async () => {
            const sent = offlineEdit.sentOps()
            await offlineEdit.closePanel()
            return sent
          })

        await test.step('the user retypes both prompts with the panel closed', async () => {
          await offlineEdit.retypeBothPrompts()
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.humanPrompts)
        })

        await test.step('both edits minted while the panel was closed', async () => {
          await expect
            .poll(() => offlineEdit.sentOps().length, {
              timeout: 60_000,
              message:
                'an edit made with the panel closed must still mint: before stage 2 nothing was produced at all'
            })
            .toBeGreaterThan(opsBeforeClose.length)
          expect(offlineEdit.sentOps().slice(opsBeforeClose.length)).toEqual(
            expect.arrayContaining([expect.stringContaining('set_widget')])
          )
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

        const opIdsBeforeReopen = offlineEdit.sentOpIds()

        await test.step('reopening the panel does not re-mint those edits', async () => {
          await offlineEdit.openPanel()
          await expect
            .poll(() => offlineEdit.canvasPromptValues())
            .toEqual(offlineEdit.humanPrompts)
          // Identity is minted once and never regenerated, so a remount must
          // not produce a second op for an edit the document already carries.
          expect(new Set(offlineEdit.sentOpIds()).size).toBe(
            offlineEdit.sentOpIds().length
          )
          expect(
            offlineEdit.sentOpIds().slice(0, opIdsBeforeReopen.length)
          ).toEqual(opIdsBeforeReopen)
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
