import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { WorkspaceStore } from '@e2e/types/globals'

// Pinia store instance access, the pattern
// `browser_tests/tests/vueNodes/widgets/flux2ImagePromptRerun.spec.ts` uses:
// the store object itself cannot cross the evaluate boundary, so every call
// against it happens inside a single `page.evaluate`.
interface WorkflowTabBindingStore {
  tabPathFor(workflowId: string): string | undefined
  bind(workflowId: string, tabPath: string): void
  unbindWorkflow(workflowId: string): void
}

// Drops the agent's workflow-tab binding so `getScope()` (AgentPanelRoot.vue)
// resolves to null on the next batch, reproducing the same "can't resolve
// which tab this edit is bound to" race the retry recovers from — without
// touching the doc or sending another frame. Returns the tab path so the
// caller can restore the exact same binding afterward.
function dropWorkflowScope(page: Page, workflowId: string): Promise<string> {
  return page.evaluate((id) => {
    const store = (
      document.getElementById('vue-app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, unknown> } }
          }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia._s.get(
      'agentWorkflowTabBinding'
    ) as WorkflowTabBindingStore
    const tabPath = store.tabPathFor(id)
    if (tabPath === undefined)
      throw new Error(`no bound tab path for workflow ${id}`)
    store.unbindWorkflow(id)
    return tabPath
  }, workflowId)
}

function restoreWorkflowScope(
  page: Page,
  workflowId: string,
  tabPath: string
): Promise<void> {
  return page.evaluate(
    ({ id, path }) => {
      const store = (
        document.getElementById('vue-app') as unknown as {
          __vue_app__: {
            config: {
              globalProperties: { $pinia: { _s: Map<string, unknown> } }
            }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s.get(
        'agentWorkflowTabBinding'
      ) as WorkflowTabBindingStore
      store.bind(id, path)
    },
    { id: workflowId, path: tabPath }
  )
}

test.describe(
  'Agent delete and clear operations',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.describe('delete_node', () => {
      test.use({ conversationCase: 'agent-rec-add-set-delete' })

      test('removes the requested node while preserving the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)

        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(5)
        await expect(
          agentConversation.vueNodes.getNodeLocator('2785690574723683')
        ).toHaveCount(0)
      })
    })

    test.describe('clear_canvas', () => {
      test.use({ conversationCase: 'agent-rec-clear-workflow' })

      test('leaves the canvas empty after clearing the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)

        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })

      test('clears the canvas on its own after the clear frame is rejected for a dropped workflow scope', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(90_000)
        const workflowId = agentConversation.conversation.workflow.id
        let tabPath: string | undefined

        await agentConversation.sendPrompt(0)
        await agentConversation.replayResponse(0, undefined, async (index) => {
          const entry = agentConversation.conversation.turns[0].response[index]
          if (entry.kind !== 'graph_ops') return
          if (!entry.ops.some((op) => op.op === 'clear')) return
          // The seed workflow is empty, so the only node on screen at this
          // point is the one the turn's own earlier add_node frame placed.
          // hostSocket.send() does not wait for the page to receive and apply
          // that frame before this callback runs, so without this wait the
          // scope drop below can land before the add does, rejecting it too
          // and leaving nothing on screen to prove the clear's rejection with.
          await expect(agentConversation.vueNodes.nodes).not.toHaveCount(0)
          // Removing both resolution paths reproduces a real closed-tab race:
          // the binding is gone and the workflow is no longer open, so the
          // clear frame cannot resolve a graph scope.
          tabPath = await dropWorkflowScope(page, workflowId)
          await agentConversation.topbar.closeWorkflowTab('Unsaved Workflow')
        })
        if (tabPath === undefined)
          throw new Error('the clear frame never armed the scope drop')
        const replacementPath = await page.evaluate(
          () =>
            (window.app!.extensionManager as WorkspaceStore).workflow
              .activeWorkflow?.path
        )
        if (replacementPath === undefined)
          throw new Error('closing the target did not create a replacement tab')
        await restoreWorkflowScope(page, workflowId, replacementPath)

        // The self-driven retry clears the canvas on its own; nothing sends
        // another frame after this point.
        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })
    })
  }
)
